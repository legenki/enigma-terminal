"""Quest content, as the generator and the tests read it.

Case data lives in ``data/cases.json``, which is the source the web build is
generated from. Answers are never stored in plain text — each case carries the
sha256 fingerprint of its mnemonic, so solving is checked by hashing whatever
the player typed.

There is no `Progress` here any more. It held the solved set, the used hints
and the taken contracts on disk for a Python client that no longer exists; the
browser keeps all of that in its own store, and a second copy of the rules with
no runtime behind it would only be a second thing to get wrong.
"""

from __future__ import annotations

import json
import warnings
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .crypto_engine import fingerprint

_ROOT = Path(__file__).resolve().parent.parent
CASES_FILE = _ROOT / "data" / "cases.json"
CONTRACTS_FILE = _ROOT / "data" / "contracts.json"
CLIENTS_FILE = _ROOT / "data" / "clients.json"

#: Menu order, matching docs/js/core.js. English leads because it is the
#: language the project is written and documented in; Russian sits at the end.
LANGUAGES = ("en", "es", "pt", "ru")


def _pick(value: Any, lang: str) -> Any:
    """Resolve a ``{"ru": ..., "en": ...}`` bundle down to one language."""
    if isinstance(value, dict) and set(value) & set(LANGUAGES):
        return value.get(lang) or value.get("en") or next(iter(value.values()))
    return value


@dataclass(frozen=True)
class Case:
    id: int
    difficulty: int
    kind: str
    fingerprint: str
    raw: dict
    requires: tuple[int, ...] = ()
    client: str | None = None
    act: int = 0
    archetype: str = ""

    def codename(self, lang: str) -> str:
        return _pick(self.raw["codename"], lang)

    def brief(self, lang: str) -> list[str]:
        return list(_pick(self.raw["brief"], lang))

    def evidence(self, lang: str) -> list[str]:
        return list(_pick(self.raw["evidence"], lang))

    def clues(self, lang: str) -> list[str]:
        return list(_pick(self.raw["clues"], lang))

    def hints(self, lang: str) -> list[str]:
        return list(_pick(self.raw["hints"], lang))

    def epilogue(self, lang: str) -> list[str]:
        return list(_pick(self.raw["epilogue"], lang))

    def matches(self, mnemonic: str) -> bool:
        """Constant-shape check: hash what the player typed, compare fingerprints."""
        return fingerprint(mnemonic) == self.fingerprint


def _int_set(value: Any) -> set[int]:
    """Every id in ``value`` that is an integer; anything else is dropped."""
    if not isinstance(value, list):
        return set()
    out = set()
    for item in value:
        try:
            out.add(int(item))
        except (TypeError, ValueError):
            continue
    return out


def _int_map(value: Any) -> dict[int, int]:
    """The int->int pairs in ``value``; anything else is dropped."""
    if not isinstance(value, dict):
        return {}
    out = {}
    for key, count in value.items():
        try:
            out[int(key)] = int(count)
        except (TypeError, ValueError):
            continue
    return out


def _to_case(item: dict) -> Case:
    return Case(
        id=item["id"],
        difficulty=item["difficulty"],
        kind=item["kind"],
        fingerprint=item["fingerprint"],
        requires=tuple(item.get("requires", ())),
        client=item.get("client"),
        act=item.get("act", 0),
        archetype=item.get("archetype", ""),
        raw=item,
    )


class Campaign:
    """The eight hand-written cases, plus the 256-case contract board."""

    def __init__(self, path: Path | None = None, *, contracts: bool = True) -> None:
        data = json.loads((path or CASES_FILE).read_text(encoding="utf-8"))
        self.meta: dict = data["meta"]
        self.cases: list[Case] = [_to_case(item) for item in data["cases"]]

        self.clients: list[dict] = []
        self.contracts: list[Case] = []
        if contracts:
            try:
                board = json.loads(CONTRACTS_FILE.read_text(encoding="utf-8"))
                self.contracts = [_to_case(item) for item in board["cases"]]
            except FileNotFoundError:
                self.contracts = []   # the campaign stands on its own
            except (ValueError, KeyError) as e:
                warnings.warn(f"Failed to load contracts: {e}")
                self.contracts = []
            try:
                roster = json.loads(CLIENTS_FILE.read_text(encoding="utf-8"))
                self.clients = roster["clients"]
            except FileNotFoundError:
                self.clients = []
            except (ValueError, KeyError) as e:
                warnings.warn(f"Failed to load clients: {e}")
                self.clients = []

    @property
    def all_cases(self) -> list[Case]:
        return self.cases + self.contracts

    def client(self, slug: str) -> dict | None:
        return next((c for c in self.clients if c["slug"] == slug), None)

    def cases_for_client(self, slug: str) -> list[Case]:
        return [case for case in self.contracts if case.client == slug]

    def get(self, case_id: int) -> Case | None:
        return next((c for c in self.all_cases if c.id == case_id), None)

    def find_by_mnemonic(self, mnemonic: str) -> Case | None:
        return next((c for c in self.all_cases if c.matches(mnemonic)), None)

    def search(self, query: str, lang: str,
               solved: set[int] | None = None) -> list[tuple[Case, list[str]]]:
        """Full-text search across the archive in one language.

        Narrative only: briefs, evidence and codenames. Clue lines are the
        puzzle itself, and indexing them would turn this into a lookup table
        that answers cases rather than finding them.

        Epilogues join the index only once a case is closed — searching them
        earlier would hand the player the ending.
        """
        needle = query.strip().lower()
        if not needle:
            return []
        results: list[tuple[Case, list[str]]] = []
        for case in self.all_cases:
            hits: list[str] = []
            if needle in case.codename(lang).lower():
                hits.append(case.codename(lang))
            for attr in ("brief", "evidence"):
                hits += [
                    line for line in getattr(case, attr)(lang)
                    if needle in line.lower()
                ]
            if solved is None or case.id in solved:
                hits += [
                    line for line in case.epilogue(lang) if needle in line.lower()
                ]
            if hits:
                results.append((case, hits))
        return results
