import { measureLoudness } from '@/lib/loudness'
import { createRng, deriveSeed } from '@/lib/random'

export type NoiseColor = 'white' | 'pink' | 'brown'

export const NOISE_LOOP_SECONDS = 30

/**
 * Every color is normalized to this perceived loudness (ITU-R BS.1770, LUFS),
 * so equal fader positions sound equally loud. Plain RMS would leave white
 * ~10 dB louder than brown to the ear.
 */
export const NOISE_TARGET_LUFS = -24

export interface NoiseLoopOptions {
  seed: number
  color: NoiseColor
  sampleRate: number
}

export interface NoiseLoop {
  left: Float32Array<ArrayBuffer>
  right: Float32Array<ArrayBuffer>
}

export function generateNoiseLoop({ seed, color, sampleRate }: NoiseLoopOptions): NoiseLoop {
  const length = Math.round(NOISE_LOOP_SECONDS * sampleRate)
  return {
    left: generateChannel(color, deriveSeed(seed, 'noise', color, 0), length, sampleRate),
    right: generateChannel(color, deriveSeed(seed, 'noise', color, 1), length, sampleRate),
  }
}

function generateChannel(
  color: NoiseColor,
  channelSeed: number,
  length: number,
  sampleRate: number,
): Float32Array<ArrayBuffer> {
  const rng = createRng(channelSeed)
  const fadeLength = Math.round(SEAM_FADE_SECONDS * sampleRate)
  // Generate a little extra past the loop end; it gets folded onto the start.
  const raw = new Float32Array(length + fadeLength)
  for (let i = 0; i < raw.length; i++) raw[i] = rng() * 2 - 1
  shape(color, raw, sampleRate)
  const out = crossfadeSeam(raw, length, fadeLength)
  removeDc(out)
  normalizeLoudness(out, sampleRate)
  return out
}

/**
 * Integrated noise doesn't end where it started, so a naive loop would click.
 * The samples just past the loop end are the natural continuation of the last
 * sample, so we fade them in over the loop start: at index 0 the output equals
 * raw[length] (seamless with raw[length - 1]), and by the end of the fade it's
 * back to the original head.
 */
const SEAM_FADE_SECONDS = 0.08

function crossfadeSeam(
  raw: Float32Array<ArrayBuffer>,
  length: number,
  fadeLength: number,
): Float32Array<ArrayBuffer> {
  const out = raw.slice(0, length)
  for (let i = 0; i < fadeLength; i++) {
    // Equal-power curves keep loudness steady when mixing uncorrelated signals.
    const angle = ((i / fadeLength) * Math.PI) / 2
    out[i] = raw[i] * Math.sin(angle) + raw[length + i] * Math.cos(angle)
  }
  return out
}

/** Turn white samples into the requested color, in place. White needs nothing. */
function shape(color: NoiseColor, samples: Float32Array, sampleRate: number): void {
  if (color === 'pink') pinkFilter(samples)
  if (color === 'brown') integrate(samples, sampleRate)
}

/**
 * Pink noise (−3 dB/octave, equal energy per octave) via Paul Kellet's "refined"
 * filter: a sum of one-pole low-passes with staggered corner frequencies that
 * together approximate the 1/f slope within ±0.05 dB. The coefficients were
 * designed for 44.1 kHz; at 48 kHz the corners shift by ~9 %, which is inaudible
 * for noise. Overall gain doesn't matter — the RMS normalization sets the level.
 */
function pinkFilter(samples: Float32Array): void {
  let b0 = 0
  let b1 = 0
  let b2 = 0
  let b3 = 0
  let b4 = 0
  let b5 = 0
  let b6 = 0
  for (let i = 0; i < samples.length; i++) {
    const white = samples[i]
    b0 = 0.99886 * b0 + white * 0.0555179
    b1 = 0.99332 * b1 + white * 0.0750759
    b2 = 0.969 * b2 + white * 0.153852
    b3 = 0.8665 * b3 + white * 0.3104856
    b4 = 0.55 * b4 + white * 0.5329522
    b5 = -0.7616 * b5 - white * 0.016898
    samples[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362
    b6 = white * 0.115926
  }
}

/**
 * Brown noise = integrated white noise (−6 dB/octave). A pure integrator drifts
 * without bound, so we use a "leaky" one: each step keeps slightly less than
 * all of the previous value, which flattens the spectrum below LEAK_HZ.
 */
const LEAK_HZ = 20

function integrate(samples: Float32Array, sampleRate: number): void {
  const leak = Math.exp((-2 * Math.PI * LEAK_HZ) / sampleRate)
  let y = 0
  for (let i = 0; i < samples.length; i++) {
    y = leak * y + samples[i]
    samples[i] = y
  }
}

function removeDc(samples: Float32Array): void {
  let sum = 0
  for (const s of samples) sum += s
  const offset = sum / samples.length
  for (let i = 0; i < samples.length; i++) samples[i] -= offset
}

function normalizeLoudness(samples: Float32Array, sampleRate: number): void {
  const current = measureLoudness(samples, sampleRate)
  if (current === -Infinity) return
  const scale = 10 ** ((NOISE_TARGET_LUFS - current) / 20)
  for (let i = 0; i < samples.length; i++) samples[i] *= scale
}
