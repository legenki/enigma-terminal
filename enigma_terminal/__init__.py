"""ENIGMA TERMINAL — a cyberpunk detective quest over the real Bitcoin network."""

import importlib.metadata

try:
    __version__ = importlib.metadata.version("enigma-terminal")
except importlib.metadata.PackageNotFoundError:
    __version__ = "2.0.0"
__all__ = ["__version__"]
