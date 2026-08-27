"""Live Bitcoin network layer.

Real HTTP queries against public block explorers — no simulated balances.
Three providers are supported and tried in order, so a rate-limited or offline
node degrades into the next one instead of killing the session.
"""

from __future__ import annotations

import concurrent.futures
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

try:  # `requests` is preferred when present; urllib keeps the game dependency-free
    import requests
except ImportError:  # pragma: no cover - exercised only where requests is absent
    requests = None  # type: ignore

USER_AGENT = "enigma-terminal/1.0 (+https://github.com/legenki/enigma-terminal)"
SATS_PER_BTC = 100_000_000


class ChainError(RuntimeError):
    """Raised when every configured provider fails to answer."""


#: Exception types either HTTP backend can raise for a transport-level failure.
NETWORK_ERRORS: tuple[type[BaseException], ...] = (
    urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError,
)
if requests is not None:  # pragma: no branch - trivial
    NETWORK_ERRORS += (requests.RequestException,)

#: A provider answering with something we cannot read. Kept apart from
#: NETWORK_ERRORS so the message can say which of the two happened, and kept
#: narrow: a KeyError raised inside our own adapter is a bug in this file, not
#: a provider being unreachable, and rolling the two together meant every such
#: bug was reported to the player as "the network is down" and silently
#: retried against the next explorer.
_MALFORMED_ERRORS: tuple[type[BaseException], ...] = (KeyError, TypeError, ValueError)


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


