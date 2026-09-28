/**
 * FNV-1a (32-bit) constants: a tiny, well-known non-cryptographic hash.
 * Hash = offset basis; for each byte: hash ^= byte, hash = Math.imul(hash, prime).
 */
export const FNV_OFFSET_BASIS = 0x811c9dc5
export const FNV_PRIME = 0x01000193
