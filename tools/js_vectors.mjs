// Prints what the browser build computes for the shared test vectors, so the
// Python suite can diff the two implementations. Run: node tools/js_vectors.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { deriveWallet } = await import(join(root, 'docs/js/crypto/wallet.js'));
const bip39 = await import(join(root, 'docs/js/crypto/bip39.js'));
const { toHex, fromHex } = await import(join(root, 'docs/js/crypto/hash.js'));

const { vectors } = JSON.parse(readFileSync(join(root, 'data/test_vectors.json'), 'utf8'));

const out = vectors.map((vector) => {
  const wallet = deriveWallet(vector.mnemonic);
  return {
    entropy: vector.entropy,
    mnemonic: bip39.entropyToMnemonic(fromHex(vector.entropy)),
    seed: wallet.seed,
    seed_trezor_passphrase: toHex(bip39.mnemonicToSeed(vector.mnemonic, 'TREZOR')),
    addresses: Object.fromEntries(
      wallet.addresses.map((entry) => [String(entry.purpose), entry.address]),
    ),
    wif_44: wallet.addresses.find((e) => e.purpose === 44).wif,
    pubkey_44: wallet.addresses.find((e) => e.purpose === 44).publicKey,
    master_xprv: wallet.masterXprv,
    fingerprint: bip39.fingerprint(vector.mnemonic),
    round_trip_entropy: toHex(bip39.mnemonicToEntropy(vector.mnemonic)),
  };
});

// The shared core's seed tools must agree with the Python ones too.
globalThis.localStorage = {
  store: {},
  getItem(key) { return this.store[key] ?? null; },
  setItem(key, value) { this.store[key] = value; },
};
const core = await import(join(root, 'docs/js/core.js'));

const completions = {};
for (const [label, phrase] of [
  ['last', 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon ?'],
  ['middle', 'ozone drill grab fiber curtain ? pudding thank cruise elder eight picnic'],
  ['first', '? swing flag economy stadium alone churn speed unique patch report train'],
]) {
  const { position, candidates } = core.completeMnemonic(phrase);
  completions[label] = { position, words: candidates.map((c) => c.word) };
}

const journalModule = await import(join(root, 'docs/js/journal.js'));
const journal = {
  tools: Object.keys(journalModule.TOOLS),
  masked: journalModule.maskMnemonic(
    'absurd avoid scissors anxiety gather lottery category door army half long camera',
  ),
};

process.stdout.write(JSON.stringify({ vectors: out, completions, journal }, null, 2));
