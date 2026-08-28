// One searcher, off the main thread.
//
// A candidate is 128 fresh bits, a BIP-39 phrase, PBKDF2-HMAC-SHA512 over 2048
// rounds, five levels of BIP-32 and a hash160. There may be millions of them,
// so this cannot run where the interface lives.
//
// PBKDF2 goes through WebCrypto rather than the page's own implementation: it
// is the same 2048 rounds and byte-for-byte the same seed, about forty times
// faster because it is native. The pure-JS one stays where it is for DECRYPT,
// which does it once.
//
// The worker reports progress and never decides anything: the page owns the
// stopping, the arithmetic and every number shown to the player.

import { entropyToMnemonic } from './crypto/bip39.js';
import { base58CheckEncode } from './crypto/encoding.js';
import { hash160, utf8 } from './crypto/hash.js';
import { ExtendedKey } from './crypto/wallet.js';
import { matches } from './nameforge.js';

const PATH = "m/44'/0'/0'/0/0";
const SALT = utf8('mnemonic');

/** BIP-39's seed, via the native implementation. Identical output. */
async function seedFrom(mnemonic) {
  const key = await crypto.subtle.importKey(
    'raw',
    utf8(mnemonic.normalize('NFKD')),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: SALT, iterations: 2048, hash: 'SHA-512' },
    key,
    512,
  );
  return new Uint8Array(bits);
}

function p2pkh(publicKey) {
  const payload = new Uint8Array(21);
  payload[0] = 0;
  payload.set(hash160(publicKey), 1);
  return base58CheckEncode(payload);
}

/** One fresh phrase and the address at PATH. */
async function candidate() {
  // crypto.getRandomValues, never Math.random: this phrase can hold real value
  // the moment somebody sends to it.
  const entropy = crypto.getRandomValues(new Uint8Array(16));
  const mnemonic = entropyToMnemonic(entropy);
  const node = ExtendedKey.fromSeed(await seedFrom(mnemonic)).derivePath(PATH);
  return { mnemonic, address: p2pkh(node.publicKey) };
}

let running = false;

self.onmessage = async (event) => {
  const { type, stamp, anyCase = false, reportEvery = 250 } = event.data || {};

  if (type === 'stop') {
    running = false;
    return;
  }

  if (type === 'measure') {
    // What this device actually manages, rather than a number baked in here.
    const until = performance.now() + 600;
    let count = 0;
    while (performance.now() < until) {
      await candidate();
      count += 1;
    }
    self.postMessage({ type: 'rate', rate: count / 0.6 });
    return;
  }

  if (type !== 'search') return;

  running = true;
  let attempts = 0;
  let closest = '';
  let closestScore = -1;
  // Matching is the page's rule, imported rather than repeated: a worker that
  // decided for itself what counts as a hit could hand back a stamp the page
  // never priced.
  const same = anyCase
    ? (a, b) => a.toLowerCase() === b.toLowerCase()
    : (a, b) => a === b;

  while (running) {
    const { mnemonic, address } = await candidate();
    attempts += 1;

    if (matches(address, stamp, anyCase)) {
      self.postMessage({
        type: 'hit',
        mnemonic,
        address,
        attempts,
        path: PATH,
      });
      running = false;
      return;
    }

    // How much of the stamp this one did carry, so a long search has
    // something to show for itself. Scored by the same rule the hit is, or a
    // near miss could outrank a hit.
    let score = 0;
    while (score < stamp.length && same(address[1 + score], stamp[score]))
      score += 1;
    if (score > closestScore) {
      closestScore = score;
      closest = address;
    }

    if (attempts % reportEvery === 0) {
      self.postMessage({ type: 'progress', attempts, closest, closestScore });
      attempts = 0;
      // Yield so a 'stop' message can actually be delivered.
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  self.postMessage({ type: 'stopped', attempts });
};
