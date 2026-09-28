import { describe, expect, it } from 'vitest'
import { fadeInGain, fadeInProgress } from '@/lib/fade'

describe('fadeInGain', () => {
  it('starts at exact silence and ends at unity', () => {
    expect(fadeInGain(0)).toBe(0)
    expect(fadeInGain(1)).toBe(1)
  })

  it('rises evenly in dB: each tenth of the fade adds the same number of dB', () => {
    // Floor −50 dB → 0 dB over the fade: 5 dB per tenth, −25 dB halfway.
    expect(toDb(fadeInGain(0.5))).toBeCloseTo(-25, 9)
    for (let i = 1; i < 10; i++) {
      const step = toDb(fadeInGain((i + 1) / 10)) - toDb(fadeInGain(i / 10))
      expect(step).toBeCloseTo(5, 9)
    }
  })

  it('only ever rises, and holds at the ends outside [0, 1]', () => {
    let previous = fadeInGain(0)
    for (let i = 1; i <= 1000; i++) {
      const gain = fadeInGain(i / 1000)
      expect(gain).toBeGreaterThan(previous)
      previous = gain
    }
    expect(fadeInGain(-0.5)).toBe(0)
    expect(fadeInGain(1.5)).toBe(1)
  })
})

describe('fadeInProgress', () => {
  it('finds where on the fade-in curve a gain sits', () => {
    // −25 dB is halfway from the −50 dB floor to 0 dB.
    expect(fadeInProgress(0.0562341325)).toBeCloseTo(0.5, 9)
    for (const progress of [0.1, 0.37, 0.9]) {
      expect(fadeInProgress(fadeInGain(progress))).toBeCloseTo(progress, 9)
    }
  })

  it('starts from the beginning below the floor and is done at full level', () => {
    expect(fadeInProgress(0)).toBe(0)
    expect(fadeInProgress(0.001)).toBe(0)
    expect(fadeInProgress(1)).toBe(1)
    expect(fadeInProgress(1.2)).toBe(1)
  })
})

function toDb(gain: number): number {
  return 20 * Math.log10(gain)
}
