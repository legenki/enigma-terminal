// Hashing primitives for the browser build: SHA-256, SHA-512, HMAC, PBKDF2 and
// RIPEMD-160. Written by hand rather than on top of WebCrypto so the terminal
// stays synchronous and still runs from file:// where crypto.subtle is absent.

const K256 = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

export function sha256(message) {
  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
    0x1f83d9ab, 0x5be0cd19,
  ]);
  const bitLength = message.length * 8;
  const padded = new Uint8Array((((message.length + 8) >> 6) + 1) * 64);
  padded.set(message);
  padded[message.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(bitLength / 0x100000000));
  view.setUint32(padded.length - 4, bitLength >>> 0);

  const w = new Uint32Array(64);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15];
      const b = w[i - 2];
      const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
      const s1 =
        ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 =
        ((e >>> 6) | (e << 26)) ^
        ((e >>> 11) | (e << 21)) ^
        ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K256[i] + w[i]) >>> 0;
      const S0 =
        ((a >>> 2) | (a << 30)) ^
        ((a >>> 13) | (a << 19)) ^
        ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + hh) >>> 0;
  }
  const out = new Uint8Array(32);
  new DataView(out.buffer).setUint32(0, h[0]);
  for (let i = 0; i < 8; i++) new DataView(out.buffer).setUint32(i * 4, h[i]);
  return out;
}

// --- SHA-512 ---------------------------------------------------------------
// 64-bit words are carried as (hi, lo) pairs of 32-bit ints.

const K512 = [
  '428a2f98d728ae22',
  '7137449123ef65cd',
  'b5c0fbcfec4d3b2f',
  'e9b5dba58189dbbc',
  '3956c25bf348b538',
  '59f111f1b605d019',
  '923f82a4af194f9b',
  'ab1c5ed5da6d8118',
  'd807aa98a3030242',
  '12835b0145706fbe',
  '243185be4ee4b28c',
  '550c7dc3d5ffb4e2',
  '72be5d74f27b896f',
  '80deb1fe3b1696b1',
  '9bdc06a725c71235',
  'c19bf174cf692694',
  'e49b69c19ef14ad2',
  'efbe4786384f25e3',
  '0fc19dc68b8cd5b5',
  '240ca1cc77ac9c65',
  '2de92c6f592b0275',
  '4a7484aa6ea6e483',
  '5cb0a9dcbd41fbd4',
  '76f988da831153b5',
  '983e5152ee66dfab',
  'a831c66d2db43210',
  'b00327c898fb213f',
  'bf597fc7beef0ee4',
  'c6e00bf33da88fc2',
  'd5a79147930aa725',
  '06ca6351e003826f',
  '142929670a0e6e70',
  '27b70a8546d22ffc',
  '2e1b21385c26c926',
  '4d2c6dfc5ac42aed',
  '53380d139d95b3df',
  '650a73548baf63de',
  '766a0abb3c77b2a8',
  '81c2c92e47edaee6',
  '92722c851482353b',
  'a2bfe8a14cf10364',
  'a81a664bbc423001',
  'c24b8b70d0f89791',
  'c76c51a30654be30',
  'd192e819d6ef5218',
  'd69906245565a910',
  'f40e35855771202a',
  '106aa07032bbd1b8',
  '19a4c116b8d2d0c8',
  '1e376c085141ab53',
  '2748774cdf8eeb99',
  '34b0bcb5e19b48a8',
  '391c0cb3c5c95a63',
  '4ed8aa4ae3418acb',
  '5b9cca4f7763e373',
  '682e6ff3d6b2b8a3',
  '748f82ee5defb2fc',
  '78a5636f43172f60',
  '84c87814a1f0ab72',
  '8cc702081a6439ec',
  '90befffa23631e28',
  'a4506cebde82bde9',
  'bef9a3f7b2c67915',
  'c67178f2e372532b',
  'ca273eceea26619c',
  'd186b8c721c0c207',
  'eada7dd6cde0eb1e',
  'f57d4f7fee6ed178',
  '06f067aa72176fba',
  '0a637dc5a2c898a6',
  '113f9804bef90dae',
  '1b710b35131c471b',
  '28db77f523047d84',
  '32caab7b40c72493',
  '3c9ebe0a15c9bebc',
  '431d67c49c100d4c',
  '4cc5d4becb3e42b6',
  '597f299cfc657e2a',
  '5fcb6fab3ad6faec',
  '6c44198c4a475817',
].map((hex) => [
  parseInt(hex.slice(0, 8), 16) | 0,
  parseInt(hex.slice(8), 16) | 0,
]);

