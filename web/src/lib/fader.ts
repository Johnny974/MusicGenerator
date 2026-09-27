/**
 * Fader curve: maps a slider position in [0, 1] to a gain.
 *
 * A linear slider feels wrong because loudness perception is roughly
 * logarithmic — most of the travel would sound "loud". Cubing the position is
 * a common audio-taper approximation: 0.5 → gain 0.125 ≈ −18 dB.
 */
const CURVE_EXPONENT = 3

/** Slider position (clamped to [0, 1]) → linear gain in [0, 1]. */
export function faderToGain(position: number): number {
  const p = Math.min(1, Math.max(0, position))
  return p ** CURVE_EXPONENT
}

/** Slider position → decibels (0 → −Infinity, 1 → 0 dB). */
export function faderToDb(position: number): number {
  const gain = faderToGain(position)
  return gain === 0 ? -Infinity : 20 * Math.log10(gain)
}
