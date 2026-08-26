"""Live Bitcoin network layer.

Real HTTP queries against public block explorers — no simulated balances.
Three providers are supported and tried in order, so a rate-limited or offline
node degrades into the next one instead of killing the session.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from typing import Any, Callable

try:  # `requests` is preferred when present; urllib keeps the game dependency-free
    import requests
except ImportError:  # pragma: no cover - exercised only where requests is absent
    requests = None

USER_AGENT = "enigma-terminal/1.0 (+https://github.com/legenki/neon-terminal)"
SATS_PER_BTC = 100_000_000


class ChainError(RuntimeError):
    """Raised when every configured provider fails to answer."""


#: Exception types either HTTP backend can raise for a transport-level failure.
NETWORK_ERRORS: tuple[type[BaseException], ...] = (
    urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError,
)
if requests is not None:  # pragma: no branch - trivial
    NETWORK_ERRORS += (requests.RequestException,)


@dataclass
class AddressStats:
    """Normalised view of one address, whichever explorer answered."""

    address: str
    confirmed_sats: int
    unconfirmed_sats: int
    total_received_sats: int
    total_sent_sats: int
    tx_count: int
    utxo_count: int
    provider: str

    @staticmethod
    def btc(sats: int) -> str:
        """Format satoshis the way the terminal prints them."""
        sign = "-" if sats < 0 else ""
        return f"{sign}{abs(sats) // SATS_PER_BTC}.{abs(sats) % SATS_PER_BTC:08d}"

    @property
    def confirmed_btc(self) -> str:
        return self.btc(self.confirmed_sats)

    @property
    def unconfirmed_btc(self) -> str:
        return self.btc(self.unconfirmed_sats)

    @property
    def total_received_btc(self) -> str:
        return self.btc(self.total_received_sats)

    @property
    def total_sent_btc(self) -> str:
        return self.btc(self.total_sent_sats)

    @property
    def is_touched(self) -> bool:
        """True when the address has ever appeared on-chain."""
        return self.tx_count > 0 or self.total_received_sats > 0


@dataclass
class Transaction:
    txid: str
    confirmed: bool
    block_height: int | None
    block_time: int | None
    value_delta_sats: int | None = None


@dataclass
class Provider:
    """One explorer endpoint plus the adapters that normalise its JSON."""

    name: str
    base: str
    address_path: Callable[[str], str]
    parse_address: Callable[[Any], AddressStats]
    txs_path: Callable[[str], str] | None = None
    parse_txs: Callable[[Any, str], list[Transaction]] | None = None
    explorer_url: Callable[[str], str] = field(
        default=lambda addr: f"https://mempool.space/address/{addr}"
    )


_HEADERS = {"User-Agent": USER_AGENT, "Accept": "application/json"}


def _get_json(url: str, timeout: float) -> Any:
    """GET and decode JSON, via requests when it is installed, urllib otherwise."""
    if requests is not None:
        response = requests.get(url, headers=_HEADERS, timeout=timeout)
        response.raise_for_status()
        return response.json()
    request = urllib.request.Request(url, headers=_HEADERS)
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


# --- Esplora-compatible (Blockstream / mempool.space) ----------------------- #

def _parse_esplora_address(name: str, data: Any) -> AddressStats:
    chain = data["chain_stats"]
    pool = data["mempool_stats"]
    confirmed = chain["funded_txo_sum"] - chain["spent_txo_sum"]
    return AddressStats(
        address=data["address"],
        confirmed_sats=confirmed,
        unconfirmed_sats=pool["funded_txo_sum"] - pool["spent_txo_sum"],
        total_received_sats=chain["funded_txo_sum"],
        total_sent_sats=chain["spent_txo_sum"],
        tx_count=chain["tx_count"] + pool["tx_count"],
        utxo_count=chain["funded_txo_count"] - chain["spent_txo_count"],
        provider=name,
    )


def _parse_esplora_txs(data: Any, address: str) -> list[Transaction]:
    out = []
    for tx in data:
        status = tx.get("status", {})
        received = sum(
            v["value"] for v in tx.get("vout", []) if v.get("scriptpubkey_address") == address
        )
        spent = sum(
            vin.get("prevout", {}).get("value", 0)
            for vin in tx.get("vin", [])
            if vin.get("prevout", {}).get("scriptpubkey_address") == address
        )
        delta = received - spent
        out.append(
            Transaction(
                txid=tx["txid"],
                confirmed=bool(status.get("confirmed")),
                block_height=status.get("block_height"),
                block_time=status.get("block_time"),
                value_delta_sats=delta,
            )
        )
    return out


def _parse_blockchain_info(name: str, data: Any) -> AddressStats:
    return AddressStats(
        address=data["address"],
        confirmed_sats=data["final_balance"],
        unconfirmed_sats=0,
        total_received_sats=data["total_received"],
        total_sent_sats=data["total_sent"],
        tx_count=data["n_tx"],
        utxo_count=data.get("n_unredeemed", 0),
        provider=name,
    )


PROVIDERS: dict[str, Provider] = {
    "blockstream": Provider(
        name="BLOCKSTREAM",
        base="https://blockstream.info/api",
        address_path=lambda a: f"/address/{a}",
        parse_address=lambda d: _parse_esplora_address("BLOCKSTREAM", d),
        txs_path=lambda a: f"/address/{a}/txs",
        parse_txs=_parse_esplora_txs,
        explorer_url=lambda a: f"https://blockstream.info/address/{a}",
    ),
    "mempool": Provider(
        name="MEMPOOL.SPACE",
        base="https://mempool.space/api",
        address_path=lambda a: f"/address/{a}",
        parse_address=lambda d: _parse_esplora_address("MEMPOOL.SPACE", d),
        txs_path=lambda a: f"/address/{a}/txs",
        parse_txs=_parse_esplora_txs,
        explorer_url=lambda a: f"https://mempool.space/address/{a}",
    ),
    "blockchain": Provider(
        name="BLOCKCHAIN.COM",
        base="https://blockchain.info",
        address_path=lambda a: f"/rawaddr/{a}?limit=0",
        parse_address=lambda d: _parse_blockchain_info("BLOCKCHAIN.COM", d),
        explorer_url=lambda a: f"https://www.blockchain.com/explorer/addresses/btc/{a}",
    ),
}

DEFAULT_ORDER = ("blockstream", "mempool", "blockchain")


class ChainClient:
    """Queries the live chain, falling back through providers on failure."""

    def __init__(self, preferred: str | None = None, timeout: float = 12.0,
                 offline: bool = False) -> None:
        self.timeout = timeout
        self.offline = offline
        self.preferred = preferred
        self.last_error: str | None = None

    @property
    def order(self) -> tuple[str, ...]:
        if self.preferred and self.preferred in PROVIDERS:
            rest = tuple(p for p in DEFAULT_ORDER if p != self.preferred)
            return (self.preferred,) + rest
        return DEFAULT_ORDER

    @property
    def node_name(self) -> str:
        return PROVIDERS[self.order[0]].name

    def explorer_url(self, address: str) -> str:
        return PROVIDERS[self.order[0]].explorer_url(address)

    def address_stats(self, address: str) -> AddressStats:
        if self.offline:
            raise ChainError("OFFLINE MODE ACTIVE — NETWORK CALLS DISABLED")
        errors: list[str] = []
        for key in self.order:
            provider = PROVIDERS[key]
            url = provider.base + provider.address_path(address)
            try:
                return provider.parse_address(_get_json(url, self.timeout))
            except urllib.error.HTTPError as exc:
                errors.append(f"{provider.name}: HTTP {exc.code}")
            except (KeyError, TypeError) as exc:
                errors.append(f"{provider.name}: malformed response ({exc})")
            except NETWORK_ERRORS as exc:
                code = getattr(getattr(exc, "response", None), "status_code", None)
                errors.append(
                    f"{provider.name}: HTTP {code}" if code
                    else f"{provider.name}: {exc.__class__.__name__}"
                )
            except ValueError as exc:
                errors.append(f"{provider.name}: malformed response ({exc})")
        self.last_error = " | ".join(errors)
        raise ChainError(self.last_error)

    def transactions(self, address: str, limit: int = 5) -> list[Transaction]:
        if self.offline:
            raise ChainError("OFFLINE MODE ACTIVE — NETWORK CALLS DISABLED")
        errors: list[str] = []
        for key in self.order:
            provider = PROVIDERS[key]
            if not provider.txs_path or not provider.parse_txs:
                continue
            url = provider.base + provider.txs_path(address)
            try:
                return provider.parse_txs(_get_json(url, self.timeout), address)[:limit]
            except (*NETWORK_ERRORS, KeyError, TypeError, ValueError) as exc:
                errors.append(f"{provider.name}: {exc.__class__.__name__}")
        self.last_error = " | ".join(errors) or "NO PROVIDER EXPOSES A TX ENDPOINT"
        raise ChainError(self.last_error)

    def netinfo(self) -> dict[str, str]:
        """Probe each provider and return a status dict for NETINFO display."""
        import time
        _PROBE = "1A1zP1eP5QGefi2DMPTfTL5SLmv7Divf"
        results: dict[str, str] = {}
        for key in DEFAULT_ORDER:
            provider = PROVIDERS[key]
            url = provider.base + provider.address_path(_PROBE)
            t0 = time.monotonic()
            try:
                _get_json(url, min(self.timeout, 5.0))
                ms = int((time.monotonic() - t0) * 1000)
                results[key] = f"OK {ms}ms"
            except NETWORK_ERRORS as exc:
                results[key] = f"DOWN ({exc.__class__.__name__})"
            except Exception as exc:
                results[key] = f"ERR ({exc.__class__.__name__})"
        return results
