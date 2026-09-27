import * as Tone from 'tone'
import { generateNoiseLoop, type NoiseColor } from '@/generators/noise'
import { faderToGain } from '@/lib/fader'
import type { AmbienceSettings } from '@/lib/settings'

/**
 * Audio engine: turns generator output into sound.
 *
 * Signal graph (master built on first Play, layers added on demand):
 *
 *   white player (looped seeded buffer) → layer gain (fader) ─┐
 *   pink player                         → layer gain (fader) ─┼→ master gain → destination
 *   brown player                        → layer gain (fader) ─┘        └→ analyser (tests / visualizer)
 *
 * A layer whose fader is at 0 has its player stopped (or never created), so it
 * costs no CPU. Raising the fader creates/starts it; lowering to 0 stops it.
 */

/** Short ramps so starting, stopping and fader moves never click. */
const START_FADE_SECONDS = 0.1
const FADER_RAMP_SECONDS = 0.05

interface NoiseLayer {
  player: Tone.Player
  gain: Tone.Gain
}

interface Graph {
  seed: number
  master: Tone.Gain
  analyser: Tone.Analyser
  /** Only layers that have been raised above 0 at least once exist here. */
  layers: Partial<Record<NoiseColor, NoiseLayer>>
}

let graph: Graph | null = null
/** True between Play and Stop. Fader moves only start players while playing. */
let playing = false

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
  return { seed, master, analyser, layers: {} }
}

function disposeGraph(g: Graph): void {
  for (const layer of Object.values(g.layers)) {
    layer.player.dispose()
    layer.gain.dispose()
  }
  g.analyser.dispose()
  g.master.dispose()
}

/**
 * Bring one layer to a fader position while playing: start it if it's coming
 * in from 0, ramp it if it's already running, stop it when it reaches 0.
 */
function applyLevel(g: Graph, color: NoiseColor, position: number): void {
  const target = faderToGain(position)
  let layer = g.layers[color]

  if (position <= 0) {
    if (layer?.player.state === 'started') {
      layer.gain.gain.rampTo(0, FADER_RAMP_SECONDS)
      // The player's own fadeOut smooths the stop, so this can happen right away.
      layer.player.stop()
    }
    return
  }

  layer ??= g.layers[color] = createNoiseLayer(g.seed, color, g.master)
  if (layer.player.state === 'started') {
    layer.gain.gain.rampTo(target, FADER_RAMP_SECONDS)
  } else {
    // Jump (no ramp) to the level; the player's fadeIn brings the sound in smoothly.
    layer.gain.gain.cancelScheduledValues(Tone.now())
    layer.gain.gain.value = target
    // Buffer position at time t is t mod loop length, so starting at offset 0 is
    // the same as seeking to t = 0. Chunked export (M4) will pass real offsets.
    layer.player.start(undefined, 0)
  }
}

export async function startAudio(settings: AmbienceSettings): Promise<void> {
  // Browsers only allow audio after a user gesture; Tone.start() resumes the context.
  await Tone.start()

  if (graph && graph.seed !== settings.seed) {
    disposeGraph(graph)
    graph = null
  }
  graph ??= buildGraph(settings.seed)
  playing = true

  for (const [color, position] of Object.entries(settings.levels)) {
    applyLevel(graph, color as NoiseColor, position)
  }
}

export function stopAudio(): void {
  playing = false
  if (!graph) return
  for (const { player } of Object.values(graph.layers)) player.stop()
}

/** Move a layer's fader (position in [0, 1]). No-op while stopped; Play applies all levels. */
export function setLayerLevel(color: NoiseColor, position: number): void {
  if (graph && playing) applyLevel(graph, color, position)
}

/** Colors whose players are currently running (for tests: layers at 0 must not run). */
export function activeLayers(): NoiseColor[] {
  if (!graph) return []
  return (Object.entries(graph.layers) as [NoiseColor, NoiseLayer][])
    .filter(([, layer]) => layer.player.state === 'started')
    .map(([color]) => color)
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
  ;(window as unknown as { __musicgen: object }).__musicgen = { outputRms, activeLayers }
}
