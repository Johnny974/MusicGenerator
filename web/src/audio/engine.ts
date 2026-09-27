import * as Tone from 'tone'
import { generateNoiseLoop, type NoiseColor } from '@/generators/noise'
import { faderToGain } from '@/lib/fader'
import type { AmbienceSettings } from '@/lib/settings'

/**
 * Audio engine: turns generator output into sound.
 *
 * Signal graph (built once, on first Play):
 *
 *   noise player (looped seeded buffer) → layer gain (fader) ─┐
 *                                                              ├→ master gain → destination
 *   (more layers in later milestones)  ───────────────────────┘        └→ analyser (tests / visualizer)
 */

/** Short ramps so starting, stopping and fader moves never click. */
const START_FADE_SECONDS = 0.1
const FADER_RAMP_SECONDS = 0.05

interface NoiseLayer {
  player: Tone.Player
  gain: Tone.Gain
}

interface Graph {
  master: Tone.Gain
  analyser: Tone.Analyser
  layers: Record<NoiseColor, NoiseLayer>
}

let graph: Graph | null = null
let graphSeed: number | null = null

function createNoiseLayer(seed: number, color: NoiseColor, master: Tone.Gain): NoiseLayer {
  // Generate at the context's real rate (44.1 kHz, 48 kHz, ...) so no resampling happens.
  const { left, right } = generateNoiseLoop({
    seed,
    color,
    sampleRate: Tone.getContext().sampleRate,
  })
  const buffer = Tone.ToneAudioBuffer.fromArray([left, right])
  const player = new Tone.Player({
    url: buffer,
    loop: true,
    fadeIn: START_FADE_SECONDS,
    fadeOut: START_FADE_SECONDS,
  })
  const gain = new Tone.Gain(0)
  player.chain(gain, master)
  return { player, gain }
}

function buildGraph(seed: number): Graph {
  const master = new Tone.Gain(1).toDestination()
  // Tap the master output so tests (and later the visualizer) can inspect it.
  const analyser = new Tone.Analyser('waveform', 1024)
  master.connect(analyser)
  return {
    master,
    analyser,
    layers: { brown: createNoiseLayer(seed, 'brown', master) },
  }
}

function disposeGraph(g: Graph): void {
  for (const layer of Object.values(g.layers)) {
    layer.player.dispose()
    layer.gain.dispose()
  }
  g.analyser.dispose()
  g.master.dispose()
}

export async function startAudio(settings: AmbienceSettings): Promise<void> {
  const { seed } = settings
  // Browsers only allow audio after a user gesture; Tone.start() resumes the context.
  await Tone.start()

  if (graph && graphSeed !== seed) {
    disposeGraph(graph)
    graph = null
  }
  if (!graph) {
    graph = buildGraph(seed)
    graphSeed = seed
  }
  // Jump (no ramp) to the current fader levels before any sound starts.
  graph.layers.brown.gain.gain.value = faderToGain(settings.brownLevel)

  for (const { player } of Object.values(graph.layers)) {
    // Buffer position at time t is t mod loop length, so starting at offset 0 is
    // the same as seeking to t = 0. Chunked export (M4) will pass real offsets.
    if (player.state !== 'started') player.start(undefined, 0)
  }
}

export function stopAudio(): void {
  if (!graph) return
  for (const { player } of Object.values(graph.layers)) player.stop()
}

/** Move a layer's fader (position in [0, 1]) while playing. No-op before the first Play. */
export function setLayerLevel(color: NoiseColor, position: number): void {
  graph?.layers[color].gain.gain.rampTo(faderToGain(position), FADER_RAMP_SECONDS)
}

/** Root-mean-square level of the master output right now (0 = silence). */
export function outputRms(): number {
  if (!graph) return 0
  const samples = graph.analyser.getValue() as Float32Array
  let sum = 0
  for (const s of samples) sum += s * s
  return Math.sqrt(sum / samples.length)
}

// Test hook for Playwright: lets e2e tests check that audio is not silent.
if (import.meta.env.DEV) {
  ;(window as unknown as { __musicgen: object }).__musicgen = { outputRms }
}