const IV512 = [
  '6a09e667f3bcc908',
  'bb67ae8584caa73b',
  '3c6ef372fe94f82b',
  'a54ff53a5f1d36f1',
  '510e527fade682d1',
  '9b05688c2b3e6c1f',
  '1f83d9abfb41bd6b',
  '5be0cd19137e2179',
].map((hex) => [
  parseInt(hex.slice(0, 8), 16) | 0,
  parseInt(hex.slice(8), 16) | 0,
]);

export function sha512(message) {
  const hh = new Int32Array(16);
  for (let i = 0; i < 8; i++) {
    hh[i * 2] = IV512[i][0];
    hh[i * 2 + 1] = IV512[i][1];
  }

  const blocks = (((message.length + 16) >> 7) + 1) * 128;
  const padded = new Uint8Array(blocks);
  padded.set(message);
  padded[message.length] = 0x80;
  const view = new DataView(padded.buffer);
  const bits = message.length * 8;
  view.setUint32(blocks - 8, Math.floor(bits / 0x100000000));
  view.setUint32(blocks - 4, bits >>> 0);

  const wh = new Int32Array(80);
  const wl = new Int32Array(80);

  for (let offset = 0; offset < blocks; offset += 128) {
    for (let i = 0; i < 16; i++) {
      wh[i] = view.getInt32(offset + i * 8);
      wl[i] = view.getInt32(offset + i * 8 + 4);
    }
    for (let i = 16; i < 80; i++) {
      let xh = wh[i - 15],
        xl = wl[i - 15];
      const s0h =
        (((xh >>> 1) | (xl << 31)) ^ ((xh >>> 8) | (xl << 24)) ^ (xh >>> 7)) |
        0;
      const s0l =
        (((xl >>> 1) | (xh << 31)) ^
          ((xl >>> 8) | (xh << 24)) ^
          ((xl >>> 7) | (xh << 25))) |
        0;
      xh = wh[i - 2];
      xl = wl[i - 2];
      const s1h =
        (((xh >>> 19) | (xl << 13)) ^ ((xl >>> 29) | (xh << 3)) ^ (xh >>> 6)) |
        0;
      const s1l =
        (((xl >>> 19) | (xh << 13)) ^
          ((xh >>> 29) | (xl << 3)) ^
          ((xl >>> 6) | (xh << 26))) |
        0;

      let lo = (wl[i - 16] >>> 0) + (s0l >>> 0);
      let hi = (wh[i - 16] + s0h + ((lo / 0x100000000) | 0)) | 0;
      lo = (lo >>> 0) + (wl[i - 7] >>> 0);
      hi = (hi + wh[i - 7] + ((lo / 0x100000000) | 0)) | 0;
      lo = (lo >>> 0) + (s1l >>> 0);
      hi = (hi + s1h + ((lo / 0x100000000) | 0)) | 0;
      wh[i] = hi | 0;
      wl[i] = lo | 0;
    }

    let ah = hh[0],
      al = hh[1],
      bh = hh[2],
      bl = hh[3],
      ch = hh[4],
      cl = hh[5];
    let dh = hh[6],
      dl = hh[7],
      eh = hh[8],
      el = hh[9],
      fh = hh[10],
      fl = hh[11];
    let gh = hh[12],
      gl = hh[13],
      hih = hh[14],
      hil = hh[15];

    for (let i = 0; i < 80; i++) {
      const S1h =
        (((eh >>> 14) | (el << 18)) ^
          ((eh >>> 18) | (el << 14)) ^
          ((el >>> 9) | (eh << 23))) |
        0;
      const S1l =
        (((el >>> 14) | (eh << 18)) ^
          ((el >>> 18) | (eh << 14)) ^
          ((eh >>> 9) | (el << 23))) |
        0;
      const chh = ((eh & fh) ^ (~eh & gh)) | 0;
      const chl = ((el & fl) ^ (~el & gl)) | 0;
      const S0h =
        (((ah >>> 28) | (al << 4)) ^
          ((al >>> 2) | (ah << 30)) ^
          ((al >>> 7) | (ah << 25))) |
        0;
      const S0l =
        (((al >>> 28) | (ah << 4)) ^
          ((ah >>> 2) | (al << 30)) ^
          ((ah >>> 7) | (al << 25))) |
        0;
      const majh = ((ah & bh) ^ (ah & ch) ^ (bh & ch)) | 0;
      const majl = ((al & bl) ^ (al & cl) ^ (bl & cl)) | 0;

      let t1l = (hil >>> 0) + (S1l >>> 0);
      let t1h = (hih + S1h + ((t1l / 0x100000000) | 0)) | 0;
      t1l = (t1l >>> 0) + (chl >>> 0);
      t1h = (t1h + chh + ((t1l / 0x100000000) | 0)) | 0;
      t1l = (t1l >>> 0) + (K512[i][1] >>> 0);
      t1h = (t1h + K512[i][0] + ((t1l / 0x100000000) | 0)) | 0;
      t1l = (t1l >>> 0) + (wl[i] >>> 0);
      t1h = (t1h + wh[i] + ((t1l / 0x100000000) | 0)) | 0;

      const t2l = (S0l >>> 0) + (majl >>> 0);
      const t2h = (S0h + majh + ((t2l / 0x100000000) | 0)) | 0;

      hih = gh;
      hil = gl;
      gh = fh;
      gl = fl;
      fh = eh;
      fl = el;
      let lo = (dl >>> 0) + (t1l >>> 0);
      eh = (dh + t1h + ((lo / 0x100000000) | 0)) | 0;
      el = lo | 0;
      dh = ch;
      dl = cl;
      ch = bh;
      cl = bl;
      bh = ah;
      bl = al;
      lo = (t1l >>> 0) + (t2l >>> 0);
      ah = (t1h + t2h + ((lo / 0x100000000) | 0)) | 0;
      al = lo | 0;
    }

    const add = (index, addHi, addLo) => {
      const lo = (hh[index + 1] >>> 0) + (addLo >>> 0);
      hh[index] = (hh[index] + addHi + ((lo / 0x100000000) | 0)) | 0;
      hh[index + 1] = lo | 0;
    };
    add(0, ah, al);
    add(2, bh, bl);
    add(4, ch, cl);
    add(6, dh, dl);
    add(8, eh, el);
    add(10, fh, fl);
    add(12, gh, gl);
    add(14, hih, hil);
  }

  const out = new Uint8Array(64);
  const outView = new DataView(out.buffer);
  for (let i = 0; i < 16; i++) outView.setInt32(i * 4, hh[i]);
  return out;
}

