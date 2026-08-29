"""ENIGMA TERMINAL — a cyberpunk detective quest over the real Bitcoin network."""

import importlib.metadata

try:
    __version__ = importlib.metadata.version("enigma-terminal")
except importlib.metadata.PackageNotFoundError:
    __version__ = "3.0.1"
__all__ = ["__version__"]
