"""The sixteen openings, and the live chain figures they are written around.

The game used to open on one fixed prologue. It now opens on one of sixteen,
chosen at random, most of them written around numbers read off the chain a
moment earlier: what a coin costs, which pool took the last block, how deep the
mempool is, how long until the halving.

The rule that keeps it honest is that an opening is only offered once every
figure it asks for has actually arrived. Four of them ask for nothing and are
always available, so `--offline`, a dead explorer or a rate limit still opens on
prose that reads correctly rather than on a sentence with a hole in it.
"""

from __future__ import annotations

import json
import random
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

_DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "openings.json"

#: Placeholders an opening may use. Kept here as well as in the data file so a
#: text that invents one fails a test rather than printing a literal `{brace}`.
PLACEHOLDER = re.compile(r"\{(\w+)\}")


@dataclass(frozen=True)
class Opening:
    id: str
    needs: tuple[str, ...]
    lines: dict[str, list[str]]

    def render(self, lang: str, figures: dict[str, str]) -> list[str]:
        """The opening in ``lang``, with its placeholders filled in."""
        chosen = self.lines.get(lang) or self.lines["en"]
        return [
            PLACEHOLDER.sub(lambda m: str(figures.get(m.group(1), m.group(0))), line)
            for line in chosen
        ]


def _load() -> tuple[tuple[Opening, ...], dict[str, str]]:
    try:
        payload = json.loads(_DATA_FILE.read_text(encoding="utf-8"))
    except (FileNotFoundError, ValueError) as exc:  # pragma: no cover - packaging
        raise RuntimeError(f"openings missing or unreadable at {_DATA_FILE}") from exc
    openings = tuple(
        Opening(
            id=str(item["id"]),
            needs=tuple(item.get("needs", ())),
            lines={str(k): list(v) for k, v in item["lines"].items()},
        )
        for item in payload["openings"]
    )
    return openings, dict(payload["variables"])


OPENINGS, VARIABLES = _load()


def available(figures: dict[str, str]) -> list[Opening]:
    """The openings every one of whose figures is present and non-empty."""
    return [o for o in OPENINGS if all(figures.get(n) for n in o.needs)]


def choose(figures: dict[str, str], rng: random.Random | None = None) -> Opening:
    """One opening the given figures can actually fill.

    Never raises: the four that ask for nothing are always in the running, so
    an empty ``figures`` still returns something printable.
    """
    pool = available(figures) or [o for o in OPENINGS if not o.needs]
    return (rng or random).choice(pool)


def group(number: Any) -> str:
    """964268 -> '964 268'. Thin spaces are how a chain height is usually set."""
    try:
        return f"{int(number):,}".replace(",", " ")
    except (TypeError, ValueError):
        return ""


def figures_from_chain(client: Any) -> dict[str, str]:
    """Read what the openings can use off the live chain.

    Every figure is independent: one endpoint being slow, rate-limited or down
    costs its own variables and nothing else, and the openings that do not need
    them stay available. Returns whatever arrived.
    """
    out: dict[str, str] = {}
    if client is None or getattr(client, "offline", False):
        return out

    def attempt(name: str, work) -> None:
        try:
            value = work()
        except Exception:  # noqa: BLE001 - a missing figure is not an error here
            return
        if value:
            out[name] = value

    attempt("price", lambda: group(client.price_usd()))

    def tip_figures() -> str:
        tip = client.chain_tip()
        out["height"] = group(tip.get("height"))
        pool = (tip.get("extras") or {}).get("pool") or {}
        if pool.get("name"):
            out["pool"] = str(pool["name"])
        return ""

    attempt("_tip", tip_figures)
    attempt("fee", lambda: str(client.best_fee()))
    attempt("mempool", lambda: group(client.mempool_count()))

    def mining_figures() -> str:
        top, share, hashrate = client.top_pool()
        if top:
            out["topPool"] = str(top)
            out["topShare"] = f"{share:.1f}"
        if hashrate:
            out["hashrate"] = hashrate
        return ""

    attempt("_mining", mining_figures)
    attempt("halvingDays", lambda: str(client.days_to_halving()))

    out.pop("_tip", None)
    out.pop("_mining", None)
    return out
