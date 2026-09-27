import type { NoiseColor } from '@/generators/noise'

/**
 * Ambience settings model. Grows as layers are added (master EQ in M1-03, seed
 * UI in M2).
 */

/** Used until the seed UI arrives in M2. Any 32-bit integer works. */
export const DEFAULT_SEED = 20260927

/** The noise layers, in the order the UI shows them. Adding a layer = adding a row here. */
export const NOISE_LAYERS: readonly { color: NoiseColor; label: string }[] = [
  { color: 'white', label: 'White' },
  { color: 'pink', label: 'Pink' },
  { color: 'brown', label: 'Brown' },
]

export interface AmbienceSettings {
  seed: number
  /** Fader position in [0, 1] per noise layer (see faderToDb). 0 = layer off. */
  levels: Record<NoiseColor, number>
}

export const DEFAULT_AMBIENCE_SETTINGS: AmbienceSettings = {
  seed: DEFAULT_SEED,
  levels: { white: 0, pink: 0, brown: 0.7 },
}
