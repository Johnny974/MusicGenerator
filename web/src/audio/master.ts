import * as Tone from 'tone'
import { fadeInGain, fadeInProgress } from '@/lib/fade'
import { faderToGain } from '@/lib/fader'
import { softClip } from '@/lib/limiter'
import { rms as rmsOf } from '@/lib/samples'
import { EQ_BANDS, type EqBand, type MasterSettings } from '@/lib/settings'
import { PARAM_RAMP_SECONDS } from '@/audio/fades'

/**
 * Master section: everything the whole mix passes through before the speakers.
 *
 *   input → low shelf → mid peak → high shelf → volume → limiter → fade → destination
 *                                                                     └→ analyser (tests / visualizer)
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
 * The limiter keeps the mix under full scale however the knobs are set: three
 * layers at full plus +12 dB of EQ would otherwise clip. It sits before `fade`
 * so a fade-out still ends on true silence.
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

/**
 * The limiter's curve covers input levels up to ±LIMITER_HEADROOM (+12 dBFS).
 * A WaveShaper only reads inputs in [-1, 1], so the signal is scaled down by this
 * much on the way in and the curve scales it back up. Louder input than that is
 * still safe: the shaper holds the curve's last value, which is under the ceiling.
 */
const LIMITER_HEADROOM = 4
/** Curve points. Odd, so 0 lands exactly on a point; dense enough for a smooth knee. */
const LIMITER_CURVE_LENGTH = 4097

/** How many points sample the full fade-in curve (fewer when resuming part-way). */
const FADE_IN_CURVE_POINTS = 64

export interface MasterBus {
  /** Connect sources here. */
  input: Tone.Gain
  setEq(band: EqBand, db: number): void
  /** Fader position in [0, 1]. */
  setVolume(position: number): void
  /** Move every EQ band and the volume to `settings`. */
  apply(settings: MasterSettings): void
  /**
   * Bring the whole mix up to full along the fade-in curve (src/lib/fade.ts), which
   * takes `seconds` from silence. From part-way up (Play during a Stop fade-out) it
   * continues from the current level and takes only the remaining share.
   */
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
  // A limiter built from a fixed curve rather than Tone.Limiter: Tone.Limiter wraps
  // the native DynamicsCompressorNode, which let a worst-case mix (every layer and
  // EQ band at full) through at +8.5 dBFS — its ratio and attack are too soft to
  // hold a ceiling. A WaveShaper has no memory, so it is also exactly the same in
  // a chunked offline render, and below its knee it is an exact pass-through.
  // No oversampling: that adds filters (state, latency); the aliasing from the
  // gentle knee is inaudible on noise.
  const limiterDrive = new Tone.Gain({ context, gain: 1 / LIMITER_HEADROOM })
  const limiter = new Tone.WaveShaper({
    context,
    mapping: (x) => softClip(x * LIMITER_HEADROOM),
    length: LIMITER_CURVE_LENGTH,
  })
  const fade = new Tone.Gain({ context, gain: startSilent ? 0 : 1 })
  const analyser = new Tone.Analyser({ context, type: 'waveform', size: 1024 })

  const series = [
    input,
    filters.low,
    filters.mid,
    filters.high,
    volume,
    limiterDrive,
    limiter,
    fade,
  ]
  Tone.connectSeries(...series, context.destination)
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
    fadeIn(seconds) {
      // Hold the level the gain has right now (cancelling any fade still running),
      // then find where that level sits on the fade-in curve and play the rest.
      const now = fade.now()
      const current = fade.gain.getValueAtTime(now)
      fade.gain.cancelAndHoldAtTime(now)
      const from = fadeInProgress(current)
      if (from >= 1) return
      const points = Math.max(2, Math.ceil(FADE_IN_CURVE_POINTS * (1 - from)) + 1)
      const curve = Array.from({ length: points }, (_, i) =>
        // Start exactly at the held level, even below the curve's floor: no step.
        i === 0 ? current : fadeInGain(from + ((1 - from) * i) / (points - 1)),
      )
      fade.gain.setValueCurveAtTime(curve, now, (1 - from) * seconds)
    },
    // linearRampTo first holds the value the gain has right now and cancels any
    // fade still in progress, so Stop during a fade-in reverses without a jump.
    // Linear (not exponential) so the fade-out lands on true silence; it is short,
    // so its shape matters much less than the fade-in's.
    fadeOut(seconds) {
      fade.gain.linearRampTo(0, seconds)
    },
    rms() {
      return rmsOf([analyser.getValue() as Float32Array])
    },
    dispose() {
      for (const node of [...series, analyser]) node.dispose()
    },
  }
  return bus
}
