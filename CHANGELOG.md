# Changelog

Versions follow [semantic versioning](https://semver.org). For a game rather
than a library, the major number is reserved for changes that invalidate a saved
game or replace content a player already has; minor is new content and features;
patch is fixes.

One version number lives in three files — `pyproject.toml`, `data/cases.json`
and `enigma_terminal/__init__.py` — and a test fails if they disagree.

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
