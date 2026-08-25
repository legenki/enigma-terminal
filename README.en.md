# BIP-39: NEON TERMINAL

**A cyberpunk text detective quest played against the live Bitcoin network.**

You recover seed phrases from detective riddles and type them into a console. Underneath the
story nothing is simulated: the phrase is validated against the official BIP-39 wordlist —
checksum included — stretched into a seed with PBKDF2-HMAC-SHA512, derived over secp256k1
through BIP-32 into three address types, and its balance is fetched with a real HTTP request
to public block explorers.

▶ **Play in the browser: <https://legenki.github.io/neon-terminal/>**

The web build has two modes, switched by the rocker at the bottom of the screen (or **F2**):
**GUI**, a windowed interface in cyberpunk dress — black glass, neon rules, HUD corner ticks —
and **CL**, the same game as a command line. Progress and journal are shared.

The CRT simulation now covers **both** modes and is switched by the `CRT` rocker at the bottom
right: **SOFT** gives scanlines, an aperture grille, a vignette and a slow flicker (in CL a full
WebGL shader with bloom and tube curvature runs underneath it), **OFF** gives a clean picture.

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
| `CLIENTS` | the eight employers and their counts |
| `BOARD <client>` | one employer's thirty-two contracts |
| `BRIEF` / `EVIDENCE` / `CLUES` | re-read the active case |
| `HINT` | spend one of three hints |
| `WORD <n>` / `INDEX <word>` / `SEARCH <prefix>` | BIP-39 wordlist tools |
| `ENTROPY <hex>` | rebuild a mnemonic from 128 bits of entropy |
| `DECRYPT <12 words>` | validate a phrase and print the derivation grid |
| `DERIVE` | re-print the addresses |
| `SYNC_LEDGER [addr]` | live balance query against Bitcoin mainnet |
| `SWEEP` | check all three derived addresses at once |
| `JOURNAL [tool]` | the investigation journal, newest first |
| `RECALL <n>` | replay entry n in the tool that made it |
| `PIN <n>` | pin an entry so `PURGE` keeps it |
| `PURGE [all]` | clear the journal |
| `ARCHIVE <text>` | full-text search across the case files |
| `RANDOM [12..24]` | generate a fresh seed phrase |
| `COMPLETE <phrase ?>` | recover the missing word of a phrase |
| `TXLOG [addr]` | most recent on-chain transactions |
| `PROVIDER [name]` | `blockstream` \| `mempool` \| `blockchain` |
| `EXPLORER` | open the address in a block explorer |
| `STATUS` | operator status and progress |
| `COPY` | copy addresses to the clipboard (web only) |
| `CLEAR` / `RESET` / `EXIT` | clear screen / erase progress / quit |

Progress persists in `~/.neon_terminal/progress.json` (override with `NEON_TERMINAL_HOME`)
for the terminal, and in `localStorage` for the web build.

## The contract board: 8 clients × 32 cases

Beyond the eight hand-written campaign cases there is a board of **256 contracts** spread across
eight employers, from a private forensic bureau to an archivist collective that does not pay in
money. Thirty-two cases each, in four phases.

A client is not a skin. It sets the **hand**: the way words are hidden in their cases.

| Client | What they are | Hand |
|---|---|---|
| MERIDIAN | private forensic bureau | entropy, plain indices, unique branches |
| SEVENTH SIGN | grey fund, auction house | the index is sewn into the lot price |
| DEEPHOLD | subsea data havens | the wordlist as a 128 × 16 grid |
| VEGA ORBITAL | orbital key custody | the index has to be computed |
| WHITEBONE | biotech and body-lease clinics | the one branch that fits |
| GOST-9 | agency of a state that ended | one word redacted, recovered with `COMPLETE` |
| MICA | mineral conglomerate | mirrored: index = 2049 − the number given |
| LAST ARCHIVE | archivists, paid in information | a chain of wordlist neighbours |

