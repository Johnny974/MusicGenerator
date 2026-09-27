import { describe, expect, it } from 'vitest'
import { createRng, deriveSeed } from './random'

const take = (seed: number, n: number) => {
  const rng = createRng(seed)
  return Array.from({ length: n }, rng)
}

describe('createRng', () => {
  it('is deterministic for the same seed', () => {
    expect(take(4821, 100)).toEqual(take(4821, 100))
  })

  it('differs for different seeds', () => {
    expect(take(1, 10)).not.toEqual(take(2, 10))
  })

  it('stays in [0, 1)', () => {
    for (const x of take(7, 10_000)) {
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(1)
    }
  })
})

describe('deriveSeed', () => {
  it('is stable and label-sensitive', () => {
    expect(deriveSeed(42, 'rain', 3)).toBe(deriveSeed(42, 'rain', 3))
    expect(deriveSeed(42, 'rain', 3)).not.toBe(deriveSeed(42, 'rain', 4))
    expect(deriveSeed(42, 'rain')).not.toBe(deriveSeed(42, 'wind'))
  })
})
