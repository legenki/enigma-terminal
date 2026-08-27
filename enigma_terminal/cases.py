"""Quest content and player progress.

Case data lives in ``data/cases.json`` so the Python build and the web build
share one source of truth. Answers are never stored in plain text — each case
carries the sha256 fingerprint of its mnemonic, so solving is checked by hashing
whatever the player typed.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .crypto_engine import fingerprint
from .store import atomic_write_text

_ROOT = Path(__file__).resolve().parent.parent
CASES_FILE = _ROOT / "data" / "cases.json"
CONTRACTS_FILE = _ROOT / "data" / "contracts.json"
CLIENTS_FILE = _ROOT / "data" / "clients.json"

LANGUAGES = ("ru", "en", "es", "pt")


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


@dataclass
class Progress:
    """Solved cases, used hints and the contracts on the desk."""

    solved: set[int] = field(default_factory=set)
    hints_used: dict[int, int] = field(default_factory=dict)
    taken: set[int] = field(default_factory=set)
    path: Path | None = None

    @classmethod
    def default_path(cls) -> Path:
        base = os.environ.get("ENIGMA_TERMINAL_HOME")
        if base:
            return Path(base) / "progress.json"
        return Path.home() / ".enigma_terminal" / "progress.json"

    @classmethod
    def load(cls, path: Path | None = None) -> Progress:
        path = path or cls.default_path()
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (FileNotFoundError, ValueError, OSError):
            return cls(path=path)
        # Valid JSON of the wrong shape used to crash the game at startup with
        # an AttributeError, while the journal in the same state came back
        # empty. A hand-edited save is a fresh save, not a stack trace, and the
        # web build has always read its own store this way.
        if not isinstance(data, dict):
            return cls(path=path)
        return cls(
            solved=_int_set(data.get("solved")),
            hints_used=_int_map(data.get("hints_used")),
            # Saves made before the contract board existed simply have none.
            taken=_int_set(data.get("taken")),
            path=path,
        )

    def save(self) -> bool:
        if self.path is None:
            return True
        return atomic_write_text(
            self.path,
            json.dumps(
                {"solved": sorted(self.solved),
                 "hints_used": {str(k): v for k, v in self.hints_used.items()},
                 "taken": sorted(self.taken)},
                indent=2,
            ),
        )

    def mark_solved(self, case_id: int) -> None:
        self.solved.add(case_id)
        self.save()

    def use_hint(self, case_id: int) -> int:
        self.hints_used[case_id] = self.hints_used.get(case_id, 0) + 1
        self.save()
        return self.hints_used[case_id]

    def take(self, case_id: int) -> bool:
        """Pick a contract up off the board. True the first time."""
        if case_id in self.taken:
            return False
        self.taken.add(case_id)
        self.save()
        return True

    def drop(self, case_id: int) -> bool:
        """Put an unsolved contract back. Closed work stays on the desk."""
        if case_id in self.solved or case_id not in self.taken:
            return False
        self.taken.discard(case_id)
        self.save()
        return True

    def reset(self) -> None:
        self.solved.clear()
        self.hints_used.clear()
        self.taken.clear()
        self.save()


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
        self._prologue: dict = data["prologue"]
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
                import warnings
                warnings.warn(f"Failed to load contracts: {e}")
                self.contracts = []
            try:
                roster = json.loads(CLIENTS_FILE.read_text(encoding="utf-8"))
                self.clients = roster["clients"]
            except FileNotFoundError:
                self.clients = []
            except (ValueError, KeyError) as e:
                import warnings
                warnings.warn(f"Failed to load clients: {e}")
                self.clients = []

    @property
    def all_cases(self) -> list[Case]:
        return self.cases + self.contracts

    def client(self, slug: str) -> dict | None:
        return next((c for c in self.clients if c["slug"] == slug), None)

    def cases_for_client(self, slug: str) -> list[Case]:
        return [case for case in self.contracts if case.client == slug]

    def caseload(self, progress: Progress) -> list[Case]:
        """The desk: the campaign plus contracts taken or already closed.

        Solved work counts even if it was never formally taken — a phrase pasted
        straight into DECRYPT closes a case just the same.
        """
        wanted = progress.taken | progress.solved
        return self.cases + [case for case in self.contracts if case.id in wanted]

    def prologue(self, lang: str) -> list[str]:
        return list(_pick(self._prologue, lang))

    def get(self, case_id: int) -> Case | None:
        return next((c for c in self.all_cases if c.id == case_id), None)

    def is_unlocked(self, case: Case, progress: Progress) -> bool:
        return all(req in progress.solved for req in case.requires)

    def find_by_mnemonic(self, mnemonic: str) -> Case | None:
        return next((c for c in self.all_cases if c.matches(mnemonic)), None)

    def search(self, query: str, lang: str,
               progress: Progress | None = None) -> list[tuple[Case, list[str]]]:
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
            if progress is None or case.id in progress.solved:
                hits += [
                    line for line in case.epilogue(lang) if needle in line.lower()
                ]
            if hits:
                results.append((case, hits))
        return results