Hand-writing 256 cases means three thousand riddles, and they would be bad ones. So the creative
work sits in two places that scale: `data/clients.json` holds the voices and
`tools/generate_cases.py` holds the eight hands. The board is assembled deterministically — the
same seed gives the same board, so a rebuild never reshuffles someone's game.

The hard constraint is the checksum: twelve arbitrary words are almost never a valid BIP-39
phrase. So a case is built the other way round — a valid mnemonic is drawn first, then each of
its words is described in the client's hand. The answer exists before the puzzle does.

**All 256 are machine-verified solvable.** The suite carries a solver that follows nothing but
the clues, reconstructs twelve words and checks them against the stored fingerprint. If a hand
ever emits a clue that leads nowhere, the board fails to build rather than costing a player their
evening.

## Generative sigils

Every case, every seed phrase and every address carries its own mark, drawn with
[minidenticons](https://github.com/laurentpayot/minidenticons) (MIT, vendored into
`docs/js/vendor/` with its licence so the page pulls nothing from a third-party CDN). The marks
appear in the case list, the derivation grid, the journal and the rail, so a wallet or a case is
recognised by its shape rather than by a thirty-four character string.

A phrase's sigil is keyed by its SHA-256 fingerprint, never by the words — the same rule the
journal follows, so an unrecognised phrase still gets a stable icon while being stored nowhere.

## The investigation journal

Every move — a derivation, a balance query, a sweep, a wordlist or archive search, a word
recovery, a generated phrase, a hint taken, a case closed — lands in the journal. It is shared
between the GUI and the command line, survives a reload, and lives in `localStorage` (or in
`~/.neon_terminal/journal.json` for the terminal build).

In the GUI it is always at hand: a rail of recent entries sits beside every panel, and a full
panel adds per-tool filters, pinning and a text export. **Recall** replays an entry in the tool
that produced it, with the same address, query or phrase. On the command line, `JOURNAL` and
`RECALL <n>` do the same.

Panels no longer reset when you switch: a half-typed phrase, a query and its results are still
there when you come back from another tool.

**What the journal will not remember.** A seed phrase the game does not recognise is never
written out in full — only a masked trace like `absurd … camera (12 words) — NOT STORED`, and
`RECALL` on such an entry says plainly that there is nothing to replay. Only the eight case
answers (published test vectors) and phrases this page generated itself are stored whole. So
pasting a live wallet into the terminal does not leave it sitting on disk.

## Search and randomisation

**`RANDOM`** builds a new seed phrase from cryptographic randomness (`secrets` in Python,
`crypto.getRandomValues` in the browser) — the same way a real wallet does, which is why the
output carries a warning: the addresses are genuine, and you must not fund them, because the
phrase is stored nowhere.

**`COMPLETE`** recovers a single forgotten word: put `?` where it belongs and the tool walks the
wordlist, keeping the words that satisfy the checksum. A 12-word phrase carries four checksum
bits, so roughly one word in sixteen fits — about 128 of 2048.

Exactly one unknown position is a deliberate limit, not an unfinished feature: with two blanks
hundreds of thousands of phrases stay valid and the list stops meaning anything. The tool helps
recover a phrase you almost have; it is not a search over other people's wallets.

**`ARCHIVE`** searches the case texts. Epilogues join the index only once a case is closed —
otherwise the search would hand out the ending.

In the GUI these live under the Search and Randomizer panels; on the command line they carry
the same names.

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
  js/core.js          shared core: progress, case rules, search, randomisation
  js/crypto/          hash.js, secp256k1.js, encoding.js, bip39.js, wallet.js
  js/term.js          the canvas terminal
  js/crt.js           WebGL bloom, curvature, aberration, mask, noise
  js/glitch.js        the glitch banner above both modes
  js/journal.js       the investigation journal, shared by both modes
  js/identicon.js     generative sigils for cases, phrases and addresses
  js/vendor/          minidenticons (MIT) plus its licence
  js/gui/             GUI mode, over the same core
tools/build_web_data.py   regenerates docs/js/{wordlist,campaign}.js from data/
tests/                253 tests, including the Python↔JavaScript parity check
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
