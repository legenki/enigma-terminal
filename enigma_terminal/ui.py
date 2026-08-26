"""Terminal presentation layer: ANSI colour, typewriter output, network theatre."""

from __future__ import annotations

import itertools
import os
import random
import shutil
import sys
import threading
import time
from collections.abc import Callable, Iterable, Sequence
from typing import TypeVar

T = TypeVar("T")

_ANSI = {
    "reset": "\033[0m",
    "bold": "\033[1m",
    "dim": "\033[2m",
    "green": "\033[38;5;46m",
    "dark": "\033[38;5;28m",
    "cyan": "\033[38;5;51m",
    "magenta": "\033[38;5;201m",
    "amber": "\033[38;5;214m",
    "red": "\033[38;5;196m",
    "grey": "\033[38;5;244m",
    "white": "\033[38;5;255m",
}

BANNER = r"""
 ██████╗ ██╗██████╗       ██████╗  █████╗
 ██╔══██╗██║██╔══██╗      ╚════██╗██╔══██╗
 ██████╔╝██║██████╔╝█████╗ █████╔╝╚██████║
 ██╔══██╗██║██╔═══╝ ╚════╝ ╚═══██╗ ╚═══██║
 ██████╔╝██║██║           ██████╔╝ █████╔╝
 ╚═════╝ ╚═╝╚═╝           ╚═════╝  ╚════╝
        N E O N   T E R M I N A L
"""

BOOT_LINES = [
    "[BOOT] enigma-terminal v{version}",
    "[BOOT] loading BIP-39 english wordlist ... 2048 entries OK",
    "[BOOT] verifying wordlist checksum ... {checksum}",
    "[BOOT] secp256k1 curve parameters ... LOADED",
    "[BOOT] hd derivation engine (BIP-32/44/49/84) ... ARMED",
    "[BOOT] chain provider: {provider}",
    "[BOOT] operator: {operator} // client: {client}",
]

DECRYPT_LOGS = [
    "[~] decrypting master pre-image...",
    "[~] pbkdf2-hmac-sha512, 2048 rounds...",
    "[~] deriving public key coordinates (X, Y)...",
    "[~] sha256 -> ripemd160 hashing...",
    "[~] encoding base58check payload...",
    "[~] computing bech32 witness program...",
]

NET_LOGS = [
    "[~] establishing encrypted proxy...",
    "[~] resolving explorer endpoint...",
    "[~] broadcasting address mapping to p2p network...",
    "[~] fetching unspent transaction outputs (utxo)...",
    "[~] parsing data streams...",
    "[~] reconciling mempool deltas...",
]

_SPINNER = "|/-\\"


class Screen:
    """Everything the game prints goes through here."""

    def __init__(self, colour: bool | None = None, speed: float = 1.0) -> None:
        if colour is None:
            colour = sys.stdout.isatty() and os.environ.get("TERM") != "dumb" \
                and not os.environ.get("NO_COLOR")
        self.colour = colour
        self.speed = max(speed, 0.0)

    # -- primitives -------------------------------------------------------- #

    @property
    def width(self) -> int:
        return max(shutil.get_terminal_size((80, 24)).columns, 40)

    def paint(self, text: str, *styles: str) -> str:
        if not self.colour or not styles:
            return text
        prefix = "".join(_ANSI.get(s, "") for s in styles)
        return f"{prefix}{text}{_ANSI['reset']}"

    def write(self, text: str = "", *styles: str) -> None:
        print(self.paint(text, *styles))

    def stream(self, text: str = "", *styles: str, cps: int = 900) -> None:
        """Typewriter output; falls back to instant printing when speed is 0."""
        if not self.speed or not sys.stdout.isatty():
            self.write(text, *styles)
            return
        delay = 1.0 / (cps * self.speed)
        painted_prefix = "".join(_ANSI.get(s, "") for s in styles) if self.colour else ""
        sys.stdout.write(painted_prefix)
        for char in text:
            sys.stdout.write(char)
            sys.stdout.flush()
            if char != " ":
                time.sleep(delay)
        if painted_prefix:
            sys.stdout.write(_ANSI["reset"])
        sys.stdout.write("\n")
        sys.stdout.flush()

    def lines(self, rows: Iterable[str], *styles: str, typed: bool = False) -> None:
        for row in rows:
            (self.stream if typed else self.write)(row, *styles)

    def rule(self, char: str = "-", *styles: str) -> None:
        self.write(char * min(self.width, 66), *(styles or ("dark",)))

    def kv(self, key: str, value: str, key_styles=("grey",), value_styles=("green",),
           width: int = 18) -> None:
        print(self.paint(f"{key:<{width}}: ", *key_styles)
              + self.paint(value, *value_styles))

    def error(self, message: str) -> None:
        self.write(f"[FATAL] {message}", "red", "bold")

    def warn(self, message: str) -> None:
        self.write(f"[WARN] {message}", "amber")

    def ok(self, message: str) -> None:
        self.write(f"[ OK ] {message}", "green")

    def info(self, message: str) -> None:
        self.write(f"[INFO] {message}", "cyan")

    def banner(self) -> None:
        self.write(BANNER, "green", "bold")

    # -- theatre ----------------------------------------------------------- #

    def pseudo_logs(self, logs: Sequence[str], per_line: float = 0.12) -> None:
        """Print pseudo-logs at a steady pace (used when there is no request to wait on)."""
        for line in logs:
            self.write(line, "dark")
            if self.speed and sys.stdout.isatty():
                time.sleep(per_line / self.speed)

    def run_with_logs(self, work: Callable[[], T], logs: Sequence[str],
                      min_seconds: float = 0.0) -> tuple[T | None, BaseException | None]:
        """Run ``work`` on a worker thread while pseudo-logs scroll on screen.

        The animation lasts exactly as long as the real call: this is the
        loading sequence from the spec wrapped around an actual HTTP request.
        Returns ``(result, exception)`` — the caller decides how to report.
        """
        box: dict[str, object] = {}

        def runner() -> None:
            try:
                box["value"] = work()
            except BaseException as exc:
                box["error"] = exc

        thread = threading.Thread(target=runner, daemon=True)
        started = time.monotonic()
        thread.start()

        if not self.speed or not sys.stdout.isatty():
            thread.join()
        else:
            queue = list(logs)
            spinner = itertools.cycle(_SPINNER)
            while thread.is_alive() or queue:
                line = queue.pop(0) if queue else None
                if line is None and not thread.is_alive():
                    break
                if line is not None:
                    sys.stdout.write(self.paint(line, "dark"))
                    sys.stdout.flush()
                deadline = time.monotonic() + random.uniform(0.10, 0.22) / self.speed
                while time.monotonic() < deadline or (not queue and thread.is_alive()):
                    sys.stdout.write(self.paint(f" {next(spinner)}", "green") + "\b\b")
                    sys.stdout.flush()
                    time.sleep(0.06)
                    if not thread.is_alive() and time.monotonic() >= deadline:
                        break
                if line is not None:
                    sys.stdout.write("  \n")
                    sys.stdout.flush()
            thread.join()
            remaining = min_seconds - (time.monotonic() - started)
            if remaining > 0:
                time.sleep(remaining / max(self.speed, 0.1))
        return box.get("value"), box.get("error")  # type: ignore[return-value]

    def boot(self, **fields: str) -> None:
        self.banner()
        for line in BOOT_LINES:
            self.write(line.format(**fields), "dark")
            if self.speed and sys.stdout.isatty():
                time.sleep(0.09 / self.speed)
        self.write()
