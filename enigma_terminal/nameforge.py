"""Nameforge: strike a named stamp into the chain.

The player picks a short name and the tool searches for a twelve-word phrase
whose first legacy address carries that name right after the leading `1`. The
phrase is real, the address is real, and the only thing cosmetic about it is
the resemblance to a name.

Two things about this are easy to get wrong, and both would show up as a lie
told to the player rather than as a crash.

**Difficulty is not 58^n.** The character immediately after the `1` is nowhere
near uniform: twenty-two of them land about 4.3% of the time and the other
thirty-four about 0.075%, a spread of roughly sixty. `1Rob` therefore costs
about as much as `1Andy` — one character shorter, one much rarer letter. The
distribution is measured rather than assumed, and lives in
``data/nameforge.json``; every estimate here is computed from it, per name.

**Case is a choice, not a detail.** Base58 tells `A` from `a`, so a name can be
struck two ways: exactly as the player spelled it, or in whatever case turns up
first. The second is cheaper — a name of six letters that each exist in both
cases is 32 times cheaper — and it also strikes names the first cannot, because
Base58 keeps `o` but not `O`, and `L` but not `l`. Both are honest; they are
different searches, and each is priced as itself.

**A candidate is expensive.** Each one is a fresh 128 bits of entropy, a BIP-39
phrase, PBKDF2-HMAC-SHA512 over 2048 rounds, five levels of BIP-32 and a
hash160, and there may be millions of them.

Nothing here draws anything. The searching a player sees happens in the
browser, in `docs/js/nameforge.js` and its worker; this module is the reference
the tests hold that one against — the same arithmetic and the same derivation,
checked to agree to nine significant figures in both case modes.
"""

from __future__ import annotations

import json
import math
import secrets
import time
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from .crypto_engine import (
    ExtendedKey,
    entropy_to_mnemonic,
    p2pkh_address,
    to_seed,
)

_DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "nameforge.json"

#: Base58 has no 0, O, I or l — a name containing one can never be struck.
BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

#: The path the stamp is read from. Fixed, because an address only means
#: anything alongside the path that produced it.
PATH = "m/44'/0'/0'/0/0"

MIN_LENGTH = 2
MAX_LENGTH = 6


def _load_distribution() -> dict[str, float]:
    payload = json.loads(_DATA_FILE.read_text(encoding="utf-8"))
    return {str(k): float(v) for k, v in payload["leading"].items()}


LEADING = _load_distribution()


class NameError_(ValueError):
    """Raised when a name cannot be struck, with ``kind`` saying why."""

    def __init__(self, message: str, kind: str) -> None:
        super().__init__(message)
        self.kind = kind


def variants(char: str, any_case: bool = False) -> str:
    """The address characters that would satisfy this position of a name.

    Everything else here is built on this. In exact mode a character stands
    for itself and for nothing else. In any-case mode it stands for both of
    its cases — but only for those Base58 actually has, and Base58 is not
    symmetric: it keeps `o` but not `O`, `i` but not `I`, `L` but not `l`. So
    twenty-three letters have two forms, three have one, and `0` has none in
    either mode.
    """
    if not any_case:
        return char if char in BASE58 else ""
    both = (char.lower(), char.upper())
    return "".join(dict.fromkeys(c for c in both if c in BASE58))


def normalise(name: str) -> str:
    """Trim, and nothing else.

    This used to force `andy` and `ANDY` both to `Andy`, one spelling per name.
    That rule was a stand-in for a decision the player was never offered; now
    that they choose the case themselves, taking it away from them would be
    the surprising thing. What they typed is what gets struck.
    """
    return name.strip()


def validate(name: str, any_case: bool = False) -> str:
    """Trim and check; raises :class:`NameError_` with a reason."""
    stamp = normalise(name)
    if not (MIN_LENGTH <= len(stamp) <= MAX_LENGTH):
        raise NameError_(
            f"NAME MUST BE {MIN_LENGTH}..{MAX_LENGTH} CHARACTERS. GOT {len(stamp)}.",
            kind="length",
        )
    bad = sorted({c for c in stamp if not variants(c, any_case)})
    if bad:
        reason = (
            ". NO ADDRESS CARRIES THESE IN EITHER CASE."
            if any_case
            else ". THERE IS NO 0, O, I OR l IN AN ADDRESS —"
            " ANY-CASE MODE STRIKES o, i AND L INSTEAD."
        )
        raise NameError_(
            "NOT IN THE BASE58 ALPHABET: " + ", ".join(bad) + reason,
            kind="alphabet",
        )
    return stamp


def matches(address: str, stamp: str, any_case: bool = False) -> bool:
    """Does this address carry the stamp straight after its leading `1`?"""
    carried = address[1 : 1 + len(stamp)]
    return carried.lower() == stamp.lower() if any_case else carried == stamp


def probability(stamp: str, any_case: bool = False) -> float:
    """The chance one candidate carries this stamp.

    Each position contributes the share of addresses whose character there is
    one this name accepts. The first uses the measured distribution; the rest
    are uniform over the alphabet, which is what they are that deep into the
    encoding. Any-case mode simply accepts more characters per position, so
    the same arithmetic prices both modes.
    """
    chance = sum(LEADING.get(c, 0.0) for c in variants(stamp[0], any_case))
    for char in stamp[1:]:
        chance *= len(variants(char, any_case)) / len(BASE58)
    return chance


