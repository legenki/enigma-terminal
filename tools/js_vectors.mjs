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

process.stdout.write(JSON.stringify(out, null, 2));
