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

**A candidate is expensive.** Each one is a fresh 128 bits of entropy, a BIP-39
phrase, PBKDF2-HMAC-SHA512 over 2048 rounds, five levels of BIP-32 and a
hash160. The Python build manages a couple of hundred a second on one core, so
the estimate this module returns is what the interface must show before the
player commits to waiting — not after.
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


def normalise(name: str) -> str:
    """`andy` and `ANDY` both become `Andy`.

    One spelling per name, so two players asking for the same stamp are asking
    for the same work — and so the estimate shown matches the search run.
    """
    cleaned = name.strip()
    return cleaned[:1].upper() + cleaned[1:].lower()


def validate(name: str) -> str:
    """Normalise and check; raises :class:`NameError_` with a reason."""
    stamp = normalise(name)
    if not (MIN_LENGTH <= len(stamp) <= MAX_LENGTH):
        raise NameError_(
            f"NAME MUST BE {MIN_LENGTH}..{MAX_LENGTH} CHARACTERS. GOT {len(stamp)}.",
            kind="length",
        )
    bad = sorted({c for c in stamp if c not in BASE58})
    if bad:
        raise NameError_(
            "NOT IN THE BASE58 ALPHABET: " + ", ".join(bad)
            + ". THERE IS NO 0, O, I OR l IN AN ADDRESS.",
            kind="alphabet",
        )
    return stamp


def probability(stamp: str) -> float:
    """The chance one candidate carries this stamp.

    The first character uses the measured distribution; the rest are uniform
    over the alphabet, which is what they are that deep into the encoding.
    """
    first = LEADING.get(stamp[0], 0.0)
    return first * (1.0 / len(BASE58)) ** (len(stamp) - 1)


def expected_attempts(stamp: str) -> float:
    """Candidates needed on average. The median is about 0.69 of this."""
    chance = probability(stamp)
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


def tier(stamp: str) -> str:
    attempts = expected_attempts(stamp)
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

    @property
    def is_long(self) -> bool:
        """Longer than a coffee. The interface warns rather than refuses."""
        return self.seconds > 900


def estimate(stamp: str, rate: float) -> Estimate:
    """Expected work for ``stamp`` at ``rate`` candidates a second."""
    attempts = expected_attempts(stamp)
    return Estimate(
        stamp=stamp,
        tier=tier(stamp),
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

    @property
    def preview(self) -> str:
        """`1Andy` and then the part nobody reads."""
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
    stamp = validate(name)
    target = "1" + stamp
    started = time.monotonic()
    attempts = 0
    closest = ""
    closest_score = -1

    while True:
        mnemonic, address = candidate()
        attempts += 1

        if address.startswith(target):
            return Stamp(
                stamp=stamp,
                mnemonic=mnemonic,
                address=address,
                path=PATH,
                attempts=attempts,
                seconds=time.monotonic() - started,
                tier=tier(stamp),
                bits=math.log2(expected_attempts(stamp)),
            )

        # How much of the stamp this one did carry — the near miss the
        # interface shows so a long search has something to report.
        score = 0
        for a, b in zip(address[1:], stamp):
            if a != b:
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


def measure_rate(seconds: float = 1.0) -> float:
    """Candidates a second on this machine, measured rather than assumed."""
    started = time.monotonic()
    count = 0
    while time.monotonic() - started < seconds:
        candidate()
        count += 1
    elapsed = time.monotonic() - started
    return count / elapsed if elapsed > 0 else 0.0


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
