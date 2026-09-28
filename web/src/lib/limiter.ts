/**
 * Soft limiter curve for the master bus: sample level in → sample level out.
 *
 * Below the knee the curve is the identity, so a normal mix passes through
 * untouched. Above it, levels bend smoothly (tanh) towards the ceiling and never
 * reach it, however loud the input. The bend starts with slope 1, so there is no
 * corner in the curve to add a harsh edge.
 *
 * The knee has to sit somewhat below the ceiling: a curve that stayed exact right
 * up to the ceiling would have to turn a hard corner there, which is plain
 * clipping. 2 dB of bend is a compromise between the two.
 *
 * Why a curve and not a compressor: see createMasterBus (src/audio/master.ts).
 */

/** No sample ever reaches this level, in dBFS. Just under full scale (0 dBFS = 1.0). */
export const LIMITER_CEILING_DB = -1

/** Levels below this pass through unchanged, in dBFS. */
export const LIMITER_KNEE_DB = -3

const CEILING = 10 ** (LIMITER_CEILING_DB / 20)
const KNEE = 10 ** (LIMITER_KNEE_DB / 20)

/** One sample through the limiter. Symmetric: a negative sample is limited the same way. */
export function softClip(level: number): number {
  const magnitude = Math.abs(level)
  if (magnitude <= KNEE) return level
  const bendRange = CEILING - KNEE
  return Math.sign(level) * (KNEE + bendRange * Math.tanh((magnitude - KNEE) / bendRange))
}
