import * as Tone from 'tone'
import type { NoiseColor } from '@/generators/noise'
import { faderToGain } from '@/lib/fader'
import type { AmbienceSettings, EqBand } from '@/lib/settings'
import type { NoiseLayer } from '@/audio/layer'
import { buildGraph, disposeGraph, startLayer, type Graph } from '@/audio/graph'
import { renderOffline, renderOfflineSamples } from '@/audio/offline'
import { FADE_IN_SECONDS, PARAM_RAMP_SECONDS, STOP_FADE_SECONDS } from '@/audio/fades'

/**
 * Audio engine: live playback of the Ambience graph (graph.ts).
 *
 * The master bus lives in master.ts so the Lofi page can reuse it.
 *
 * A layer whose fader is at 0 has its player stopped (or never created), so it
 * costs no CPU. Raising the fader creates/starts it; lowering to 0 stops it.
 *
 * Transport: Play fades the master bus in; Stop fades it out and only stops the
 * players once the fade has finished. Pressing Play during that fade-out cancels
 * the pending stop and fades back up from wherever the level is — the players
 * never stopped, so there is nothing to restart and nothing to click.
 */

let graph: Graph | null = null
/** True between Play and Stop. Fader moves only start players while playing. */
let playing = false
/**
 * Bumped by every Play and Stop. startAudio has to await the browser before it
 * can build anything; if a Stop (or a newer Play) happened meanwhile, the
 * number has moved on and the stale start gives up instead of playing anyway.
 */
let transportRequest = 0
/** Tone timer that stops the players once a Stop fade-out has finished. */
let pendingStop: number | undefined

function cancelPendingStop(): void {
  if (pendingStop !== undefined) Tone.getContext().clearTimeout(pendingStop)
  pendingStop = undefined
}

/**
 * Bring one layer to a fader position while playing: start it if it's coming
 * in from 0, ramp it if it's already running, stop it when it reaches 0.
 */
function applyLevel(g: Graph, color: NoiseColor, position: number): void {
  if (position <= 0) {
    const layer = g.layers[color]
    if (layer?.player.state === 'started') {
      layer.gain.gain.rampTo(0, PARAM_RAMP_SECONDS)
      // The player's own fadeOut smooths the stop, so this can happen right away.
      layer.player.stop()
    }
    return
  }

  const layer = g.layers[color]
  if (layer?.player.state === 'started') {
    layer.gain.gain.rampTo(faderToGain(position), PARAM_RAMP_SECONDS)
  } else {
    // Live playback doesn't track a timeline position yet, so a layer always
    // (re)starts at the top of its loop. Offline renders seek with t mod loop
    // length (offline.ts).
    startLayer(g, color, position, 0)
  }
}

export async function startAudio(settings: AmbienceSettings): Promise<void> {
  const request = ++transportRequest
  // Browsers only allow audio after a user gesture; Tone.start() resumes the context.
  await Tone.start()
  // E.g. the page unmounted (calling stopAudio) while we were waiting.
  if (request !== transportRequest) return
  cancelPendingStop()

  if (graph && graph.seed !== settings.seed) {
    disposeGraph(graph)
    graph = null
  }
  if (graph) {
    // Master knobs may have moved while no graph existed to hear them.
    graph.master.apply(settings.master)
  } else {
    graph = buildGraph(settings)
  }
  playing = true

  for (const [color, position] of Object.entries(settings.levels)) {
    applyLevel(graph, color as NoiseColor, position)
  }
  graph.master.fadeIn(FADE_IN_SECONDS)
}

/** Fade the mix out, then stop every player. Play during the fade cancels the stop. */
export function stopAudio(): void {
  transportRequest++
  playing = false
  if (!graph) return
  graph.master.fadeOut(STOP_FADE_SECONDS)
  cancelPendingStop()
  // Capture the graph now: by the time the timer fires, Play with a new seed
  // could have replaced `graph`, and those new players must not be stopped.
  const stopping = graph
  // Tone's timer runs on the audio clock, the same clock the fade is scheduled on,
  // so it fires when the fade has really finished even if the page is busy.
  pendingStop = Tone.getContext().setTimeout(() => {
    pendingStop = undefined
    for (const { player } of Object.values(stopping.layers)) player.stop()
  }, STOP_FADE_SECONDS)
}

/** Move a layer's fader (position in [0, 1]). No-op while stopped; Play applies all levels. */
export function setLayerLevel(color: NoiseColor, position: number): void {
  if (graph && playing) applyLevel(graph, color, position)
}

/** Master EQ band gain in dB (±12). Applies whenever a graph exists, playing or not. */
export function setMasterEq(band: EqBand, db: number): void {
  graph?.master.setEq(band, db)
}

/** Master fader position in [0, 1]; 0 silences the whole mix. */
export function setMasterVolume(position: number): void {
  graph?.master.setVolume(position)
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
  return graph?.master.rms() ?? 0
}

// Test hooks for Playwright: live output level, running layers, offline renders.
if (import.meta.env.DEV) {
  ;(window as unknown as { __musicgen: object }).__musicgen = {
    outputRms,
    activeLayers,
    renderOffline,
    renderOfflineSamples,
  }
}
