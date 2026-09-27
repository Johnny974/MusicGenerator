import { describe, expect, it } from 'vitest'
import { generateNoiseLoop, NOISE_LOOP_SECONDS, NOISE_TARGET_RMS } from './noise'

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

describe('generateNoiseLoop', () => {
  it('produces a loop of NOISE_LOOP_SECONDS at the given sample rate', () => {
    const { left, right } = generateNoiseLoop({ seed: 1, color: 'brown', sampleRate: SAMPLE_RATE })
    expect(left.length).toBe(NOISE_LOOP_SECONDS * SAMPLE_RATE)
    expect(right.length).toBe(left.length)
  })

  it('is bit-identical for the same seed and different for another seed', () => {
    const a = generateNoiseLoop({ seed: 42, color: 'brown', sampleRate: SAMPLE_RATE })
    const b = generateNoiseLoop({ seed: 42, color: 'brown', sampleRate: SAMPLE_RATE })
    const c = generateNoiseLoop({ seed: 43, color: 'brown', sampleRate: SAMPLE_RATE })
    expect(b.left).toEqual(a.left)
    expect(b.right).toEqual(a.right)
    expect(c.left).not.toEqual(a.left)
  })

  it('uses a different random stream for left and right (stereo width)', () => {
    const { left, right } = generateNoiseLoop({ seed: 7, color: 'brown', sampleRate: SAMPLE_RATE })
    expect(right).not.toEqual(left)
  })

  it('is normalized to the shared RMS target without clipping', () => {
    const { left, right } = generateNoiseLoop({ seed: 7, color: 'brown', sampleRate: SAMPLE_RATE })
    for (const channel of [left, right]) {
      expect(rms(channel)).toBeCloseTo(NOISE_TARGET_RMS, 3)
      expect(peak(channel)).toBeLessThan(1)
    }
  })

  it('brown noise is low-frequency heavy: tiny sample-to-sample steps relative to its level', () => {
    // For white noise the mean |step| is about 1.13 × RMS (independent samples).
    // Brown noise wanders slowly, so its steps are a small fraction of its RMS.
    const { left } = generateNoiseLoop({ seed: 3, color: 'brown', sampleRate: SAMPLE_RATE })
    expect(meanAbsStep(left) / rms(left)).toBeLessThan(0.3)
  })

  it('has no DC offset', () => {
    const { left, right } = generateNoiseLoop({ seed: 3, color: 'brown', sampleRate: SAMPLE_RATE })
    expect(Math.abs(mean(left))).toBeLessThan(0.001)
    expect(Math.abs(mean(right))).toBeLessThan(0.001)
  })

  it('loops seamlessly: the jump from last sample back to first is an ordinary step', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const loop = generateNoiseLoop({ seed, color: 'brown', sampleRate: SAMPLE_RATE })
      for (const channel of [loop.left, loop.right]) {
        const seam = Math.abs(channel[channel.length - 1] - channel[0])
        expect(seam).toBeLessThan(4 * meanAbsStep(channel))
      }
    }
  })
})
