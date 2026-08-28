# ENIGMA TERMINAL

**A detective quest played against the live Bitcoin network.**

Buenos Aires, now — or a version of now. The sudestada has not let up in eighteen
days, Microcentro is ankle-deep, and on Florida the *arbolitos* are quoting three
dollar rates at once. The geography is real: La City, Recoleta, Dársena Sur, Paseo
Colón, Barrio Norte, Balvanera, Catalinas Norte, San Telmo. So is the chain the
story is told against — the game opens on one of sixteen scenes written around
figures it reads a second earlier: what a coin costs, which pool took the last
block, how deep the mempool is tonight.

You recover seed phrases from detective riddles and type them into the terminal.
Nothing underneath the story is simulated: a phrase is checked against the official
BIP-39 English wordlist including the checksum carried by its final word, stretched
into a seed with PBKDF2-HMAC-SHA512, and walked through BIP-32 over secp256k1 to
produce addresses of all three kinds — whose balances are then fetched with live
HTTP calls to public block explorers.

▶ **Play in the browser: <https://legenki.github.io/enigma-terminal/>**

---

## Two builds, one game

| | Terminal (Python) | Web (GitHub Pages) |
|---|---|---|
| Run it | `python -m enigma_terminal` | open the page, nothing to install |
| Cryptography | pure Python, standard library only | pure JavaScript, no dependencies |
| Network | `requests`, or `urllib` as a fallback | `fetch`, straight from the browser |
| Screen | ANSI colour, character-by-character output | canvas terminal inside a windowed interface |

Both read the same data out of `data/` and derive **bit-for-bit identical** addresses.
That is not a claim, it is a test: `tests/test_web_parity.py` runs the JavaScript under
Node and diffs every field against Python.

The command set is held to the same standard. `tests/test_command_parity.py` compares
what each build advertises in `HELP` against what it can actually dispatch, in all four
languages — after a stretch where the web build listed three commands that answered
`UNKNOWN COMMAND`.

## Quick start

### Web

Open <https://legenki.github.io/enigma-terminal/>, or serve it locally:

```bash
python3 -m http.server 8000 --directory docs
# http://localhost:8000
```

### Terminal

```bash
git clone https://github.com/legenki/enigma-terminal
cd enigma-terminal
python -m enigma_terminal          # no dependencies required
```

Optional: `pip install -e ".[net]"` — `requests` handles timeouts more
gracefully. `mnemonic` and `bip-utils` are needed only by the tests, as reference
implementations to check ours against.

```bash
python -m enigma_terminal --lang en           # ru | en | es | pt
python -m enigma_terminal --offline           # no network; the crypto still runs for real
python -m enigma_terminal --speed 0           # no animation
python -m enigma_terminal --provider mempool  # blockstream | mempool | blockchain
python -m enigma_terminal -c "DECRYPT ..." -c "SYNC_LEDGER"   # run and exit
```

## The interface

The web build is one interface with nine panels, reachable by clicking or by pressing
its digit:

| | Panel | |
|---|---|---|
| **1** | Terminal | the full command line, the same one the Python build runs — and where the game opens |
| **2** | Case files | the desk: the campaign plus every contract you have taken |
| **3** | Contracts | the board, by employer |
| **4** | Decrypt | a phrase in, a derivation grid out |
| **5** | Ledger | live balance and transaction lookups |
| **6** | Explorer | the live chain: blocks, transactions, addresses, mempool |
| **7** | Archive | full-text search across the case files |
| **8** | Randomizer | a fresh phrase from real entropy |
| **F** | Nameforge | strike a stamp: an address that starts with your name |
| **9** | Journal | every move you have made, filterable and replayable |
| **0** | About | what the program actually does |

Two lookups sit permanently in the right-hand rail rather than in a panel of their own:
the **BIP-39 wordlist** and **missing-word recovery**. They are the things you reach for
mid-thought, and putting them behind a tab meant leaving whatever you were reading to
use one, and losing the other to see the first.

Above the panels is a 34&nbsp;px strip in the same idiom as every window below it: the mark
and the wordmark on the left, then the node, the closed-case count and the journal size,
then the two controls that change how the whole page reads — daylight and language.

