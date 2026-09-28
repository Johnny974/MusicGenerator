import * as Tone from 'tone'
import { faderToGain } from '@/lib/fader'
import { rms as rmsOf } from '@/lib/samples'
import { EQ_BANDS, type EqBand, type MasterSettings } from '@/lib/settings'
import { PARAM_RAMP_SECONDS } from '@/audio/fades'

/**
 * Master section: everything the whole mix passes through before the speakers.
 *
 *   input → low shelf → mid peak → high shelf → volume → fade → destination
 *                                                           └→ analyser (tests / visualizer)
 *
 * The EQ is three plain biquads rather than Tone.EQ3: EQ3 splits the signal
 * into bands with crossover filters and sums them back, which is not perfectly
 * flat. A shelf or peaking biquad at 0 dB is an exact pass-through, so a flat
 * EQ sounds identical to no EQ.
 *
 * `volume` is the user's master fader; `fade` is the transport's own gain for
 * fade-in on Play and fade-out on Stop. Keeping them separate means a fade never
 * fights with (or forgets) the fader position.
 *
 * The analyser sits after the fade so tests see what the listener hears.
 *
 * Every node is built in the Tone context passed in, never the global one, so the
 * same bus works live and inside an offline render (src/audio/offline.ts).
 */

/**
 * Shelf corner / peak centre frequencies, in Hz. The high corner sits fairly low
 * so cutting High audibly darkens brown noise, whose energy fades above ~2 kHz.
 */
const BAND_FILTERS: Record<EqBand, { type: BiquadFilterType; frequency: number }> = {
  low: { type: 'lowshelf', frequency: 250 },
  mid: { type: 'peaking', frequency: 1000 },
  high: { type: 'highshelf', frequency: 2500 },
}

export interface MasterBus {
  /** Connect sources here. */
  input: Tone.Gain
  setEq(band: EqBand, db: number): void
  /** Fader position in [0, 1]. */
  setVolume(position: number): void
  /** Move every EQ band and the volume to `settings`. */
  apply(settings: MasterSettings): void
  /** Ramp the whole mix from wherever it is now up to full over `seconds`. */
  fadeIn(seconds: number): void
  /** Ramp the whole mix from wherever it is now down to silence over `seconds`. */
  fadeOut(seconds: number): void
  /** Root-mean-square level of the master output right now (0 = silence). */
  rms(): number
  dispose(): void
}

export interface MasterBusOptions {
  /** Where to build the nodes. Default: the live context. */
  context?: Tone.BaseContext
  /**
   * Live playback starts silent and waits for fadeIn. An offline render has no
   * transport, so it starts at full level. Default: true.
   */
  startSilent?: boolean
}

export function createMasterBus(
  settings: MasterSettings,
  { context = Tone.getContext(), startSilent = true }: MasterBusOptions = {},
): MasterBus {
  const input = new Tone.Gain({ context, gain: 1 })
  const filters = {} as Record<EqBand, Tone.Filter>
  for (const { band } of EQ_BANDS) {
    filters[band] = new Tone.Filter({
      context,
      ...BAND_FILTERS[band],
      gain: settings.eq[band],
      // -12 dB/oct is a single biquad; steeper rolloffs cascade several.
      rolloff: -12,
    })
  }
  const volume = new Tone.Gain({ context, gain: faderToGain(settings.volume) })
  const fade = new Tone.Gain({ context, gain: startSilent ? 0 : 1 })
  const analyser = new Tone.Analyser({ context, type: 'waveform', size: 1024 })

  input.chain(filters.low, filters.mid, filters.high, volume, fade, context.destination)
  fade.connect(analyser)

  const bus: MasterBus = {
    input,
    setEq(band, db) {
      // Linear: rampTo would pick an exponential ramp for dB, which breaks crossing 0.
      filters[band].gain.linearRampTo(db, PARAM_RAMP_SECONDS)
    },
    setVolume(position) {
      volume.gain.rampTo(faderToGain(position), PARAM_RAMP_SECONDS)
    },
    apply({ eq, volume: position }) {
      for (const { band } of EQ_BANDS) bus.setEq(band, eq[band])
      bus.setVolume(position)
    },
    // linearRampTo first holds the value the gain has right now and cancels any
    // ramp still in progress, so a fade can reverse mid-way without a jump.
    // Linear (not exponential) so the fade-out lands on true silence.
    fadeIn(seconds) {
      fade.gain.linearRampTo(1, seconds)
    },
    fadeOut(seconds) {
      fade.gain.linearRampTo(0, seconds)
    },
    rms() {
      return rmsOf([analyser.getValue() as Float32Array])
    },
    dispose() {
      for (const node of [input, ...Object.values(filters), volume, fade, analyser]) node.dispose()
    },
  }
  return bus
}
