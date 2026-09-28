import * as Tone from 'tone'
import { generateNoiseLoop, type NoiseColor } from '@/generators/noise'
import { NOISE_LAYERS } from '@/lib/settings'
import { createMixer, type Mixer } from '@/audio/mixer'

export interface NoiseLayer {
  player: Tone.Player
  gain: Tone.Gain
  dispose(): void
}

export interface NoiseLayerOptions {
  seed: number
  color: NoiseColor
  /** Where the layer's signal goes: its slot in the noise mixer. */
  output: Tone.InputNode
  /** Where to build the nodes: the live context or an offline one. */
  context: Tone.BaseContext
  /**
   * The player's own fade when it starts or stops. Live playback needs it so a
   * fader crossing 0 doesn't click; an offline render starts mid-stream and
   * must not fade (0).
   */
  sourceFadeSeconds: number
}

/**
 * One noise color: a looped seeded buffer through its own gain into `output`.
 * The gain starts at 0; the caller sets the level.
 */
export function createNoiseLayer({
  seed,
  color,
  output,
  context,
  sourceFadeSeconds,
}: NoiseLayerOptions): NoiseLayer {
  // Generate at the context's real rate (44.1 kHz, 48 kHz, ...) so no resampling happens.
  const { left, right } = generateNoiseLoop({ seed, color, sampleRate: context.sampleRate })
  // Built by hand rather than ToneAudioBuffer.fromArray, which always uses the
  // global context's sample rate even when rendering offline at another rate.
  const audioBuffer = context.createBuffer(2, left.length, context.sampleRate)
  audioBuffer.copyToChannel(left, 0)
  audioBuffer.copyToChannel(right, 1)
  const player = new Tone.Player({
    context,
    url: new Tone.ToneAudioBuffer(audioBuffer),
    loop: true,
    fadeIn: sourceFadeSeconds,
    fadeOut: sourceFadeSeconds,
  })
  const gain = new Tone.Gain({ context, gain: 0 })
  player.chain(gain, output)
  return {
    player,
    gain,
    dispose() {
      player.dispose()
      gain.dispose()
    },
  }
}

/** Fixed mixing order for the noise layers, so mixes are bit-for-bit repeatable. */
export interface NoiseMixer {
  /** The mixer slot a layer of this color connects to. */
  input(color: NoiseColor): Tone.InputNode
  dispose(): void
}

export function createNoiseMixer(output: Tone.InputNode, context: Tone.BaseContext): NoiseMixer {
  const mixer: Mixer = createMixer(NOISE_LAYERS.length, output, context)
  return {
    input: (color) => mixer.inputs[NOISE_LAYERS.findIndex((layer) => layer.color === color)],
    dispose: () => mixer.dispose(),
  }
}
