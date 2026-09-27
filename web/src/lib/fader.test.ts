import { describe, expect, it } from 'vitest'
import { faderToDb, faderToGain } from './fader'

describe('faderToGain', () => {
  it('is silent at 0 and unity at 1', () => {
    expect(faderToGain(0)).toBe(0)
    expect(faderToGain(1)).toBe(1)
  })
})

describe('faderToDb', () => {
  it('maps 0 to -Infinity and 1 to 0 dB', () => {
    expect(faderToDb(0)).toBe(-Infinity)
    expect(faderToDb(1)).toBe(0)
  })
})

describe('fader curve', () => {
  it('is strictly increasing across the travel', () => {
    let previous = faderToDb(0)
    for (let i = 1; i <= 100; i++) {
      const db = faderToDb(i / 100)
      expect(db).toBeGreaterThan(previous)
      previous = db
    }
  })

  it('puts the midpoint well below half loudness (audio taper, not linear)', () => {
    // Linear gain would be −6 dB at the midpoint; an audio taper sits far lower.
    expect(faderToDb(0.5)).toBeLessThan(-12)
    expect(faderToDb(0.5)).toBeGreaterThan(-30)
  })

  it('clamps positions outside [0, 1]', () => {
    expect(faderToGain(-0.5)).toBe(0)
    expect(faderToGain(2)).toBe(1)
  })
})
