#!/usr/bin/env python3
"""Generate the web build's data modules from the shared sources in ``data/``.

``data/english.txt`` and ``data/cases.json`` are the single source of truth for
both the Python terminal and the browser build; this script mirrors them into
ES modules under ``docs/js/`` so GitHub Pages can serve the game as static files.

Run after editing either source:  python3 tools/build_web_data.py
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
OUT = ROOT / "docs" / "js"

HEADER = "// GENERATED FILE — edit {source} and run tools/build_web_data.py instead.\n"


def build_wordlist() -> int:
    words = [w for w in (DATA / "english.txt").read_text(encoding="utf-8").split() if w]
    if len(words) != 2048:
        raise SystemExit(f"expected 2048 words, found {len(words)}")
    digest = hashlib.sha256((DATA / "english.txt").read_bytes()).hexdigest()
    rows = [
        "  " + " ".join(f"'{w}'," for w in words[i : i + 8]).rstrip(",")
        for i in range(0, len(words), 8)
    ]
    body = (
        HEADER.format(source="data/english.txt")
        + f"\nexport const WORDLIST_SHA256 = '{digest}';\n\n"
        + "export const WORDLIST = [\n"
        + ",\n".join(rows)
        + ",\n];\n"
    )
    (OUT / "wordlist.js").write_text(body, encoding="utf-8")
    return len(words)


def build_clients() -> int:
    payload = json.loads((DATA / "clients.json").read_text(encoding="utf-8"))
    body = (
        HEADER.format(source="data/clients.json")
        + "\nexport const CLIENTS = "
        + json.dumps(payload["clients"], ensure_ascii=False, indent=2)
        + ";\n"
    )
    (OUT / "clients.js").write_text(body, encoding="utf-8")
    return len(payload["clients"])


def build_contracts() -> tuple[int, int]:
    """Ship the 256-case board as fetched JSON, minus the solver specification.

    It is loaded on demand rather than bundled: the eight-case campaign has to
    be playable the instant the page opens, and the board is an order of
    magnitude larger than everything else combined.
    """
    payload = json.loads((DATA / "contracts.json").read_text(encoding="utf-8"))
    cases = []
    for case in payload["cases"]:
        lean = {key: value for key, value in case.items() if key != "solution"}
        cases.append(lean)
    target = ROOT / "docs" / "data"
    target.mkdir(parents=True, exist_ok=True)
    destination = target / "contracts.json"
    destination.write_text(
        json.dumps({"cases": cases}, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    return len(cases), destination.stat().st_size


def build_cases() -> int:
    payload = json.loads((DATA / "cases.json").read_text(encoding="utf-8"))
    body = (
        HEADER.format(source="data/cases.json")
        + "\nexport const CAMPAIGN = "
        + json.dumps(payload, ensure_ascii=False, indent=2)
        + ";\n\nexport const CASES = CAMPAIGN.cases;\n"
    )
    (OUT / "campaign.js").write_text(body, encoding="utf-8")
    return len(payload["cases"])


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    words = build_wordlist()
    cases = build_cases()
    clients = build_clients()
    contracts, size = build_contracts()
    print(f"docs/js/wordlist.js       : {words} words")
    print(f"docs/js/campaign.js       : {cases} campaign cases")
    print(f"docs/js/clients.js        : {clients} clients")
    print(f"docs/data/contracts.json  : {contracts} contracts ({size / 1024:.0f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