def _path_safe(address: str) -> str:
    """Percent-encode an address before it becomes part of a URL path.

    SYNC_LEDGER, TXLOG and EXPLORER all take an address straight from what the
    player typed, and it was interpolated into the path as-is — so a slash or a
    question mark in it addressed a different endpoint than the one intended.
    A real base58 or bech32 address is unreserved throughout, so this changes
    nothing for valid input.
    """
    return urllib.parse.quote(address, safe="")


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
        default=lambda addr: f"https://mempool.space/address/{_path_safe(addr)}"
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
        address_path=lambda a: f"/address/{_path_safe(a)}",
        parse_address=lambda d: _parse_esplora_address("BLOCKSTREAM", d),
        txs_path=lambda a: f"/address/{_path_safe(a)}/txs",
        parse_txs=_parse_esplora_txs,
        explorer_url=lambda a: f"https://blockstream.info/address/{_path_safe(a)}",
    ),
    "mempool": Provider(
        name="MEMPOOL.SPACE",
        base="https://mempool.space/api",
        address_path=lambda a: f"/address/{_path_safe(a)}",
        parse_address=lambda d: _parse_esplora_address("MEMPOOL.SPACE", d),
        txs_path=lambda a: f"/address/{_path_safe(a)}/txs",
        parse_txs=_parse_esplora_txs,
        explorer_url=lambda a: f"https://mempool.space/address/{_path_safe(a)}",
    ),
    "blockchain": Provider(
        name="BLOCKCHAIN.COM",
        base="https://blockchain.info",
        address_path=lambda a: f"/rawaddr/{_path_safe(a)}?limit=0",
        parse_address=lambda d: _parse_blockchain_info("BLOCKCHAIN.COM", d),
        explorer_url=lambda a: f"https://www.blockchain.com/explorer/addresses/btc/{_path_safe(a)}",
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
            # Fetching and parsing are caught separately, as in transactions():
            # it keeps "the explorer did not answer" apart from "the explorer
            # answered with something we cannot read", and keeps a bug in an
            # adapter from being reported to the player as a dead network.
            try:
                payload = _get_json(url, self.timeout)
            except urllib.error.HTTPError as exc:
                if exc.code == 429:
                    errors.append(f"{provider.name}: HTTP 429 TOO MANY REQUESTS")
                else:
                    errors.append(f"{provider.name}: HTTP {exc.code}")
                continue
            except NETWORK_ERRORS as exc:
                code = getattr(getattr(exc, "response", None), "status_code", None)
                if code == 429:
                    errors.append(f"{provider.name}: HTTP 429 TOO MANY REQUESTS")
                else:
                    errors.append(
                        f"{provider.name}: HTTP {code}" if code
                        else f"{provider.name}: {exc.__class__.__name__}"
                    )
                continue
            except ValueError as exc:  # a 200 whose body is not JSON
                errors.append(f"{provider.name}: malformed response ({exc})")
                continue
            try:
                return provider.parse_address(payload)
            except _MALFORMED_ERRORS as exc:
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
                payload = _get_json(url, self.timeout)
            except NETWORK_ERRORS as exc:
                code = getattr(
                    getattr(exc, "response", None), "status_code", getattr(exc, "code", None)
                )
                if code == 429:
                    errors.append(f"{provider.name}: HTTP 429 TOO MANY REQUESTS")
                else:
                    errors.append(f"{provider.name}: {exc.__class__.__name__}")
                continue
            # Parsing is separated from fetching so the two failures stay
            # distinguishable: this branch is the provider sending a shape we
            # do not recognise, and anything else raised in the adapter is a
            # bug here and is allowed to reach the caller as itself.
            try:
                return provider.parse_txs(payload, address)[:limit]
            except _MALFORMED_ERRORS as exc:
                errors.append(f"{provider.name}: malformed response ({exc})")
        self.last_error = " | ".join(errors) or "NO PROVIDER EXPOSES A TX ENDPOINT"
        raise ChainError(self.last_error)

    #: The genesis coinbase address, in full. A two-character truncation of it
    #: went unnoticed here for a while, and every explorer answers an invalid
    #: address with HTTP 400 — so NETINFO reported all three nodes down
    #: whatever their real state was.
    PROBE_ADDRESS = "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"

    # ----------------------------------------------------------------- #
    # Figures the openings are written around.
    #
    # All of these come from mempool.space, which is the only one of the three
    # providers that serves blocks, pools and a price. They are decoration, not
    # gameplay: each is wrapped by the caller so that a failure costs one line
    # of an opening and never a session.
    # ----------------------------------------------------------------- #

    _MEMPOOL_API = "https://mempool.space/api"

    def _mempool_get(self, path: str) -> Any:
        return _get_json(f"{self._MEMPOOL_API}/{path}", min(self.timeout, 6.0))

    def price_usd(self) -> int | None:
        """One bitcoin in US dollars."""
        if self.offline:
            return None
        return self._mempool_get("v1/prices").get("USD")

    def chain_tip(self) -> dict[str, Any]:
        """The last block, with the pool that mined it under ``extras``."""
        if self.offline:
            return {}
        blocks = self._mempool_get("v1/blocks")
        return blocks[0] if blocks else {}

    def best_fee(self) -> int | None:
        """The fastest recommended fee, in satoshi per vByte."""
        if self.offline:
            return None
        return self._mempool_get("v1/fees/recommended").get("fastestFee")

    def mempool_count(self) -> int | None:
        """How many transactions are waiting."""
        if self.offline:
            return None
        return self._mempool_get("mempool").get("count")

    def top_pool(self) -> tuple[str | None, float, str | None]:
        """The largest pool of the last day, its share, and the total hashrate."""
        if self.offline:
            return None, 0.0, None
        payload = self._mempool_get("v1/mining/pools/24h")
        pools = payload.get("pools") or []
        total = sum(p.get("blockCount", 0) for p in pools) or 1
        leader = max(pools, key=lambda p: p.get("blockCount", 0), default=None)
        hashrate = payload.get("lastEstimatedHashrate")
        pretty = f"{hashrate / 1e18:.1f} EH/s" if hashrate else None
        if leader is None:
            return None, 0.0, pretty
        share = leader.get("blockCount", 0) * 100 / total
        return leader.get("name"), share, pretty

    def days_to_halving(self) -> int | None:
        """Whole days until the subsidy halves, at ten minutes a block."""
        if self.offline:
            return None
        height = self.chain_tip().get("height")
        if not height:
            return None
        remaining = 210_000 - (int(height) % 210_000)
        return remaining * 10 // (60 * 24)

    def netinfo(self) -> dict[str, str]:
        """Probe every provider at once and return a status dict for NETINFO.

        Probed in parallel, as the web build has always done. Serially, three
        nodes that are all timing out held the terminal for the sum of their
        timeouts — up to fifteen seconds of a frozen prompt to be told the
        network is down. In parallel it is the slowest one, not the total.
        """
        if self.offline:
            return {key: "OFFLINE" for key in DEFAULT_ORDER}

        timeout = min(self.timeout, 5.0)

        def probe(key: str) -> tuple[str, str]:
            provider = PROVIDERS[key]
            url = provider.base + provider.address_path(self.PROBE_ADDRESS)
            started = time.monotonic()
            try:
                _get_json(url, timeout)
                return key, f"OK {int((time.monotonic() - started) * 1000)}ms"
            except NETWORK_ERRORS as exc:
                return key, f"DOWN ({exc.__class__.__name__})"
            except Exception as exc:
                return key, f"ERR ({exc.__class__.__name__})"

        with concurrent.futures.ThreadPoolExecutor(
            max_workers=len(DEFAULT_ORDER)
        ) as pool:
            probed = dict(pool.map(probe, DEFAULT_ORDER))
        # Keyed in the order NETINFO prints them, not the order they answered.
        return {key: probed[key] for key in DEFAULT_ORDER}
