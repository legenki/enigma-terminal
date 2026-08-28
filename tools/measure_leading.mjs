// Re-measure the leading-character distribution behind data/nameforge.json.
//
// The character right after the '1' of a P2PKH address is not uniform, and
// Nameforge's whole difficulty model rests on how unequal it is. Rather than
// derive it from the encoding, we count it: two million random hash160 values,
// Base58Check-encoded, tallied by second character.
//
// Run when the address format changes, which is to say almost never:
//   node tools/measure_leading.mjs > data/nameforge.json

import { randomBytes } from 'node:crypto';
import { base58CheckEncode } from '../docs/js/crypto/encoding.js';

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const SAMPLE = 2_000_000;
const BATCH = 5_000;

const counts = new Map();
const payload = new Uint8Array(21);

for (let batch = 0; batch < SAMPLE / BATCH; batch++) {
  // One syscall per batch rather than per address; the tally is identical and
  // the run finishes in a minute instead of many.
  const bulk = randomBytes(20 * BATCH);
  for (let i = 0; i < BATCH; i++) {
    payload[0] = 0;
    payload.set(bulk.subarray(i * 20, i * 20 + 20), 1);
    const c = base58CheckEncode(payload)[1];
    counts.set(c, (counts.get(c) || 0) + 1);
  }
}

const leading = {};
for (const c of BASE58)
  leading[c] = +((counts.get(c) || 0) / SAMPLE).toFixed(8);

console.log(
  JSON.stringify(
    {
      _comment:
        "How often each Base58 character lands immediately after the leading '1' of " +
        'a P2PKH address. Measured, not derived: 2,000,000 random hash160 values ' +
        'encoded as Base58Check and counted. It is nowhere near uniform, and the ' +
        'difference decides how long a name takes to forge — see _why.',
      _why:
        'A P2PKH payload is 0x00 followed by 24 bytes, so the number Base58 encodes ' +
        'is under 2^192 while 33 Base58 digits span about 2^193.3. The top digit ' +
        'therefore cannot reach its full range: 22 characters take about 4.3% each ' +
        'and the remaining 34 about 0.075%, a spread of roughly 58x. A name ' +
        'beginning with R takes as long as a name one character longer beginning ' +
        'with A, which is why difficulty here is computed per name and never from ' +
        'its length.',
      _method: 'tools/measure_leading.mjs',
      sample: SAMPLE,
      leading,
    },
    null,
    2,
  ),
);
