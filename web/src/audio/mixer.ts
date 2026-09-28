import * as Tone from 'tone'

/**
 * Sums several sources in a fixed order, so the mix is bit-for-bit repeatable.
 *
 * Connecting many sources straight into one node would be simpler, but a Web
 * Audio node adds up its inputs in whatever order the browser keeps them
 * (Chromium: a hash set). Float addition isn't associative — (a + b) + c and
 * (a + c) + b can differ in the last bit — so two renders of the same settings
 * would give different checksums.
 *
 * Instead each slot is a unity gain, chained:
 *
 *   source 0 → slot 0 ─→ slot 1 ─→ slot 2 ─→ output
 *   source 1 ──────────┘         │
 *   source 2 ────────────────────┘
 *
 * Every slot has at most two inputs, and a + b equals b + a exactly.
 */
export interface Mixer {
  /** Connect source i to inputs[i]. */
  inputs: Tone.Gain[]
  dispose(): void
}

export function createMixer(
  count: number,
  output: Tone.InputNode,
  context: Tone.BaseContext = Tone.getContext(),
): Mixer {
  const inputs = Array.from({ length: count }, () => new Tone.Gain({ context, gain: 1 }))
  // Tone.Gain's chain needs at least one node; with count 0 there is nothing to mix.
  if (count > 0) inputs[0].chain(...inputs.slice(1), output)
  return {
    inputs,
    dispose() {
      for (const input of inputs) input.dispose()
    },
  }
}