def expected_attempts(stamp: str, any_case: bool = False) -> float:
    """Candidates needed on average. The median is about 0.69 of this."""
    chance = probability(stamp, any_case)
    return math.inf if chance <= 0 else 1.0 / chance


#: What the interface calls each band. Cut on expected attempts rather than on
#: length, because length is not what makes a name expensive.
TIERS = (
    (10_000, "COMMON"),
    (500_000, "UNCOMMON"),
    (20_000_000, "RARE"),
    (1_000_000_000, "EPIC"),
    (math.inf, "LEGENDARY"),
)


def tier(stamp: str, any_case: bool = False) -> str:
    attempts = expected_attempts(stamp, any_case)
    for ceiling, name in TIERS:
        if attempts < ceiling:
            return name
    return "LEGENDARY"


@dataclass(frozen=True)
class Estimate:
    """What to tell the player before they decide to wait."""

    stamp: str
    tier: str
    attempts: float
    bits: float
    seconds: float
    any_case: bool = False

    @property
    def is_long(self) -> bool:
        """Longer than a coffee. The interface warns rather than refuses."""
        return self.seconds > 900


def estimate(stamp: str, rate: float, any_case: bool = False) -> Estimate:
    """Expected work for ``stamp`` at ``rate`` candidates a second."""
    attempts = expected_attempts(stamp, any_case)
    return Estimate(
        stamp=stamp,
        any_case=any_case,
        tier=tier(stamp, any_case),
        attempts=attempts,
        # The entropy actually searched, which is log2 of the odds — not the
        # 128 bits of the phrase, which is a different number entirely.
        bits=math.log2(attempts) if attempts != math.inf else math.inf,
        seconds=attempts / rate if rate > 0 else math.inf,
    )


@dataclass(frozen=True)
class Stamp:
    """A struck stamp: a real phrase, and the address it was struck for."""

    stamp: str
    mnemonic: str
    address: str
    path: str
    attempts: int
    seconds: float
    tier: str
    bits: float
    any_case: bool = False

    @property
    def preview(self) -> str:
        """`1Andy` and then the part nobody reads.

        Sliced off the address, never off the name, so an any-case strike shows
        the case it actually landed in rather than the one that was asked for.
        """
        kept = 1 + len(self.stamp)
        return self.address[:kept] + "•" * (len(self.address) - kept)


def candidate() -> tuple[str, str]:
    """One fresh phrase and the address at :data:`PATH`.

    128 bits from the OS random source — the same procedure a wallet follows,
    which is exactly why the result carries the same warning a wallet does.
    """
    mnemonic = entropy_to_mnemonic(secrets.token_bytes(16))
    node = ExtendedKey.from_seed(to_seed(mnemonic)).derive_path(PATH)
    return mnemonic, p2pkh_address(node.public_key)


def forge(
    name: str,
    *,
    any_case: bool = False,
    limit: int | None = None,
    deadline: float | None = None,
    on_progress: Callable[[int, str], bool | None] | None = None,
    progress_every: int = 500,
) -> Stamp | None:
    """Search until the stamp is struck, or until told to stop.

    ``on_progress`` is handed the attempt count and the closest address seen so
    far; returning False stops the search. Returns None when it stopped without
    a hit, so the caller can tell "not found yet" from "found".
    """
    stamp = validate(name, any_case)
    started = time.monotonic()
    attempts = 0
    closest = ""
    closest_score = -1

    while True:
        mnemonic, address = candidate()
        attempts += 1

        if matches(address, stamp, any_case):
            return Stamp(
                stamp=stamp,
                any_case=any_case,
                mnemonic=mnemonic,
                address=address,
                path=PATH,
                attempts=attempts,
                seconds=time.monotonic() - started,
                tier=tier(stamp, any_case),
                bits=math.log2(expected_attempts(stamp, any_case)),
            )

        # How much of the stamp this one did carry — the near miss the
        # interface shows so a long search has something to report. Scored by
        # the same rule the hit is, or a near miss could outrank a hit.
        score = 0
        for a, b in zip(address[1:], stamp):
            if (a.lower() != b.lower()) if any_case else (a != b):
                break
            score += 1
        if score > closest_score:
            closest_score, closest = score, address

        if limit is not None and attempts >= limit:
            return None
        if deadline is not None and time.monotonic() >= deadline:
            return None
        if on_progress and attempts % progress_every == 0:
            if on_progress(attempts, closest) is False:
                return None


def humanise(seconds: float) -> str:
    """A duration the way a person would say it."""
    if seconds == math.inf:
        return "never"
    if seconds < 1:
        return "under a second"
    if seconds < 90:
        return f"{seconds:.0f} seconds"
    if seconds < 5400:
        return f"{seconds / 60:.0f} minutes"
    if seconds < 172800:
        return f"{seconds / 3600:.1f} hours"
    return f"{seconds / 86400:.1f} days"
