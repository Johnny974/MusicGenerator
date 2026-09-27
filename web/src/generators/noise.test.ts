import { describe, expect, it } from 'vitest'
import { measureLoudness } from '@/lib/loudness'
import { generateNoiseLoop, NOISE_LOOP_SECONDS, NOISE_TARGET_LUFS, type NoiseColor } from './noise'

const COLORS: NoiseColor[] = ['white', 'pink', 'brown']

// A low sample rate keeps the tests fast; the maths doesn't depend on it.
const SAMPLE_RATE = 8000

function rms(samples: Float32Array): number {
  let sum = 0
  for (const s of samples) sum += s * s
  return Math.sqrt(sum / samples.length)
}

function peak(samples: Float32Array): number {
  let max = 0
  for (const s of samples) max = Math.max(max, Math.abs(s))
  return max
}

function meanAbsStep(samples: Float32Array): number {
  let sum = 0
  for (let i = 1; i < samples.length; i++) sum += Math.abs(samples[i] - samples[i - 1])
  return sum / (samples.length - 1)
}

function mean(samples: Float32Array): number {
  let sum = 0
  for (const s of samples) sum += s
  return sum / samples.length
}

/**
 * Share of energy in the high end: energy of the first difference (a simple
 * high-pass) relative to the signal's energy. Independent samples (white) give
 * about 2; the more a signal leans to low frequencies, the smaller it gets.
 */
function highFrequencyShare(samples: Float32Array): number {
  let diff = 0
  let total = 0
  for (let i = 1; i < samples.length; i++) {
    diff += (samples[i] - samples[i - 1]) ** 2
    total += samples[i] ** 2
  }
  return diff / total
}

describe('generateNoiseLoop', () => {
  it('produces a loop of NOISE_LOOP_SECONDS at the given sample rate', () => {
    const { left, right } = generateNoiseLoop({ seed: 1, color: 'brown', sampleRate: SAMPLE_RATE })
    expect(left.length).toBe(NOISE_LOOP_SECONDS * SAMPLE_RATE)
    expect(right.length).toBe(left.length)
  })

  it.each(COLORS)(
    '%s: is bit-identical for the same seed and different for another seed',
    (color) => {
      const a = generateNoiseLoop({ seed: 42, color, sampleRate: SAMPLE_RATE })
      const b = generateNoiseLoop({ seed: 42, color, sampleRate: SAMPLE_RATE })
      const c = generateNoiseLoop({ seed: 43, color, sampleRate: SAMPLE_RATE })
      expect(b.left).toEqual(a.left)
      expect(b.right).toEqual(a.right)
      expect(c.left).not.toEqual(a.left)
    },
  )

  it.each(COLORS)(
    '%s: uses a different random stream for left and right (stereo width)',
    (color) => {
      const { left, right } = generateNoiseLoop({ seed: 7, color, sampleRate: SAMPLE_RATE })
      expect(right).not.toEqual(left)
    },
  )

  it('gives each color its own random stream', () => {
    const white = generateNoiseLoop({ seed: 7, color: 'white', sampleRate: SAMPLE_RATE })
    const brown = generateNoiseLoop({ seed: 7, color: 'brown', sampleRate: SAMPLE_RATE })
    expect(white.left).not.toEqual(brown.left)
  })

  it.each(COLORS)('%s: is normalized to the shared loudness target without clipping', (color) => {
    // Real playback rate: the K-weighting curve is only meaningful up to ~20 kHz.
    const sampleRate = 48000
    const { left, right } = generateNoiseLoop({ seed: 7, color, sampleRate })
    for (const channel of [left, right]) {
      expect(measureLoudness(channel, sampleRate)).toBeCloseTo(NOISE_TARGET_LUFS, 1)
      expect(peak(channel)).toBeLessThan(1)
    }
  })

  it('white noise has a flat spectrum: samples are independent', () => {
    const { left } = generateNoiseLoop({ seed: 3, color: 'white', sampleRate: SAMPLE_RATE })
    expect(highFrequencyShare(left)).toBeCloseTo(2, 1)
  })

  it('orders the colors by high-frequency content: white > pink > brown', () => {
    const share = (color: NoiseColor) =>
      highFrequencyShare(generateNoiseLoop({ seed: 3, color, sampleRate: SAMPLE_RATE }).left)
    const white = share('white')
    const pink = share('pink')
    const brown = share('brown')
    // Clear gaps, not just a strict ordering: each color should sound distinct.
    expect(pink).toBeLessThan(white / 2)
    expect(brown).toBeLessThan(pink / 2)
  })

  it('brown noise is low-frequency heavy: tiny sample-to-sample steps relative to its level', () => {
    // For white noise the mean |step| is about 1.13 × RMS (independent samples).
    // Brown noise wanders slowly, so its steps are a small fraction of its RMS.
    const { left } = generateNoiseLoop({ seed: 3, color: 'brown', sampleRate: SAMPLE_RATE })
    expect(meanAbsStep(left) / rms(left)).toBeLessThan(0.3)
  })

  it.each(COLORS)('%s: has no DC offset', (color) => {
    const { left, right } = generateNoiseLoop({ seed: 3, color, sampleRate: SAMPLE_RATE })
    expect(Math.abs(mean(left))).toBeLessThan(0.001)
    expect(Math.abs(mean(right))).toBeLessThan(0.001)
  })

  it.each(COLORS)(
    '%s: loops seamlessly: the jump from last sample back to first is an ordinary step',
    (color) => {
      for (const seed of [1, 2, 3, 4, 5]) {
        const loop = generateNoiseLoop({ seed, color, sampleRate: SAMPLE_RATE })
        for (const channel of [loop.left, loop.right]) {
          const seam = Math.abs(channel[channel.length - 1] - channel[0])
          expect(seam).toBeLessThan(4 * meanAbsStep(channel))
        }
      }
    },
  )
})