// --- HMAC / PBKDF2 ---------------------------------------------------------

function hmac(hashFn, blockSize, key, message) {
  let k = key;
  if (k.length > blockSize) k = hashFn(k);
  const pad = new Uint8Array(blockSize);
  pad.set(k);
  const inner = new Uint8Array(blockSize + message.length);
  const outerKey = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    inner[i] = pad[i] ^ 0x36;
    outerKey[i] = pad[i] ^ 0x5c;
  }
  inner.set(message, blockSize);
  const innerHash = hashFn(inner);
  const outer = new Uint8Array(blockSize + innerHash.length);
  outer.set(outerKey);
  outer.set(innerHash, blockSize);
  return hashFn(outer);
}

export const hmacSha512 = (key, message) => hmac(sha512, 128, key, message);
export const hmacSha256 = (key, message) => hmac(sha256, 64, key, message);

/** PBKDF2-HMAC-SHA512 — exactly what BIP-39 uses to stretch a mnemonic into a seed. */
export function pbkdf2Sha512(password, salt, iterations, keyLength) {
  const out = new Uint8Array(keyLength);
  const blocks = Math.ceil(keyLength / 64);
  for (let block = 1; block <= blocks; block++) {
    const input = new Uint8Array(salt.length + 4);
    input.set(salt);
    new DataView(input.buffer).setUint32(salt.length, block);
    let u = hmacSha512(password, input);
    const acc = u.slice();
    for (let round = 1; round < iterations; round++) {
      u = hmacSha512(password, u);
      for (let i = 0; i < 64; i++) acc[i] ^= u[i];
    }
    out.set(
      acc.subarray(0, Math.min(64, keyLength - (block - 1) * 64)),
      (block - 1) * 64,
    );
  }
  return out;
}

// --- RIPEMD-160 ------------------------------------------------------------

