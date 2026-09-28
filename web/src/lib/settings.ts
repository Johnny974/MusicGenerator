import type { NoiseColor } from '@/generators/noise'

/**
 * Ambience settings model. Grows as layers are added (seed UI in M2).
 */

/** Used until the seed UI arrives in M2. Any 32-bit integer works. */
export const DEFAULT_SEED = 20260927

/** The noise layers, in the order the UI shows them. Adding a layer = adding a row here. */
export const NOISE_LAYERS: readonly { color: NoiseColor; label: string }[] = [
  { color: 'white', label: 'White' },
  { color: 'pink', label: 'Pink' },
  { color: 'brown', label: 'Brown' },
]

export type EqBand = 'low' | 'mid' | 'high'

/** The master EQ bands, in the order the UI shows them. */
export const EQ_BANDS: readonly { band: EqBand; label: string }[] = [
  { band: 'low', label: 'Low' },
  { band: 'mid', label: 'Mid' },
  { band: 'high', label: 'High' },
]

/** Each EQ band can cut or boost by up to this many dB. */
export const EQ_RANGE_DB = 12

/** Master section, shared by the Ambience and Lofi pages. */
export interface MasterSettings {
  /** Gain per EQ band in dB, within ±EQ_RANGE_DB. 0 = flat. */
  eq: Record<EqBand, number>
  /** Master fader position in [0, 1] (same curve as the layer faders). 0 = silent. */
  volume: number
}

export const DEFAULT_MASTER_SETTINGS: MasterSettings = {
  eq: { low: 0, mid: 0, high: 0 },
  volume: 1,
}

export interface AmbienceSettings {
  seed: number
  /** Fader position in [0, 1] per noise layer (see faderToDb). 0 = layer off. */
  levels: Record<NoiseColor, number>
  master: MasterSettings
}

export const DEFAULT_AMBIENCE_SETTINGS: AmbienceSettings = {
  seed: DEFAULT_SEED,
  levels: { white: 0, pink: 0, brown: 0.7 },
  master: DEFAULT_MASTER_SETTINGS,
}
