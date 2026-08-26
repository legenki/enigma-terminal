// Minimal secp256k1: scalar multiplication in Jacobian coordinates, which keeps
// one modular inversion per public key instead of one per point operation.

export const P =
  0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn;
export const N =
  0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
const GX = 0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n;
const GY = 0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n;

const mod = (a, m = P) => ((a % m) + m) % m;

function inverse(a, m = P) {
  let [old_r, r] = [mod(a, m), m];
  let [old_s, s] = [1n, 0n];
  while (r !== 0n) {
    const q = old_r / r;
    [old_r, r] = [r, old_r - q * r];
    [old_s, s] = [s, old_s - q * s];
  }
  if (old_r !== 1n) throw new Error('value is not invertible');
  return mod(old_s, m);
}

// Jacobian point: {x, y, z} representing affine (x/z^2, y/z^3); z === 0n is infinity.
const jacobianDouble = (p) => {
  if (p.y === 0n || p.z === 0n) return { x: 0n, y: 0n, z: 0n };
  const ysq = mod(p.y * p.y);
  const s = mod(4n * p.x * ysq);
  const m = mod(3n * p.x * p.x);
  const nx = mod(m * m - 2n * s);
  const ny = mod(m * (s - nx) - 8n * ysq * ysq);
  const nz = mod(2n * p.y * p.z);
  return { x: nx, y: ny, z: nz };
};

const jacobianAdd = (p, q) => {
  if (p.z === 0n) return q;
  if (q.z === 0n) return p;
  const pz2 = mod(p.z * p.z);
  const qz2 = mod(q.z * q.z);
  const u1 = mod(p.x * qz2);
  const u2 = mod(q.x * pz2);
  const s1 = mod(p.y * qz2 * q.z);
  const s2 = mod(q.y * pz2 * p.z);
  if (u1 === u2) return s1 === s2 ? jacobianDouble(p) : { x: 0n, y: 0n, z: 0n };
  const h = mod(u2 - u1);
  const r = mod(s2 - s1);
  const h2 = mod(h * h);
  const h3 = mod(h * h2);
  const u1h2 = mod(u1 * h2);
  const nx = mod(r * r - h3 - 2n * u1h2);
  const ny = mod(r * (u1h2 - nx) - s1 * h3);
  const nz = mod(h * p.z * q.z);
  return { x: nx, y: ny, z: nz };
};

/** Multiply the generator (or a given affine point) by a scalar. */
export function pointMultiply(scalar, base = { x: GX, y: GY }) {
  let result = { x: 0n, y: 0n, z: 0n };
  let addend = { x: base.x, y: base.y, z: 1n };
  let k = scalar;
  while (k > 0n) {
    if (k & 1n) result = jacobianAdd(result, addend);
    addend = jacobianDouble(addend);
    k >>= 1n;
  }
  if (result.z === 0n) throw new Error('point at infinity');
  const zInv = inverse(result.z);
  const zInv2 = mod(zInv * zInv);
  return { x: mod(result.x * zInv2), y: mod(result.y * zInv2 * zInv) };
}

const toBytes32 = (value) => {
  const out = new Uint8Array(32);
  let v = value;
  for (let i = 31; i >= 0; i--) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
};

export const bytesToBigInt = (bytes) =>
  bytes.reduce((acc, byte) => (acc << 8n) | BigInt(byte), 0n);

export const bigIntToBytes32 = toBytes32;

/** Compressed SEC1 public key (33 bytes) for a 32-byte private key. */
export function publicKey(privateKeyBytes) {
  const d = bytesToBigInt(privateKeyBytes);
  if (d <= 0n || d >= N) throw new Error('private key out of range');
  const point = pointMultiply(d);
  const out = new Uint8Array(33);
  out[0] = point.y % 2n === 0n ? 0x02 : 0x03;
  out.set(toBytes32(point.x), 1);
  return out;
}
