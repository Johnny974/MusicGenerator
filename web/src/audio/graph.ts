import * as Tone from 'tone'
import type { NoiseColor } from '@/generators/noise'
import { faderToGain } from '@/lib/fader'
import type { AmbienceSettings } from '@/lib/settings'
import { createMasterBus, type MasterBus } from '@/audio/master'
import { createNoiseLayer, createNoiseMixer, type NoiseLayer, type NoiseMixer } from '@/audio/layer'
import { SOURCE_FADE_SECONDS } from '@/audio/fades'

/**
 * The Ambience signal graph, shared by live playback (engine.ts) and offline
 * rendering (offline.ts) — the one place that decides how the parts connect:
 *
 *   white player (looped seeded buffer) → layer gain (fader) ─┐
 *   pink player                         → layer gain (fader) ─┼→ mixer → master bus
 *   brown player                        → layer gain (fader) ─┘       (EQ, volume) → destination
 *
 * The mixer sums the layers in a fixed order so a mix is bit-for-bit
 * repeatable (mixer.ts). Layers are only built when first needed, so a layer
 * that stays at 0 costs nothing.
 *
 * Everything is built in the given Tone context: the live one, or an offline one.
 */
export interface Graph {
  seed: number
  context: Tone.BaseContext
  master: MasterBus
  mixer: NoiseMixer
  /** Only layers that have been needed at least once exist here. */
  layers: Partial<Record<NoiseColor, NoiseLayer>>
  /** Player fade when a layer starts or stops (0 offline, see createNoiseLayer). */
  sourceFadeSeconds: number
}

export interface GraphOptions {
  /** Default: the live context. */
  context?: Tone.BaseContext
  /**
   * Offline renders have no transport and start mid-stream: the master starts at
   * full level instead of silent, and players don't fade in. Default: false.
   */
  offline?: boolean
}

export function buildGraph(
  settings: AmbienceSettings,
  { context = Tone.getContext(), offline = false }: GraphOptions = {},
): Graph {
  const master = createMasterBus(settings.master, { context, startSilent: !offline })
  return {
    seed: settings.seed,
    context,
    master,
    mixer: createNoiseMixer(master.input, context),
    layers: {},
    sourceFadeSeconds: offline ? 0 : SOURCE_FADE_SECONDS,
  }
}

/** The layer for `color`, built (silent, not started) on first use. */
export function getLayer(g: Graph, color: NoiseColor): NoiseLayer {
  return (g.layers[color] ??= createNoiseLayer({
    seed: g.seed,
    color,
    output: g.mixer.input(color),
    context: g.context,
    sourceFadeSeconds: g.sourceFadeSeconds,
  }))
}

/**
 * Set `color` to a fader position and start it `offset` seconds into its loop.
 * Only for positions above 0: a layer at 0 is never started (or even built) so it
 * costs nothing — offline.ts skips it, engine.ts stops it.
 */
export function startLayer(g: Graph, color: NoiseColor, position: number, offset: number): void {
  const layer = getLayer(g, color)
  // Jump (no ramp) to the level; live, the player's fadeIn brings the sound in smoothly.
  layer.gain.gain.cancelScheduledValues(g.context.now())
  layer.gain.gain.value = faderToGain(position)
  layer.player.start(undefined, offset)
}

export function disposeGraph(g: Graph): void {
  for (const layer of Object.values(g.layers)) layer.dispose()
  g.mixer.dispose()
  g.master.dispose()
}
