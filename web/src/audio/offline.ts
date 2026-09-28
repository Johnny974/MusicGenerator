import * as Tone from 'tone'
import { faderToGain } from '@/lib/fader'
import { checksum, rms } from '@/lib/samples'
import { NOISE_LAYERS, type AmbienceSettings } from '@/lib/settings'
import { buildGraph, disposeGraph, getLayer } from '@/audio/graph'

/**
 * Offline rendering: the same graph the live engine plays (graph.ts), built
 * inside its own Tone.OfflineContext and rendered as fast as the
 * machine allows, with no speakers. This is the seam M4's WAV export builds on.
 *
 * The render runs in a private context, never the global one, so it can happen
 * while live playback is running without disturbing it.
 *
 * Seeking: a noise layer's buffer position at time t is t mod loop length, so
 * rendering "2 s starting at t = 45 s" just starts each player at that offset.
 *
 * Pre-roll: the EQ filters remember recent samples. A render that starts at t
 * with empty filters would differ from the same moment in a longer render for
 * the first few milliseconds. So every render actually starts PRE_ROLL_SECONDS
 * earlier (wrapping round the loop if t is near 0) and throws that part away;
 * by then the filters hold the same state either way, and chunks line up.
 * (So offline t = 0 is mid-stream, not a live Play from silence — that's what
 * an export wants.)
 */

/** Long enough for the slowest EQ filter (250 Hz shelf) to forget its start. */
const PRE_ROLL_SECONDS = 0.5

export const DEFAULT_OFFLINE_SAMPLE_RATE = 48000

export interface OfflineRenderOptions {
  settings: AmbienceSettings
  /** Seconds of audio to return. */
  duration: number
  /** Timeline position of the first returned sample, in seconds. Default 0. */
  start?: number
  sampleRate?: number
}

export interface RenderedAudio {
  left: Float32Array
  right: Float32Array
  sampleRate: number
}

/** Render a stretch of the Ambience mix offline and return the raw stereo samples. */
export async function renderOfflineSamples({
  settings,
  duration,
  start = 0,
  sampleRate = DEFAULT_OFFLINE_SAMPLE_RATE,
}: OfflineRenderOptions): Promise<RenderedAudio> {
  // Work in whole samples so a chunk boundary never falls between two samples.
  const preRollSamples = Math.round(PRE_ROLL_SECONDS * sampleRate)
  const outputSamples = Math.round(duration * sampleRate)
  const firstSample = Math.round(start * sampleRate) - preRollSamples

  const context = new Tone.OfflineContext(
    2,
    (preRollSamples + outputSamples) / sampleRate,
    sampleRate,
  )
  const graph = buildGraph(settings, { context, offline: true })
  for (const { color } of NOISE_LAYERS) {
    const position = settings.levels[color]
    // Same rule as live playback: a layer at 0 isn't built at all.
    if (position <= 0) continue
    const layer = getLayer(graph, color)
    layer.gain.gain.value = faderToGain(position)
    const loopSamples = layer.player.buffer.length
    // `%` keeps the sign in JS, so add the loop once more to wrap negatives.
    const offsetSamples = ((firstSample % loopSamples) + loopSamples) % loopSamples
    layer.player.start(0, offsetSamples / sampleRate)
  }

  const rendered = await context.render()
  disposeGraph(graph)
  context.dispose()

  return {
    left: rendered.getChannelData(0).slice(preRollSamples),
    right: rendered.getChannelData(1).slice(preRollSamples),
    sampleRate,
  }
}

export interface OfflineRenderSummary {
  rms: number
  /** Fingerprint of every sample; equal renders have equal checksums. */
  checksum: string
}

/** Render offline and return only a small, comparable summary. */
export async function renderOffline(options: OfflineRenderOptions): Promise<OfflineRenderSummary> {
  const { left, right } = await renderOfflineSamples(options)
  return { rms: rms([left, right]), checksum: checksum([left, right]) }
}
