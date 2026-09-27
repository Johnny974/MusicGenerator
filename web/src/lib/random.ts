/**
 * Seeded randomness. All generator code must use this instead of Math.random()
 * so that the same seed always produces the same audio (see docs/SPEC.md §2).
 */

/** A function returning a pseudo-random float in [0, 1). */
export type Rng = () => number

/**
 * mulberry32: tiny, fast 32-bit PRNG. Plenty good for music, not for crypto.
 * Returns a new generator; each call advances its internal state.
 */
export function createRng(seed: number): Rng {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Derive an independent sub-seed from a parent seed and a label, e.g.
 * deriveSeed(seed, 'rain', sectionIndex). Lets each layer / section have its
 * own random stream without depending on how many numbers others consumed.
 */
export function deriveSeed(seed: number, ...parts: (string | number)[]): number {
  // FNV-1a hash over the seed and the parts.
  let hash = 0x811c9dc5 ^ (seed >>> 0)
  for (const part of parts) {
    const text = `|${part}`
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i)
      hash = Math.imul(hash, 0x01000193)
    }
  }
  return hash >>> 0
}
