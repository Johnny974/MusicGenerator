/**
 * Perceived loudness per ITU-R BS.1770 (the measure behind "LUFS"), for one channel.
 *
 * Plain RMS treats all frequencies alike, but hearing doesn't: at equal RMS,
 * white noise (lots of treble) sounds much louder than brown noise (mostly
 * bass). BS.1770 first "K-weights" the signal — a high shelf that boosts
 * treble ~4 dB (the head's acoustic effect) and a high-pass that discards
 * deep bass (~38 Hz and below) — and then takes the mean square.
 *
 * Gating (ignoring quiet passages) is left out: our noise is steady, so it
 * wouldn't change anything.
 */

interface Biquad {
  b0: number
  b1: number
  b2: number
  a1: number
  a2: number
}

// Filter design from libebur128: bilinear-transform biquads whose parameters
// reproduce the BS.1770 48 kHz coefficient table exactly. Designing from these
// (instead of hardcoding the table) works at any sample rate.
const SHELF_HZ = 1681.974450955533
const SHELF_GAIN_DB = 3.999843853973347
const SHELF_Q = 0.7071752369554196
const HIGHPASS_HZ = 38.13547087602444
const HIGHPASS_Q = 0.5003270373238773

/** Stage 1: high shelf, +4 dB above ~1.7 kHz. */
function highShelf(sampleRate: number): Biquad {
  const K = Math.tan((Math.PI * SHELF_HZ) / sampleRate)
  const Vh = 10 ** (SHELF_GAIN_DB / 20)
  const Vb = Vh ** 0.4996667741545416
  const a0 = 1 + K / SHELF_Q + K * K
  return {
    b0: (Vh + (Vb * K) / SHELF_Q + K * K) / a0,
    b1: (2 * (K * K - Vh)) / a0,
    b2: (Vh - (Vb * K) / SHELF_Q + K * K) / a0,
    a1: (2 * (K * K - 1)) / a0,
    a2: (1 - K / SHELF_Q + K * K) / a0,
  }
}

/** Stage 2: high-pass at ~38 Hz. BS.1770 uses the unnormalized numerator (1, −2, 1). */
function highPass(sampleRate: number): Biquad {
  const K = Math.tan((Math.PI * HIGHPASS_HZ) / sampleRate)
  const a0 = 1 + K / HIGHPASS_Q + K * K
  return {
    b0: 1,
    b1: -2,
    b2: 1,
    a1: (2 * (K * K - 1)) / a0,
    a2: (1 - K / HIGHPASS_Q + K * K) / a0,
  }
}

/** Run a biquad over the samples (direct form I), returning a new array. */
function applyBiquad({ b0, b1, b2, a1, a2 }: Biquad, input: ArrayLike<number>): Float64Array {
  const out = new Float64Array(input.length)
  let x1 = 0
  let x2 = 0
  let y1 = 0
  let y2 = 0
  for (let i = 0; i < input.length; i++) {
    const x = input[i]
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
    x2 = x1
    x1 = x
    y2 = y1
    y1 = y
    out[i] = y
  }
  return out
}

/** Loudness of one channel in LUFS (−Infinity for silence). */
export function measureLoudness(samples: Float32Array, sampleRate: number): number {
  const shelved = applyBiquad(highShelf(sampleRate), samples)
  const weighted = applyBiquad(highPass(sampleRate), shelved)
  let sum = 0
  for (const s of weighted) sum += s * s
  const meanSquare = sum / weighted.length
  // −0.691 makes a 1 kHz sine read the same in LUFS as its RMS level in dBFS + 3.01.
  return -0.691 + 10 * Math.log10(meanSquare)
}