const RL = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  [7, 4, 13, 1, 10, 6, 15, 3, 12, 0, 9, 5, 2, 14, 11, 8],
  [3, 10, 14, 4, 9, 15, 8, 1, 2, 7, 0, 6, 13, 11, 5, 12],
  [1, 9, 11, 10, 0, 8, 12, 4, 13, 3, 7, 15, 14, 5, 6, 2],
  [4, 0, 5, 9, 7, 12, 2, 10, 14, 1, 3, 8, 11, 6, 15, 13],
];
const RR = [
  [5, 14, 7, 0, 9, 2, 11, 4, 13, 6, 15, 8, 1, 10, 3, 12],
  [6, 11, 3, 7, 0, 13, 5, 10, 14, 15, 8, 12, 4, 9, 1, 2],
  [15, 5, 1, 3, 7, 14, 6, 9, 11, 8, 12, 2, 10, 0, 4, 13],
  [8, 6, 4, 1, 3, 11, 15, 0, 5, 12, 2, 13, 9, 7, 10, 14],
  [12, 15, 10, 4, 1, 5, 8, 7, 6, 2, 13, 14, 0, 3, 9, 11],
];
const SL = [
  [11, 14, 15, 12, 5, 8, 7, 9, 11, 13, 14, 15, 6, 7, 9, 8],
  [7, 6, 8, 13, 11, 9, 7, 15, 7, 12, 15, 9, 11, 7, 13, 12],
  [11, 13, 6, 7, 14, 9, 13, 15, 14, 8, 13, 6, 5, 12, 7, 5],
  [11, 12, 14, 15, 14, 15, 9, 8, 9, 14, 5, 6, 8, 6, 5, 12],
  [9, 15, 5, 11, 6, 8, 13, 12, 5, 12, 13, 14, 11, 8, 5, 6],
];
const SR = [
  [8, 9, 9, 11, 13, 15, 15, 5, 7, 7, 8, 11, 14, 14, 12, 6],
  [9, 13, 15, 7, 12, 8, 9, 11, 7, 7, 12, 7, 6, 15, 13, 11],
  [9, 7, 15, 11, 8, 6, 6, 14, 12, 13, 5, 14, 13, 13, 7, 5],
  [15, 5, 8, 11, 14, 14, 6, 14, 6, 9, 12, 9, 12, 5, 15, 8],
  [8, 5, 12, 9, 12, 5, 14, 6, 8, 13, 6, 5, 15, 13, 11, 11],
];
const KL = [0x00000000, 0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xa953fd4e];
const KR = [0x50a28be6, 0x5c4dd124, 0x6d703ef3, 0x7a6d76e9, 0x00000000];

const rmdF = (j, x, y, z) => {
  if (j < 16) return x ^ y ^ z;
  if (j < 32) return (x & y) | (~x & z);
  if (j < 48) return (x | ~y) ^ z;
  if (j < 64) return (x & z) | (y & ~z);
  return x ^ (y | ~z);
};
const rol = (value, bits) => (value << bits) | (value >>> (32 - bits)) | 0;

export function ripemd160(message) {
  let h0 = 0x67452301,
    h1 = 0xefcdab89,
    h2 = 0x98badcfe,
    h3 = 0x10325476,
    h4 = 0xc3d2e1f0;
  const blocks = (((message.length + 8) >> 6) + 1) * 64;
  const padded = new Uint8Array(blocks);
  padded.set(message);
  padded[message.length] = 0x80;
  const view = new DataView(padded.buffer);
  const bits = message.length * 8;
  view.setUint32(blocks - 8, bits >>> 0, true);
  view.setUint32(blocks - 4, Math.floor(bits / 0x100000000), true);

  const x = new Int32Array(16);
  for (let offset = 0; offset < blocks; offset += 64) {
    for (let i = 0; i < 16; i++) x[i] = view.getInt32(offset + i * 4, true);
    let al = h0,
      bl = h1,
      cl = h2,
      dl = h3,
      el = h4;
    let ar = h0,
      br = h1,
      cr = h2,
      dr = h3,
      er = h4;
    for (let j = 0; j < 80; j++) {
      const round = (j / 16) | 0;
      let t = (al + rmdF(j, bl, cl, dl) + x[RL[round][j % 16]] + KL[round]) | 0;
      t = (rol(t, SL[round][j % 16]) + el) | 0;
      al = el;
      el = dl;
      dl = rol(cl, 10);
      cl = bl;
      bl = t;
      t =
        (ar + rmdF(79 - j, br, cr, dr) + x[RR[round][j % 16]] + KR[round]) | 0;
      t = (rol(t, SR[round][j % 16]) + er) | 0;
      ar = er;
      er = dr;
      dr = rol(cr, 10);
      cr = br;
      br = t;
    }
    const t = (h1 + cl + dr) | 0;
    h1 = (h2 + dl + er) | 0;
    h2 = (h3 + el + ar) | 0;
    h3 = (h4 + al + br) | 0;
    h4 = (h0 + bl + cr) | 0;
    h0 = t;
  }
  const out = new Uint8Array(20);
  const outView = new DataView(out.buffer);
  [h0, h1, h2, h3, h4].forEach((value, i) =>
    outView.setInt32(i * 4, value, true),
  );
  return out;
}

/** Bitcoin's HASH160: RIPEMD-160 over SHA-256. */
export const hash160 = (data) => ripemd160(sha256(data));
/** Bitcoin's double SHA-256, used by Base58Check. */
export const hash256 = (data) => sha256(sha256(data));

export const toHex = (bytes) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

export function fromHex(hex) {
  const clean = hex.replace(/^0x/i, '').replace(/\s+/g, '');
  if (clean.length % 2) throw new Error('hex string must have an even length');
  if (!/^[0-9a-fA-F]*$/.test(clean)) throw new Error('not hexadecimal');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++)
    out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

export const utf8 = (text) => new TextEncoder().encode(text);
