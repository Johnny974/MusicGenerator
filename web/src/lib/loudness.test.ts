import { describe, expect, it } from 'vitest'
import { measureLoudness } from '@/lib/loudness'

const SAMPLE_RATE = 48000

function sine(frequency: number, amplitude = 1, seconds = 1): Float32Array {
  const out = new Float32Array(seconds * SAMPLE_RATE)
  for (let i = 0; i < out.length; i++) {
    out[i] = amplitude * Math.sin((2 * Math.PI * frequency * i) / SAMPLE_RATE)
  }
  return out
}

describe('measureLoudness', () => {
  it('reads a full-scale 997 Hz sine as −3.01 LUFS (ITU-R BS.1770 reference)', () => {
    expect(measureLoudness(sine(997), SAMPLE_RATE)).toBeCloseTo(-3.01, 1)
  })

  it('drops by 20 dB when the amplitude drops by 10×', () => {
    expect(measureLoudness(sine(997, 0.1), SAMPLE_RATE)).toBeCloseTo(-23.01, 1)
  })

  it('weights treble up: a 10 kHz sine reads about 3.3 dB louder than 1 kHz', () => {
    // K-weighting's high shelf gives ~+4 dB at 10 kHz vs ~+0.7 dB at 1 kHz.
    const diff = measureLoudness(sine(10000), SAMPLE_RATE) - measureLoudness(sine(997), SAMPLE_RATE)
    expect(diff).toBeGreaterThan(2.8)
    expect(diff).toBeLessThan(3.8)
  })

  it('weights deep bass down: a 20 Hz sine reads over 10 dB quieter than 1 kHz', () => {
    const diff = measureLoudness(sine(20), SAMPLE_RATE) - measureLoudness(sine(997), SAMPLE_RATE)
    expect(diff).toBeLessThan(-10)
  })

  it('reads silence as −Infinity', () => {
    expect(measureLoudness(new Float32Array(1000), SAMPLE_RATE)).toBe(-Infinity)
  })
})
