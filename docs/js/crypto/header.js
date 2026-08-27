// An 80-byte Bitcoin block header, read.
//
// The explorer's source hands back the raw header and nothing derived from it:
// no difficulty, no target, no confirmation that the hash it reports is the
// hash of what it sent. All three are in those eighty bytes, and this project
// already computes the hard parts elsewhere — so the explorer works them out
// rather than being told, which is the same rule the rest of the game follows.
//
// Layout, little-endian throughout:
//   0..3   version
//   4..35  previous block hash
//   36..67 merkle root
//   68..71 timestamp
//   72..75 bits (the compact target)
//   76..79 nonce
//
// The service appends one varint after those eighty: the number of
// transactions in the block. It has no endpoint that reports that number, so
// this is the only place it can be read from.

import { hash256, toHex } from './hash.js';

export const HEADER_BYTES = 80;

//: The target at difficulty 1, the number every other difficulty is measured
//: against: 0x00000000FFFF * 2^(8*(0x1d - 3)).
const DIFFICULTY_1 = 0xffffn * 2n ** (8n * (0x1dn - 3n));

const readU32 = (bytes, at) =>
  bytes[at] |
  (bytes[at + 1] << 8) |
  (bytes[at + 2] << 16) |
  (bytes[at + 3] << 24);

/** Base64 to bytes, without leaning on the DOM. */
export function fromBase64(text) {
  const binary = atob(String(text));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * The target a compact `bits` field stands for.
 *
 * Bitcoin writes it as one exponent byte and a three-byte mantissa, so the
 * whole 256-bit number is carried in four.
 */
export function targetFromBits(bits) {
  const exponent = BigInt(bits >>> 24);
  const mantissa = BigInt(bits & 0x007fffff);
  if (exponent <= 3n) return mantissa >> (8n * (3n - exponent));
  return mantissa * 2n ** (8n * (exponent - 3n));
}

/** How many times harder than the easiest allowed block this one was. */
export function difficultyFromBits(bits) {
  const target = targetFromBits(bits);
  if (target === 0n) return 0;
  // Scaled before dividing, because the ratio is far beyond what a float can
  // hold and the fraction is the interesting part.
  return Number((DIFFICULTY_1 * 100000000n) / target) / 100000000;
}

/**
 * A Bitcoin varint, and how many bytes it took.
 *
 * Under 0xfd it is the byte itself; otherwise the byte says how wide the
 * little-endian number that follows is.
 */
export function readVarInt(bytes, at) {
  const first = bytes[at];
  if (first === undefined) return null;
  if (first < 0xfd) return { value: first, size: 1 };
  const widths = { 253: 2, 254: 4, 255: 8 };
  const width = widths[first];
  if (!width || at + 1 + width > bytes.length) return null;
  let value = 0n;
  for (let i = width - 1; i >= 0; i -= 1)
    value = (value << 8n) | BigInt(bytes[at + 1 + i]);
  return { value: Number(value), size: 1 + width };
}

/**
 * Read a header. `source` is base64, hex, or the bytes themselves.
 *
 * Returns the six fields and the block's own hash, computed here rather than
 * taken on trust — `hash` is what the header actually hashes to, so a caller
 * can hold it against what the service claimed.
 */
export function readHeader(source) {
  let bytes = source;
  if (typeof source === 'string') {
    bytes =
      /^[0-9a-fA-F]+$/.test(source) && source.length === HEADER_BYTES * 2
        ? Uint8Array.from(
            source.match(/../g).map((pair) => Number.parseInt(pair, 16)),
          )
        : fromBase64(source);
  }
  if (!(bytes instanceof Uint8Array) || bytes.length < HEADER_BYTES) {
    const got = bytes?.length;
    throw new Error(`a block header is ${HEADER_BYTES} bytes, got ${got}`);
  }
  // Anything past the eighty is the transaction count the service tacks on.
  const trailer =
    bytes.length > HEADER_BYTES ? readVarInt(bytes, HEADER_BYTES) : null;
  bytes = bytes.slice(0, HEADER_BYTES);

  const bits = readU32(bytes, 72) >>> 0;
  // Hashes are shown big-endian and stored little-endian, hence the reverse.
  const flip = (from, to) => toHex(bytes.slice(from, to).reverse());

  return {
    version: readU32(bytes, 0) >>> 0,
    previousHash: flip(4, 36),
    merkleRoot: flip(36, 68),
    timestamp: readU32(bytes, 68) >>> 0,
    bits,
    nonce: readU32(bytes, 76) >>> 0,
    hash: toHex(hash256(bytes).reverse()),
    transactionCount: trailer ? trailer.value : null,
    target: targetFromBits(bits).toString(16).padStart(64, '0'),
    difficulty: difficultyFromBits(bits),
  };
}
