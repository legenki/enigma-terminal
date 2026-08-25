"""BIP-39: NEON TERMINAL — a cyberpunk detective quest over the real Bitcoin network."""

import importlib.metadata
try:
    __version__ = importlib.metadata.version("neon-terminal")
except importlib.metadata.PackageNotFoundError:
    __version__ = "1.0.0"
__all__ = ["__version__"]
