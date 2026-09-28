import { describe, expect, it } from 'vitest'
import { checksum, rms } from '@/lib/samples'

describe('checksum', () => {
  it('is the same for equal samples', () => {
    const a = [new Float32Array([0.1, -0.2, 0.3]), new Float32Array([0.5, 0, -1])]
    const b = [new Float32Array([0.1, -0.2, 0.3]), new Float32Array([0.5, 0, -1])]
    expect(checksum(a)).toBe(checksum(b))
  })

  it('changes when a single sample changes by one float step', () => {
    const a = new Float32Array([0.1, -0.2, 0.3])
    const b = a.slice()
    // Smallest float32 change: bump the bit pattern by one.
    new Uint32Array(b.buffer)[1] += 1
    expect(checksum([a])).not.toBe(checksum([b]))
  })

  it('depends on channel order', () => {
    const left = new Float32Array([0.1, 0.2])
    const right = new Float32Array([0.3, 0.4])
    expect(checksum([left, right])).not.toBe(checksum([right, left]))
  })

  it('is an 8-digit hex string', () => {
    expect(checksum([new Float32Array([0.25])])).toMatch(/^[0-9a-f]{8}$/)
  })
})

describe('rms', () => {
  it('is 0 for silence', () => {
    expect(rms([new Float32Array(4)])).toBe(0)
  })

  it('averages over every sample of every channel', () => {
    expect(rms([new Float32Array([1, -1]), new Float32Array([1, -1])])).toBeCloseTo(1)
    expect(rms([new Float32Array([1, 1]), new Float32Array([0, 0])])).toBeCloseTo(Math.SQRT1_2)
  })
})
