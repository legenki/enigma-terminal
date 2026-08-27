"""One place that knows how this build writes its save files.

Both files the game keeps — the journal and the progress — used ``write_text``,
which truncates the target and then writes into it. Two things follow from that.
A crash, a full disk or a kill between the two steps leaves a file that is
empty or half a document, and the game reads its own saves back on the next
launch. And a second terminal sharing ``ENIGMA_TERMINAL_HOME`` can read in the
gap and see that partial state as the truth.

Writing a temporary file alongside the target and renaming it over the top
closes both: ``os.replace`` is atomic, so a reader sees either the whole old
file or the whole new one. This is the disk-side counterpart of
``docs/js/storage.js``, which is the one place the web build talks to
localStorage.
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path


def atomic_write_text(path: Path, body: str) -> bool:
    """Replace ``path`` with ``body`` in one step. False if the home is read-only.

    Never raises: a read-only home costs the player persistence, not the game.
    """
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        # The temporary file has to sit in the target's own directory:
        # os.replace is only atomic within a single filesystem, and the
        # system temp directory is often on another one.
        handle, temporary = tempfile.mkstemp(
            dir=path.parent, prefix=f".{path.name}.", suffix=".tmp"
        )
        try:
            with os.fdopen(handle, "w", encoding="utf-8") as stream:
                stream.write(body)
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(temporary, path)
        except OSError:
            # Leave nothing behind if the rename never happened.
            try:
                os.unlink(temporary)
            except OSError:
                pass
            raise
        return True
    except OSError:
        return False
