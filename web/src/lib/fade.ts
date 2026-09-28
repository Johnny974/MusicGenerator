/**
 * Fade-in curve for Play: rises evenly in decibels, not in gain.
 *
 * The ear hears loudness roughly in dB. A ramp that is linear in gain is
 * already at −20 dB after a tenth of the fade, so almost all of the audible
 * rise is squeezed into the start. Rising a fixed number of dB per second
 * instead spreads it across the whole fade.
 *
 * dB never reaches silence, so the curve starts from a quiet floor and jumps
 * from exactly 0 to that floor on the very first step. At −50 dB that jump
 * is far too small to hear as a click.
 */

/** Where the fade-in starts, in dB below full level. */
export const FADE_IN_FLOOR_DB = -50

/** Fade-in progress (clamped to [0, 1]) → linear gain in [0, 1]. */
export function fadeInGain(progress: number): number {
  if (progress <= 0) return 0
  return 10 ** ((FADE_IN_FLOOR_DB * (1 - Math.min(1, progress))) / 20)
}

/**
 * The inverse of fadeInGain: how far along the fade-in a gain sits, in [0, 1].
 * Lets a fade-in start from wherever the level is now (e.g. halfway through a
 * Stop fade-out) instead of dropping back to the beginning. Anything at or
 * below the floor counts as the beginning.
 */
export function fadeInProgress(gain: number): number {
  if (gain >= 1) return 1
  if (gain <= 0) return 0
  const db = 20 * Math.log10(gain)
  return Math.max(0, 1 - db / FADE_IN_FLOOR_DB)
}
