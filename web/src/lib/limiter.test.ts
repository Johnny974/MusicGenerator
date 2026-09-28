import { describe, expect, it } from 'vitest'
import { softClip } from '@/lib/limiter'

// −3 dBFS knee, −1 dBFS ceiling.
const KNEE = 0.707946
const CEILING = 0.891251

describe('softClip', () => {
  it('passes levels below the knee through unchanged', () => {
    for (const level of [0, 0.1, -0.3, 0.7, -0.7]) expect(softClip(level)).toBe(level)
  })

  it('never reaches the ceiling, however loud the input', () => {
    for (const level of [0.8, 0.9, 1, 3, 100]) {
      expect(softClip(level)).toBeLessThan(CEILING)
      expect(softClip(-level)).toBeGreaterThan(-CEILING)
    }
  })

  it('never falls as the input rises, with no jump at the knee', () => {
    let previous = softClip(0)
    for (let i = 1; i <= 4000; i++) {
      const out = softClip(i / 1000)
      // Far above the ceiling it flattens out to the last float below it.
      expect(out).toBeGreaterThanOrEqual(previous)
      previous = out
    }
    expect(softClip(KNEE + 1e-6) - softClip(KNEE)).toBeCloseTo(1e-6, 9)
  })
})
