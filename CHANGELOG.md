# Changelog

Versions follow [semantic versioning](https://semver.org). For a game rather
than a library, the major number is reserved for changes that invalidate a saved
game or replace content a player already has; minor is new content and features;
patch is fixes.

One version number lives in three files — `pyproject.toml`, `data/cases.json`
and `enigma_terminal/__init__.py` — and a test fails if they disagree.

Cutting a release is: bump those three, write the entry below, then push a tag
(`git tag -a v2.1.0 -m "…" && git push origin v2.1.0`). The Release workflow
refuses a tag that does not match the declared version and takes the published
notes from the entry, so the tag, the code and these notes cannot drift apart.

## 2.2.1

### The ledger would not open

Pressing LEDGER threw `T[key] is undefined` and the panel never appeared. The
redesign in 2.2.0 asked the dictionary for six strings that were never added to
it — `source`, `path`, `address`, `netDown`, and `used`/`unused` for the badges
on the paths table. `t` is `T[key][lang] || T[key].en`, so a key that does not
exist does not fall back to anything: it throws, and it throws while the panel
is being built, which loses the whole panel rather than one label.

The six are in, in all four languages.

### Two tests that would have caught it

The existing dictionary test checked that every key it *found* carried all four
languages. It could not know about a key nobody had written. There is now one
reading it from the other end: every `t('…')` and `tf('…')` in the panels must
resolve, both branches of a ternary included — which is where `used` and
`unused` were hiding.

`tools/smoke_web.mjs` opens the built page in a real browser, stubs the chain
and presses the buttons: every panel in turn, a seed derived, an address read,
the history paged to its end, and the same read with the explorer refusing to
answer. Both of the last two bugs — the Explorer's missing method and this one —
were invisible to every static check in the suite, because nothing had ever
executed a panel. It needs a browser, so it is opt-in rather than part of CI.

### Also

- `secondsUnit` is `seconds`, the name the rest of the unit words use. It had
  been renamed around a collision that no longer exists, and the remapping it
  needed was the one place a string reaching `t` was not a key.
- `.badge--muted` had no rule, so the `unused` badge would have drawn with no
  colour of its own.

## 2.2.0

### The Explorer's address view was broken

Looking up an address threw `this.chainExplorer.addressState is not a function`
and showed the error in place of the wallet. The method never existed: the
field names the panel read — `receivedAmount`, `largestReceivedTxAmount` —
belong to the API this build moved away from, and the move left the call
behind. Every structural test still passed, because a call to a method that
does not exist looks exactly like a call to one that does until it runs.

`addressState` now exists on the explorer client and returns what esplora
actually serves. `largestReceivedTxAmount` is gone rather than faked: that
endpoint cannot know it, and a figure the source cannot know is not a figure.

There is a test for the class of bug now — it reads every `this.<client>.x()`
call in the panels and fails if the client has no such method.

### The ledger is one read

It was three buttons: a balance, a sweep of the three derivation paths, and a
transaction list truncated to ten. Reading an address meant pressing all three
and assembling the answer yourself.

**READ** now does all of it:

- The confirmed balance as the headline, set large, with the dollar value
  beside it when a price has arrived and nothing at all when it has not.
- Pending, received, sent, transaction count, unspent outputs, source.
- The three derivation paths beside it whenever a seed is loaded.
- The whole history, paged properly. Esplora answers 25 at a time and
  continues from the last txid seen; `transactionPage` follows that, so an
  address with 58 transactions shows 58 rather than the first ten.
- Each row carries direction, amount, block height, time, fee, input and
  output counts, and a link to the transaction.

## 2.1.0

**Nameforge** — a new tool on the desk and a new terminal command. Pick a short
name and it searches for a real twelve-word phrase whose first legacy address
begins `1` and then that name. The phrase is real and the address is real; the
resemblance to a name is the only cosmetic part.

### Difficulty is measured, not assumed

The obvious model for this is `58^n` and it is wrong. The character straight
after the leading `1` is nowhere near uniform: twenty-two of them land about
4.3% of the time and the other thirty-four about 0.075%, a spread of roughly
sixty. Measured over two million addresses, kept in `data/nameforge.json`.

What follows from it:

- `1Rob` costs about what `1Andy` costs — one character shorter, one much rarer
  letter — so rarity is computed per name and never from its length.
- Every figure the tool shows is derived from that measurement and from a speed
  it measures on the device in front of it, not from a table.
- The wait is stated before the search starts, never after. Long names are
  allowed to run; they are simply never a surprise.

### How it runs

- A worker pool off the main thread, one per core less one, with a progress
  bar, a live estimate of what is left, the closest near-miss so far and a stop
  button.
- PBKDF2 goes through WebCrypto in the worker: the same 2048 rounds and
  byte-for-byte the same seed, about forty times faster because it is native.
- Entropy comes from `crypto.getRandomValues`, never `Math.random`, and there is
  a test that reads the worker with its comments stripped to make sure.
- Matching is case-sensitive, because Base58 is. Base58 also has no `0`, `O`,
  `I` or `l`, so a name carrying one is refused rather than searched for
  forever — though normalising rescues `lex` and `AnO`, whose only problem was
  their case.

### Faster derivation, everywhere

`child()` computed a BIP-32 fingerprint at every level, and a fingerprint is a
point multiplication. Only xprv serialisation ever reads one, so the address
path was doing six multiplications where three suffice — on every DECRYPT, in
both builds. Nodes now hold their parent and resolve it on demand: 85 to 149
candidates a second in the browser, 19 to 50 in the terminal.

### Also

- The sidebar has eleven rows and there are ten digits, so Nameforge answers
  **F**. The digits keep their order, so nothing a player already knew moved.
- Case completeness in `tests/test_cases.py` was checked in two of the four
  shipped languages; the tuple driving it still read `("ru", "en")`.

## 2.0.0

The world moves to the present, and the game opens differently every time.

**Major, because saved games do not survive it.** The contract board was rebuilt
from a new seed, so all 256 contract answers changed; a save holding a solved
contract now describes a case that no longer exists. The eight hand-written
campaign cases are untouched.

### The world

- Buenos Aires is now the present — or a version of it — instead of 2077. The
  geography, the districts and the eight clients are unchanged; only the dateline
  and the tense went.
- The single fixed prologue is replaced by **sixteen openings**, one chosen at
  random on boot, in all four languages.
- Most of them are written around figures read off the chain a moment earlier:
  what a coin costs, which pool took the last block, the fastest fee, how deep
  the mempool is, the 24-hour hashrate, the leading pool's share, days to the
  halving.
- An opening is only offered once every figure it needs has arrived, and four
  need nothing at all — so `--offline`, a rate limit or a dead explorer still
  opens on prose that reads correctly rather than on a sentence with a hole.

### Interface

- Russian moves to the bottom of the language menu; English leads. The page still
  opens in whatever the browser asks for.
- The terminal's `--lang` default is now `en` rather than `ru`.

### Under it

- The contract-board seed is `enigma-terminal/contract-board/v2`, carrying the
  current name. It had kept a pre-rename one through two renames because editing
  it replaces the board rather than renaming it.
- `mempool.space` prices are a new source; the block clock and the opening now
  share one explorer client and therefore one rate limit and one cache.
- Case completeness was only ever checked in two of the four shipped languages.
  It is checked in all four now, and Spanish and Portuguese were in fact complete.

## 1.0.0

First public build. Eight campaign cases, a 256-contract board, four languages,
and two front ends — a Python terminal and a browser build — deriving
bit-for-bit identical addresses from real BIP-39/32/44/49/84 against the live
Bitcoin network.
