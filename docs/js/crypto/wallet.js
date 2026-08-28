// BIP-32 derivation plus the BIP-44/49/84 address grid the terminal prints.

import { mnemonicToSeed, normalize, validateMnemonic } from './bip39.js';
import { base58CheckEncode, segwitAddress } from './encoding.js';
import { hash160, hmacSha512, sha256, toHex } from './hash.js';
import { bigIntToBytes32, bytesToBigInt, N, publicKey } from './secp256k1.js';

const concat = (...chunks) => {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
};

const uint32 = (value) => {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value >>> 0);
  return out;
};

const HARDENED = 0x80000000;

export class ExtendedKey {
  constructor(key, chainCode, depth = 0, parent = null, childNumber = 0) {
    this.key = key;
    this.chainCode = chainCode;
    this.depth = depth;
    //: The parent node rather than its fingerprint. Computing the fingerprint
    //: costs a point multiplication, and only toExtended() ever reads it —
    //: deriving an address does not. Held as the parent and resolved on demand,
    //: a path like m/44'/0'/0'/0/0 needs three multiplications instead of six.
    this.parent = parent;
    this.childNumber = childNumber;
  }

  static fromSeed(seed) {
    const digest = hmacSha512(new TextEncoder().encode('Bitcoin seed'), seed);
    return new ExtendedKey(digest.subarray(0, 32), digest.subarray(32));
  }

  get publicKey() {
    if (!this._pub) this._pub = publicKey(this.key);
    return this._pub;
  }

  get fingerprint() {
    if (!this._fingerprint)
      this._fingerprint = hash160(this.publicKey).subarray(0, 4);
    return this._fingerprint;
  }

  get parentFingerprint() {
    return this.parent ? this.parent.fingerprint : new Uint8Array(4);
  }

  child(index) {
    const hardened = index >= HARDENED;
    const payload = hardened
      ? concat(new Uint8Array([0]), this.key)
      : this.publicKey;
    const digest = hmacSha512(this.chainCode, concat(payload, uint32(index)));
    const tweak = bytesToBigInt(digest.subarray(0, 32));
    const childKey = (tweak + bytesToBigInt(this.key)) % N;
    if (tweak >= N || childKey === 0n) return this.child(index + 1);
    return new ExtendedKey(
      bigIntToBytes32(childKey),
      digest.subarray(32),
      this.depth + 1,
      this,
      index,
    );
  }

  derivePath(path) {
    return path
      .split('/')
      .map((part) => part.trim())
      .filter((part) => part && part !== 'm' && part !== 'M')
      .reduce((node, part) => {
        const hardened = /['hH]$/.test(part);
        const number = parseInt(part.replace(/['hH]$/, ''), 10);
        if (!Number.isInteger(number))
          throw new Error(`bad derivation path segment: ${part}`);
        return node.child(hardened ? number + HARDENED : number);
      }, this);
  }

  toExtended(version) {
    return base58CheckEncode(
      concat(
        version,
        new Uint8Array([this.depth]),
        this.parentFingerprint,
        uint32(this.childNumber),
        this.chainCode,
        new Uint8Array([0]),
        this.key,
      ),
    );
  }

  toWif() {
    return base58CheckEncode(
      concat(new Uint8Array([0x80]), this.key, new Uint8Array([1])),
    );
  }
}

const p2pkh = (pub) =>
  base58CheckEncode(concat(new Uint8Array([0x00]), hash160(pub)));
const p2shP2wpkh = (pub) => {
  const redeem = concat(new Uint8Array([0x00, 0x14]), hash160(pub));
  return base58CheckEncode(concat(new Uint8Array([0x05]), hash160(redeem)));
};
const p2wpkh = (pub) => segwitAddress('bc', 0, hash160(pub));

export const PURPOSES = [
  {
    purpose: 44,
    label: 'Legacy P2PKH',
    encode: p2pkh,
    version: new Uint8Array([0x04, 0x88, 0xad, 0xe4]),
  },
  {
    purpose: 49,
    label: 'Nested SegWit',
    encode: p2shP2wpkh,
    version: new Uint8Array([0x04, 0x9d, 0x78, 0x78]),
  },
  {
    purpose: 84,
    label: 'Native SegWit',
    encode: p2wpkh,
    version: new Uint8Array([0x04, 0xb2, 0x43, 0x0c]),
  },
];

/** Full chain: mnemonic -> seed -> master xprv -> account keys -> addresses. */
export function deriveWallet(
  mnemonic,
  { passphrase = '', account = 0, index = 0 } = {},
) {
  validateMnemonic(mnemonic);
  const seed = mnemonicToSeed(mnemonic, passphrase);
  const master = ExtendedKey.fromSeed(seed);

  const addresses = PURPOSES.map(({ purpose, label, encode, version }) => {
    const path = `m/${purpose}'/0'/${account}'/0/${index}`;
    const node = master.derivePath(path);
    const accountNode = master.derivePath(`m/${purpose}'/0'/${account}'`);
    return {
      purpose,
      label,
      path,
      address: encode(node.publicKey),
      publicKey: toHex(node.publicKey),
      wif: node.toWif(),
      extendedPrivateKey: accountNode.toExtended(version),
    };
  });

  return {
    mnemonic: normalize(mnemonic),
    seed: toHex(seed),
    masterXprv: master.toExtended(new Uint8Array([0x04, 0x88, 0xad, 0xe4])),
    addresses,
    primary: addresses.find((entry) => entry.purpose === 44),
  };
}

export { sha256 };
