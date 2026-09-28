/**
 * Small summaries of rendered audio, so two renders can be compared without
 * shipping megabytes of samples around (tests, and later export checks).
 */

/**
 * FNV-1a hash over the exact float32 bit patterns of every sample, channel by
 * channel. Any change, even the last bit of one sample, changes the result.
 * Not cryptographic — just a cheap fingerprint.
 */
export function checksum(channels: readonly Float32Array[]): string {
  let hash = 0x811c9dc5
  for (const channel of channels) {
    const bits = new Uint32Array(channel.buffer, channel.byteOffset, channel.length)
    for (const word of bits) {
      // Feed the 32-bit word one byte at a time, as FNV-1a expects.
      for (let shift = 0; shift < 32; shift += 8) {
        hash ^= (word >>> shift) & 0xff
        hash = Math.imul(hash, 0x01000193)
      }
    }
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/** Root-mean-square level over every sample of every channel (0 = silence). */
export function rms(channels: readonly Float32Array[]): number {
  let sum = 0
  let count = 0
  for (const channel of channels) {
    for (const s of channel) sum += s * s
    count += channel.length
  }
  return count === 0 ? 0 : Math.sqrt(sum / count)
}
