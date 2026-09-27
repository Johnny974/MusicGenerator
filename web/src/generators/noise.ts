import { createRng, deriveSeed } from '@/lib/random'

export type NoiseColor = 'brown'

export const NOISE_LOOP_SECONDS = 30

export const NOISE_TARGET_RMS = 0.1

export interface NoiseLoopOptions {
  seed: number
  color: NoiseColor
  sampleRate: number
}

export interface NoiseLoop {
  left: Float32Array
  right: Float32Array
}

export function generateNoiseLoop({ seed, color, sampleRate }: NoiseLoopOptions): NoiseLoop {
  const length = Math.round(NOISE_LOOP_SECONDS * sampleRate)
  return {
    left: generateChannel(deriveSeed(seed, 'noise', color, 0), length, sampleRate),
    right: generateChannel(deriveSeed(seed, 'noise', color, 1), length, sampleRate),
  }
}

function generateChannel(channelSeed: number, length: number, sampleRate: number): Float32Array {
  const rng = createRng(channelSeed)
  const fadeLength = Math.round(SEAM_FADE_SECONDS * sampleRate)
  // Generate a little extra past the loop end; it gets folded onto the start.
  const raw = new Float32Array(length + fadeLength)
  for (let i = 0; i < raw.length; i++) raw[i] = rng() * 2 - 1
  integrate(raw, sampleRate)
  const out = crossfadeSeam(raw, length, fadeLength)
  removeDc(out)
  normalizeRms(out, NOISE_TARGET_RMS)
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

function crossfadeSeam(raw: Float32Array, length: number, fadeLength: number): Float32Array {
  const out = raw.slice(0, length)
  for (let i = 0; i < fadeLength; i++) {
    // Equal-power curves keep loudness steady when mixing uncorrelated signals.
    const angle = ((i / fadeLength) * Math.PI) / 2
    out[i] = raw[i] * Math.sin(angle) + raw[length + i] * Math.cos(angle)
  }
  return out
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

function normalizeRms(samples: Float32Array, target: number): void {
  let sum = 0
  for (const s of samples) sum += s * s
  const current = Math.sqrt(sum / samples.length)
  if (current === 0) return
  const scale = target / current
  for (let i = 0; i < samples.length; i++) samples[i] *= scale
}