### The chain explorer

Panel 6 reads the live chain from [mempool.space](https://mempool.space)'s public API —
blocks, transactions, addresses, the mempool, and who mined the last day — in one box that
works out from the shape of what you typed which of those you meant. A number is a height;
sixty-four hex characters are a block or a transaction, and since only the chain knows
which, it asks the block index first and falls back.

Every lookup goes through one queue that caches what cannot change and rations what can. A
page that hammers a free service deserves to be cut off, and a confirmed transaction is the
same answer forever.

The service sends the raw eighty-byte header alongside each block, so the difficulty and
the hash it reports are held against the bytes they came from rather than taken on trust —
the card says whether the header really does hash to the hash it was given.

Panel 6 also carries the pulse: the height, how long the chain has been quiet, what is
waiting in the pool, and the going fee rate. One watcher drives it — the countdown in the
strip above the interface, the card in the panel, and a three-note chime when a block
lands. A block roughly every ten minutes is the one clock this game shares with the world
it is playing against, and it is worth hearing. The bell in the strip turns it off, and
the choice is remembered.

Proof of work is mostly reported and partly worked out: the measured hashrate, the
difficulty adjustment and the miner distribution come from the service, while the subsidy
and the halving countdown have no endpoint anywhere and are arithmetic on the height.

### The palette follows the hour

There is no theme toggle in the usual sense. The interface takes its whole palette from
the time of day — ivory at noon, near-black at night, warm through the afternoon —
interpolated across nine keyframes. `DAY` and `NIGHT` pin the clock for players who want
one look and no drift; `LIVE` lets it move.

Two stretches of the real day are deliberately skipped. Between 05:20–07:20 and
17:20–20:00 the sky passes through tones where ink and ground come close enough together
that text stops being comfortable, so the palette holds at the far end and the interface
crosses in ten seconds instead of easing through. `tests/test_daylight.py` walks all 1440
minutes and measures: body text never falls below 16:1, secondary text never below 4.8:1.

The terminal has no colours of its own. It draws on --sunken, the recessed tone already
under every field in the interface, and every colour on it is one the interface defines,
lifted just far enough to stay readable there: body text never below 7:1, everything else
never below AA, measured at all 1440 minutes. A hue the terminal alone knew about would be
a second design living inside the first.

## Commands

| Command | What it does |
|---|---|
| `HELP` / `ABOUT` | this list / what the program actually does |
| `LANG RU\|EN\|ES\|PT` | narrative language |
| `CASES` | the desk: the campaign plus taken contracts |
| `CLIENTS` | the eight employers and their contract counts |
| `BOARD <client>` | one employer's thirty-two contracts |
| `OPEN <id>` | open a case file and make it active |
| `DROP <id>` | return an unsolved contract to the board |
| `BRIEF` / `EVIDENCE` / `CLUES` | re-read the active case |
| `HINT` | spend a hint (three per case) |
| `WORD <n>` / `INDEX <word>` / `SEARCH <prefix>` | BIP-39 wordlist tools |
| `ARCHIVE <text>` | full-text search across the case files |
| `ENTROPY <hex>` | rebuild a mnemonic from 128 bits of entropy |
| `DECRYPT <12 words>` | validate a phrase and derive its addresses |
| `DERIVE` | re-print the derivation grid |
| `COMPLETE <phrase ?>` | recover the one missing word by checksum |
| `NAMEFORGE <name>` | strike a stamp: an address beginning `1` + your name |
| `RANDOM [12..24]` | generate a fresh phrase from secure randomness |
| `SYNC_LEDGER [addr]` | live balance from the Bitcoin network |
| `SWEEP` | check all three derived addresses at once |
| `TXLOG [addr]` | the most recent on-chain transactions |
| `PROVIDER [name]` | `blockstream` \| `mempool` \| `blockchain` |
| `NETINFO` | probe every explorer node and report its latency |
| `EXPLORER` | the loaded address in a block explorer |
| `JOURNAL [tool]` | the investigation journal, newest first |
| `RECALL <n>` | replay entry *n* in the tool that produced it |
| `PIN <n>` | pin an entry so `PURGE` keeps it |
| `PURGE [all]` | clear the journal |
| `STATUS` | operator status and progress |
| `COPY` | addresses to the clipboard (web only) |
| `CLEAR` / `RESET` / `EXIT` | wipe the screen / erase progress / close |

Short forms exist where they help: `?` for `HELP`, `LS` for `CASES`, `ROLL` for `RANDOM`,
`FIND` for `COMPLETE`, `SYNC` for `SYNC_LEDGER`, `LOG` for `JOURNAL`, `QUIT` for `EXIT`,
`FORGE` for `NAMEFORGE`.

Progress persists: `~/.enigma_terminal/progress.json` in the terminal build (override the
directory with `ENIGMA_TERMINAL_HOME`), `localStorage` in the browser.

## The board: 8 employers × 32 contracts

Beyond the eight hand-written campaign cases there is a board of **256 contracts** spread
across eight employers, thirty-two each, in four phases.

An employer is not a skin. It decides the **handwriting**: the way words are hidden in its
cases. Each one draws on three of the seven schemes.

| Employer | District | Who they are |
|---|---|---|
| ESCRIBANÍA CERO | Microcentro, La City | private forensic bureau |
| MARTILLERO | Recoleta | grey fund, auction house |
| BAJOFONDO | Dársena Sur | subsea data havens |
| CRUZ DEL SUR | Paseo Colón | orbital key custody |
| SANATORIO NORTE | Barrio Norte | biotech and body-lease clinics |
| MESA DE ENTRADAS | Balvanera | residual agency of a state that no longer exists |
| SALAR | Catalinas Norte | mineral and energy conglomerate |
| ALEPH | San Telmo, if the rumours are true | archivist collective, does not pay in money |

The seven schemes:

| Scheme | The trick |
|---|---|
| `index_math` | each line is a sum; the total is the word's index |
| `mirror_index` | the numbers are mirrored — the real index is 2049 minus the one given |
| `grid_coords` | the wordlist laid out 128 × 16; index = (row − 1) × 16 + column |
| `ledger_amounts` | a lot's price in satoshi *is* the index |
| `unique_prefix` | exactly one word in the list begins that way |
| `neighbour` | each word sits directly beside the one named |
| `entropy_pattern` | no words at all, sixteen bytes — feed them to `ENTROPY` |
| `redacted` | the phrase in full but for one word; the checksum gives it back |

**The board and the desk are different things.** Contracts are work on offer; case files
are your desk. Take a contract and it lands on the desk and stays there between sessions;
an unsolved one can go back (`DROP <id>`), a closed one stays forever. The counter tracks
the desk — 8 of 264 would mean nothing.

Writing 256 cases by hand would be three thousand riddles and they would be bad ones. So
the creative work lives in the two places that scale: `data/clients.json` holds the voices,
`tools/generate_cases.py` holds the eight handwritings. The generator is deterministic —
the same seed gives the same board, so a rebuild never reshuffles someone's game.

The hard constraint is the checksum: twelve arbitrary words almost never form a valid
BIP-39 phrase. So a case is built backwards — take a valid mnemonic first, then describe
each of its words in the employer's handwriting. The answer exists before the riddle.

**All 256 are machine-verified solvable.** The test suite contains a solver that follows
nothing but the clues, assembles twelve words and checks them against the fingerprint. A
handwriting that produced a clue leading nowhere would fail the build rather than cost a
player their evening.

## The investigation journal

Every move — a derivation, a balance lookup, a sweep, a wordlist or archive search, a
recovered word, a generated phrase, a spent hint, a closed case — lands in the journal.
It is shared between the terminal and the rest of the interface, survives a reload, and
lives in `localStorage` (or `~/.enigma_terminal/journal.json` in the terminal build).

**Recall** replays an entry in the tool that produced it, with the same address, query or
phrase. `RECALL <n>` does the same from the command line.

**What the journal will not remember.** A seed phrase the game does not recognise is never
written to disk in full — only a masked trace like `absurd … camera (12 words) — NOT STORED`,
and `RECALL` on such an entry says plainly that there is nothing to replay. Only the eight
case answers (published test vectors) and phrases this page generated itself are kept
whole. Pasting a working seed into the terminal does not leave it sitting on disk.

## Generative sigils

Every case, every seed phrase and every address carries its own mark, drawn with
[minidenticons](https://github.com/laurentpayot/minidenticons) (MIT, vendored into
`docs/js/vendor/` with its licence so the page pulls nothing from a CDN). Sidebar icons are
[Feather](https://feathericons.com) (MIT), vendored the same way — as element descriptors
rather than markup, because nothing in this project builds DOM out of strings.

A phrase's sigil is keyed to its SHA-256 fingerprint, not to the words themselves — the same
rule the journal follows. An unknown phrase gets a stable icon and is stored nowhere.

## What it looks like

```
nullsec@enigma:~$ DECRYPT abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about
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

nullsec@enigma:~$ SYNC_LEDGER
[NET] ESTABLISHING ENCRYPTED PROXY TO BLOCKSTREAM NODE... OK
[NET] QUERYING ADDR: 1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA
[NET] PARSING DATA STREAMS... SUCCESS
------------------------------------------------------------------
ADDRESS BALANCE ANALYSIS:
CONFIRMED BALANCE : 0.00000000 BTC
TOTAL RECEIVED    : 0.01150402 BTC
TX COUNT          : 48
------------------------------------------------------------------
[STATUS] WALLET DRAINED. HISTORY INTACT — RUN TXLOG.
```

A broken checksum looks like this, and is meant to:

```
nullsec@enigma:~$ DECRYPT abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon
[FATAL] MNEMONIC CHECKSUM INVALID. DECRYPTION FAILED.
        THE LAST WORD CARRIES THE CHECKSUM. ONE WRONG WORD BREAKS IT.
```

## About the wallets in the game

The eight campaign cases are built on **published BIP-39 test vectors** — the ones from the
Trezor specification — rather than on wallets made for the game. Three reasons:

* they are real mainnet addresses with real history. The first has carried
  transactions since 2013, so `SYNC_LEDGER` shows genuine data rather than an invention;
* their private keys are known to the entire world, so there is provably nothing in them
  worth taking. The game cannot accidentally become a leak;
* they are reproducible: anyone can check every address in any explorer.

**Want your own wallets instead?** Three steps:

1. create a wallet, write down the twelve words, send it a few satoshi;
2. compute the fingerprint:
   `python -c "from enigma_terminal.crypto_engine import fingerprint; print(fingerprint('your twelve words'))"`;
3. put it in the `fingerprint` field of the case in `data/cases.json`, rewrite the riddles,
   and run `python tools/build_web_data.py`.

The words themselves never go into the repository — the game stores only the SHA-256
fingerprint and checks what the player typed against it.

## Security

* This program **cannot and will not** crack anyone's seed phrase. It derives addresses
  from a phrase you already know and reads public blockchain data.
* The web build computes everything in your browser. The only thing that leaves the page
  is an address lookup, and it contains nothing but the address.
* **Nameforge** strikes a named stamp: a real twelve-word phrase whose first legacy
  address begins `1` and then your name. Difficulty is never `58^n`, because the character
  straight after the `1` is nowhere near uniform — twenty-two of them land about 4.3% of
  the time and the other thirty-four about 0.075%. `1Rob` therefore costs about what
  `1Andy` costs. The distribution is measured rather than assumed
  (`data/nameforge.json`, 2 million samples), and every estimate the tool shows is
  computed from it for the actual name. Long names are allowed and the wait is stated
  before the search starts, never after.
* `COMPLETE` recovers exactly one unknown word, and that limit is deliberate rather than
  unfinished: with two gaps, hundreds of thousands of phrases remain valid and the list
  stops meaning anything. The tool helps you recover a phrase you almost have; it does not
  become a search over other people's wallets.
* All the same: **never type a seed phrase that controls real funds into any program,
  this one included.**

## Repository layout

```
data/                      one source of truth for both builds
  cases.json               the eight hand-written campaign cases
  openings.json            sixteen openings and the live figures they are written around
  nameforge.json           the measured leading-character distribution Nameforge prices by
  clients.json             eight employers: voice, district, handwriting, name pools
  contracts.json           256 generated contracts (+ their solution specs)
  english.txt              the official BIP-39 wordlist (sha256 2f5eed53…)
  test_vectors.json        reference vectors from mnemonic + bip-utils
enigma_terminal/           the terminal build
  crypto_engine.py         BIP-39/32/44/49/84, secp256k1, base58check, bech32
  _ripemd160.py            fallback RIPEMD-160 for OpenSSL 3 without the legacy provider
  chain.py                 three explorers with automatic failover
  journal.py               the investigation journal, on disk
  cases.py                 case and progress loading
  store.py                 the one atomic writer both save files go through
  ui.py                    ANSI output, pseudo-logs over a real request
  game.py                  command dispatch and the game loop
docs/                      the web build; GitHub Pages publishes from here
  index.html               the shell
  css/                     terminal.css (shell and screen), gui.css (the interface)
  js/core.js               shared core: progress, case rules, search, randomisation
  js/crypto/               hash.js, secp256k1.js, encoding.js, bip39.js, wallet.js
  js/daylight.js           the palette that follows the hour
  js/term.js               the canvas terminal
  js/engine.js             the command line: the same commands as the Python build
  js/gui/                  the windowed interface over the same core (app.js, dom.js, text.js)
  js/journal.js            the journal, shared by both halves of the page
  js/identicon.js          generative sigils for cases, phrases and addresses
  js/glitch.js             the mark in the strip
  js/select.js             the language dropdown the shell builds for itself
  js/mempool.js            the explorer's client: one queued, cached connection
  js/crypto/header.js      an 80-byte block header, and the numbers inside it
  js/heartbeat.js          one watcher for the block clock, shared by the whole page
  js/chime.js              the three notes a new block makes
  js/pow.js                subsidy, halving and retarget, derived from the height
  js/storage.js            the one place that talks to localStorage
  js/opening.js            picks an opening the live figures can actually fill
  js/nameforge.js          what a stamp costs, measured rather than assumed
  js/nameforge-worker.js   one searcher, off the main thread, native PBKDF2
  js/vendor/               minidenticons and Feather (MIT), with their licences
tools/generate_cases.py    builds the 256-contract board
tools/build_web_data.py    generates the web build's data from data/
tools/measure_leading.mjs  re-measures the distribution behind nameforge.json
tools/js_vectors.mjs       runs the JS crypto under Node for the parity tests
tools/js_commands.mjs      reports the web build's command and panel surface
tools/smoke_web.mjs        opens the page in a browser and presses the buttons
tests/                     465 tests, including the Python ↔ JavaScript diff
```

## Development

```bash
pip install -e ".[dev]"
python -m pytest tests -v          # 465 tests
python tools/build_web_data.py     # required after editing data/
```

The suite is static: it reads the web build rather than running it, which is
how a call to a method that does not exist and a `t()` for a key nobody wrote
both reached the published page. `tools/smoke_web.mjs` closes that gap by
opening the real page in a real browser with the chain stubbed. It wants a
browser the Python suite does not, so it is opt-in and not part of CI:

```bash
npm install playwright && npx playwright install chromium
node tools/smoke_web.mjs
```

`data/` is the single source of truth. `docs/js/wordlist.js`, `docs/js/campaign.js`,
`docs/js/clients.js` and `docs/data/contracts.json` are generated from it, and CI fails
if any of them has drifted.

## Publishing to GitHub Pages

Repository settings → **Pages** → **Source: GitHub Actions**. From then on every push to
`main` publishes `docs/` through `.github/workflows/pages.yml`.

## Releases

Versions follow semantic versioning, with the major number reserved for changes
that invalidate a saved game. One number lives in `pyproject.toml`,
`data/cases.json` and `enigma_terminal/__init__.py`, and a test fails if the
three disagree. What changed in each is in [CHANGELOG.md](CHANGELOG.md).

## Licence

MIT — see [LICENSE](LICENSE).
