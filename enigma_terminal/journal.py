"""The detective's case book.

One persistent record of every move made in any tool, with enough payload to
replay it. The web build keeps the same structure in localStorage; this one
lives next to the progress file.

One rule matters more than the rest: a seed phrase the player typed in and that
the game does not recognise is never written to disk. Only phrases the game
already knows (the eight case answers, all published test vectors) and phrases
this session generated are stored in full. Anything else is recorded masked, so
pasting a live wallet into the terminal cannot leave it sitting on disk.

That covers the address the phrase derives to as well. It is not the phrase and
does not lead back to it, but it is the wallet's public name: written out in
full it is enough for anyone reading this file to pull the balance and the
whole transaction history off any explorer. A masked phrase gets a masked
address to go with it.
"""

from __future__ import annotations

import json
import os
import time
from collections.abc import Iterator
from dataclasses import dataclass, field, replace
from pathlib import Path
from typing import Any

from .store import atomic_write_text

MAX_ENTRIES = 400

#: Tools that can write to the journal, and how they are labelled.
TOOLS: dict[str, str] = {
    "decrypt": "Decrypt",
    "ledger": "Ledger",
    "sweep": "Sweep",
    "txlog": "Tx log",
    "search": "Wordlist",
    "archive": "Archive",
    "complete": "Recovery",
    "random": "Randomizer",
    "forge": "Nameforge",
    "case": "Case",
    "hint": "Hint",
}

STATUS_STYLES = {"ok": "green", "warn": "amber", "danger": "red", "info": "grey"}


def mask_mnemonic(mnemonic: str) -> str:
    """Redact a phrase the game has no business remembering."""
    words = str(mnemonic).split()
    if len(words) < 3:
        return "•••"
    return f"{words[0]} … {words[-1]} ({len(words)} words)"


def mask_address(address: str) -> str:
    """Redact an address belonging to a phrase the game does not recognise."""
    text = str(address)
    if len(text) < 14:
        return "•••"
    return f"{text[:6]}…{text[-4:]}"


@dataclass
class Entry:
    id: int
    at: float
    tool: str
    title: str
    detail: str = ""
    status: str = "info"
    payload: dict[str, Any] = field(default_factory=dict)
    pinned: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id, "at": int(self.at * 1000), "tool": self.tool,
            "title": self.title, "detail": self.detail, "status": self.status,
            "payload": self.payload, "pinned": self.pinned,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Entry:
        return cls(
            id=int(data.get("id", 0)),
            at=float(data.get("at", 0)) / 1000,
            tool=str(data.get("tool", "")),
            title=str(data.get("title", "")),
            detail=str(data.get("detail", "")),
            status=str(data.get("status", "info")),
            payload=dict(data.get("payload") or {}),
            pinned=bool(data.get("pinned", False)),
        )

    @property
    def clock(self) -> str:
        return time.strftime("%H:%M:%S", time.localtime(self.at))


class Journal:
    """Newest entry first, matching how both front-ends list it."""

    def __init__(self, path: Path | None = None) -> None:
        self.path = path or self.default_path()
        self.entries: list[Entry] = self._read()

    @staticmethod
    def default_path() -> Path:
        base = os.environ.get("ENIGMA_TERMINAL_HOME")
        if base:
            return Path(base) / "journal.json"
        return Path.home() / ".enigma_terminal" / "journal.json"

    def _read(self) -> list[Entry]:
        try:
            raw = json.loads(self.path.read_text(encoding="utf-8"))
        except (FileNotFoundError, ValueError, OSError):
            return []
        if not isinstance(raw, list):
            return []
        return [Entry.from_dict(item) for item in raw if isinstance(item, dict)]

    def save(self) -> bool:
        """Write the journal out, replacing the old file in one step."""
        return atomic_write_text(
            self.path,
            json.dumps(
                [entry.to_dict() for entry in self.entries], indent=2, ensure_ascii=False
            ),
        )

    def refresh(self) -> list[Entry]:
        self.entries = self._read()
        return self.entries

    def push(self, tool: str, title: str, *, detail: str = "", status: str = "info",
             payload: dict[str, Any] | None = None) -> Entry:
        # Append onto what is on disk rather than onto what this process last
        # saw, so a second terminal sharing this home does not have its entries
        # erased by this one. Two pushes landing in the same instant can still
        # cost one of them — closing that needs a lock file, which is more
        # machinery than a single-player journal earns. What the atomic write
        # in store.py guarantees is that the loser is a lost entry and never a
        # damaged file.
        self.entries = self._read()
        entry = Entry(
            # The newest entry by timestamp is not reliably the highest id: a
            # clock that steps back, or an interleaved write from that second
            # terminal, is enough to hand out a number twice.
            id=max((e.id for e in self.entries), default=0) + 1,
            at=time.time(),
            tool=tool,
            title=title,
            detail=detail,
            status=status,
            payload=payload or {},
        )
        self.entries.insert(0, entry)
        self._trim()
        self.save()
        return entry

    def _trim(self) -> None:
        """Drop the oldest unpinned entries once the cap is passed."""
        if len(self.entries) <= MAX_ENTRIES:
            return
        pinned = [e for e in self.entries if e.pinned]
        rest = [e for e in self.entries if not e.pinned]
        room = max(MAX_ENTRIES - len(pinned), 0)
        self.entries = sorted(pinned + rest[:room], key=lambda e: e.at, reverse=True)

    def by_tool(self, tool: str | None = None) -> list[Entry]:
        if not tool:
            return self.entries
        return [entry for entry in self.entries if entry.tool == tool]

    def at(self, position: int) -> Entry | None:
        """Entries are numbered from 1, as they are listed."""
        if 1 <= position <= len(self.entries):
            return self.entries[position - 1]
        return None

    def toggle_pin(self, position: int) -> Entry | None:
        self.entries = self._read()
        entry = self.at(position)
        if entry is None:
            return None
        new_entry = replace(entry, pinned=not entry.pinned)
        self.entries = [new_entry if e is entry else e for e in self.entries]
        entry = new_entry
        self.save()
        return entry

    def clear(self, *, keep_pinned: bool = False) -> None:
        self.entries = self._read()
        self.entries = [e for e in self.entries if e.pinned] if keep_pinned else []
        self.save()

    def counts(self) -> dict[str, int]:
        tally: dict[str, int] = {}
        for entry in self.entries:
            tally[entry.tool] = tally.get(entry.tool, 0) + 1
        return tally

    def to_text(self) -> str:
        lines = [
            "INVESTIGATION JOURNAL // ENIGMA TERMINAL",
            f"Exported: {time.strftime('%Y-%m-%d %H:%M:%S')}",
            f"Entries: {len(self.entries)}",
            "",
        ]
        for index, entry in enumerate(self.entries, 1):
            stamp = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(entry.at))
            pin = " [PINNED]" if entry.pinned else ""
            lines.append(
                f"{index:>3}. {stamp}  {TOOLS.get(entry.tool, entry.tool).upper()}{pin}"
            )
            lines.append(f"     {entry.title}")
            if entry.detail:
                lines.append(f"     {entry.detail}")
        return "\n".join(lines)

    def __len__(self) -> int:
        return len(self.entries)

    def __iter__(self) -> Iterator[Entry]:
        return iter(self.entries)
