# BIP-39: NEON TERMINAL

**A cyberpunk text detective quest played against the live Bitcoin network.**

You recover seed phrases from detective riddles and type them into a console. Underneath the
story nothing is simulated: the phrase is validated against the official BIP-39 wordlist —
checksum included — stretched into a seed with PBKDF2-HMAC-SHA512, derived over secp256k1
through BIP-32 into three address types, and its balance is fetched with a real HTTP request
to public block explorers.

▶ **Play in the browser: <https://legenki.github.io/neon-terminal/>**

*(Русская версия: [README.md](README.md))*

---

## Two builds

| | Terminal (Python) | Web (GitHub Pages) |
|---|---|---|
| Launch | `python -m neon_terminal` | a browser, nothing to install |
| Crypto | pure Python, standard library only | pure JavaScript, no dependencies |
| Network | `requests` (or `urllib`) | `fetch` straight from the page |
| Visuals | ANSI colour, typewriter output | Canvas + a WebGL CRT shader |

Both builds read the same files from `data/` and derive **bit-identical** addresses. That is
enforced by `tests/test_web_parity.py`, which runs the JavaScript under Node and diffs every
field against the Python engine.

## Quick start

### Web

Open <https://legenki.github.io/neon-terminal/>, or serve it locally:

```bash
python3 -m http.server 8000 --directory docs
```

### Terminal

```bash
git clone https://github.com/legenki/neon-terminal
cd neon-terminal
python -m neon_terminal            # no dependencies required
```

Optionally `pip install -r requirements.txt`: `requests` improves timeout handling, while
`mnemonic` and `bip-utils` are only needed by the tests as reference implementations.

```bash
python -m neon_terminal --lang en          # English narrative
python -m neon_terminal --offline          # no network; the crypto still runs for real
python -m neon_terminal --speed 0          # disable animation
python -m neon_terminal --provider mempool # pick an explorer
python -m neon_terminal -c "DECRYPT ..." -c "SYNC_LEDGER"   # one-shot commands
```

## Commands

| Command | Effect |
|---|---|
| `HELP` / `ABOUT` | command list / what the program really does |
| `LANG RU\|EN` | narrative language |
| `CASES` | the eight case files and their state |
| `OPEN <id>` | open a case: brief, evidence, decoding table |
| `BRIEF` / `EVIDENCE` / `CLUES` | re-read the active case |
| `HINT` | spend one of three hints |
| `WORD <n>` / `INDEX <word>` / `SEARCH <prefix>` | BIP-39 wordlist tools |
| `ENTROPY <hex>` | rebuild a mnemonic from 128 bits of entropy |
| `DECRYPT <12 words>` | validate a phrase and print the derivation grid |
| `DERIVE` | re-print the addresses |
| `SYNC_LEDGER [addr]` | live balance query against Bitcoin mainnet |
| `SWEEP` | check all three derived addresses at once |
| `TXLOG [addr]` | most recent on-chain transactions |
| `PROVIDER [name]` | `blockstream` \| `mempool` \| `blockchain` |
| `EXPLORER` | open the address in a block explorer |
| `STATUS` | operator status and progress |
| `CRT full\|soft\|flat\|off` | monitor profile (web only) |
| `COPY` | copy addresses to the clipboard (web only) |
| `CLEAR` / `RESET` / `EXIT` | clear screen / erase progress / quit |

Progress persists in `~/.neon_terminal/progress.json` (override with `NEON_TERMINAL_HOME`)
for the terminal, and in `localStorage` for the web build.

## What a session looks like

```
nullsec@neon:~$ DECRYPT abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about
[~] decrypting master pre-image...
[~] pbkdf2-hmac-sha512, 2048 rounds...
[~] deriving public key coordinates (X, Y)...
[~] sha256 -> ripemd160 hashing...
[ OK ] MNEMONIC CHECKSUM VALID.
==================================================================
PATH m/44'/0'/0'/0/0 (Legacy P2PKH)         : 1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA
PATH m/49'/0'/0'/0/0 (Nested SegWit)        : 37VucYSaXLCAsxYyAPfbSi9eh4iEcbShgf
PATH m/84'/0'/0'/0/0 (Native SegWit)        : bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu
==================================================================
```

## About the wallets — please read

The spec assumed the developer would create wallets, fund them with dust, and hide their
words in riddles. The eight cases instead use **published BIP-39 test vectors** (the ones
from the Trezor specification), because:

* they are real mainnet addresses with real history — the first has 48 transactions going
  back to 2013, so `SYNC_LEDGER` shows genuine data rather than invention;
* their private keys are known worldwide, so there is provably nothing there to steal and
  the game cannot turn into an accidental leak of funds;
* they are reproducible: anyone can verify every address in any explorer.

**Want your own wallets?** Three steps:

1. create a wallet, write down the 12 words, send it a few satoshi;
2. compute the fingerprint:
   `python -c "from neon_terminal.crypto_engine import fingerprint; print(fingerprint('your 12 words'))"`;
3. put it in the `fingerprint` field of a case in `data/cases.json`, rewrite the riddles, and
   run `python tools/build_web_data.py`.

The words themselves never enter the repository — the game stores only the SHA-256
fingerprint and compares it against whatever the player types.

## Security

* This program **cannot crack anyone's wallet**, by design. It derives addresses from a
  phrase you already know and reads public blockchain data.
* The web build computes everything in your browser. The only thing that leaves the page is
  an address lookup, which contains nothing but the address.
* Even so: **never type a seed phrase that controls real funds into any program, including
  this one.**

## Layout

```
data/                 shared source of truth for both builds
neon_terminal/        terminal build (crypto_engine, chain, ui, cases, game)
docs/                 web build, published by GitHub Pages
  js/crypto/          hash.js, secp256k1.js, encoding.js, bip39.js, wallet.js
  js/term.js          the canvas terminal
  js/crt.js           WebGL bloom, curvature, aberration, mask, noise
tools/build_web_data.py   regenerates docs/js/{wordlist,campaign}.js from data/
tests/                109 tests, including the Python↔JavaScript parity check
```

## Development

```bash
pip install -r requirements-dev.txt
python -m pytest tests -v
python tools/build_web_data.py     # required after editing data/
```

## Publishing

Repository settings → **Pages** → **Source: GitHub Actions**. Every push to `main` then
publishes `docs/` via `.github/workflows/pages.yml`.

## Licence

MIT — see [LICENSE](LICENSE).
