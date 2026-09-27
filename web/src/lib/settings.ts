/**
 * Ambience settings model. Grows as layers are added (pink/white in M1-02,
 * master EQ in M1-03, seed UI in M2).
 */

/** Used until the seed UI arrives in M2. Any 32-bit integer works. */
export const DEFAULT_SEED = 20260927

export interface AmbienceSettings {
  seed: number
  /** Brown noise fader position in [0, 1] (see faderToDb). */
  brownLevel: number
}

export const DEFAULT_AMBIENCE_SETTINGS: AmbienceSettings = {
  seed: DEFAULT_SEED,
  brownLevel: 0.7,
}
