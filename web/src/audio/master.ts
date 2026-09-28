import * as Tone from 'tone'
import { faderToGain } from '@/lib/fader'
import { EQ_BANDS, type EqBand, type MasterSettings } from '@/lib/settings'

/**
 * Master section: everything the whole mix passes through before the speakers.
 *
 *   input → low shelf → mid peak → high shelf → volume → destination
 *                                                  └→ analyser (tests / visualizer)
 *
 * The EQ is three plain biquads rather than Tone.EQ3: EQ3 splits the signal
 * into bands with crossover filters and sums them back, which is not perfectly
 * flat. A shelf or peaking biquad at 0 dB is an exact pass-through, so a flat
 * EQ sounds identical to no EQ.
 *
 * The analyser sits after the volume so tests see what the listener hears.
 */

/** Short ramp so knob and fader moves never click. */
const RAMP_SECONDS = 0.05

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
  /** Root-mean-square level of the master output right now (0 = silence). */
  rms(): number
  dispose(): void
}

export function createMasterBus(settings: MasterSettings): MasterBus {
  const input = new Tone.Gain(1)
  const filters = {} as Record<EqBand, Tone.Filter>
  for (const { band } of EQ_BANDS) {
    filters[band] = new Tone.Filter({
      ...BAND_FILTERS[band],
      gain: settings.eq[band],
      // -12 dB/oct is a single biquad; steeper rolloffs cascade several.
      rolloff: -12,
    })
  }
  const volume = new Tone.Gain(faderToGain(settings.volume))
  const analyser = new Tone.Analyser('waveform', 1024)

  input.chain(filters.low, filters.mid, filters.high, volume, Tone.getDestination())
  volume.connect(analyser)

  const bus: MasterBus = {
    input,
    setEq(band, db) {
      // Linear: rampTo would pick an exponential ramp for dB, which breaks crossing 0.
      filters[band].gain.linearRampTo(db, RAMP_SECONDS)
    },
    setVolume(position) {
      volume.gain.rampTo(faderToGain(position), RAMP_SECONDS)
    },
    apply({ eq, volume: position }) {
      for (const { band } of EQ_BANDS) bus.setEq(band, eq[band])
      bus.setVolume(position)
    },
    rms() {
      const samples = analyser.getValue() as Float32Array
      let sum = 0
      for (const s of samples) sum += s * s
      return Math.sqrt(sum / samples.length)
    },
    dispose() {
      for (const node of [input, ...Object.values(filters), volume, analyser]) node.dispose()
    },
  }
  return bus
}
