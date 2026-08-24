"""The detective's case book.

One persistent record of every move made in any tool, with enough payload to
replay it. The web build keeps the same structure in localStorage; this one
lives next to the progress file.

One rule matters more than the rest: a seed phrase the player typed in and that
the game does not recognise is never written to disk. Only phrases the game
already knows (the eight case answers, all published test vectors) and phrases
this session generated are stored in full. Anything else is recorded masked, so
pasting a live wallet into the terminal cannot leave it sitting on disk.
"""

from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable

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
    def from_dict(cls, data: dict[str, Any]) -> "Entry":
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
        base = os.environ.get("NEON_TERMINAL_HOME")
        if base:
            return Path(base) / "journal.json"
        return Path.home() / ".neon_terminal" / "journal.json"

    def _read(self) -> list[Entry]:
        try:
            raw = json.loads(self.path.read_text(encoding="utf-8"))
        except (FileNotFoundError, ValueError, OSError):
            return []
        if not isinstance(raw, list):
            return []
        return [Entry.from_dict(item) for item in raw if isinstance(item, dict)]

    def save(self) -> None:
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            self.path.write_text(
                json.dumps([entry.to_dict() for entry in self.entries], indent=2,
                           ensure_ascii=False),
                encoding="utf-8",
            )
        except OSError:
            pass  # a read-only home must not break the game

    def refresh(self) -> list[Entry]:
        self.entries = self._read()
        return self.entries

    def push(self, tool: str, title: str, *, detail: str = "", status: str = "info",
             payload: dict[str, Any] | None = None) -> Entry:
        # Append onto what is on disk: a second terminal sharing this home
        # must not have its entries erased by this one.
        self.entries = self._read()
        entry = Entry(
            id=(self.entries[0].id if self.entries else 0) + 1,
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
        entry = self.at(position)
        if entry is None:
            return None
        entry.pinned = not entry.pinned
        self.save()
        return entry

    def clear(self, *, keep_pinned: bool = False) -> None:
        self.entries = [e for e in self.entries if e.pinned] if keep_pinned else []
        self.save()

    def counts(self) -> dict[str, int]:
        tally: dict[str, int] = {}
        for entry in self.entries:
            tally[entry.tool] = tally.get(entry.tool, 0) + 1
        return tally

    def to_text(self) -> str:
        lines = [
            "INVESTIGATION JOURNAL // BIP-39: NEON TERMINAL",
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

    def __iter__(self) -> Iterable[Entry]:
        return iter(self.entries)
