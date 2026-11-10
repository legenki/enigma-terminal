"""Tests for the native macOS application bundle and build artifacts."""

from __future__ import annotations

import os
import plistlib
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
BUILD_SCRIPT = ROOT / "tools" / "build_macos_app.sh"
APP_DIR = ROOT / "dist" / "Enigma Terminal.app"
MACOS_DIR = ROOT / "macos" / "EnigmaTerminal"


@pytest.fixture(scope="module")
def built_app():
    """Ensure the macOS .app bundle is built before testing."""
    if not (APP_DIR / "Contents" / "MacOS" / "EnigmaTerminal").exists():
        subprocess.run([str(BUILD_SCRIPT)], cwd=ROOT, check=True)
    return APP_DIR


def test_macos_app_build_script_exists_and_is_executable():
    assert BUILD_SCRIPT.exists(), "tools/build_macos_app.sh does not exist"
    assert os.access(BUILD_SCRIPT, os.X_OK), "tools/build_macos_app.sh must be executable"


def test_macos_app_bundle_structure_and_plist(built_app):
    info_plist_path = built_app / "Contents" / "Info.plist"
    assert info_plist_path.exists(), "Contents/Info.plist is missing"

    with info_plist_path.open("rb") as f:
        plist = plistlib.load(f)

    assert plist.get("CFBundleIdentifier") == "com.enigmaterminal.app"
    assert plist.get("CFBundleName") == "Enigma Terminal"
    assert plist.get("CFBundlePackageType") == "APPL"
    assert plist.get("CFBundleExecutable") == "EnigmaTerminal"
    assert plist.get("LSMinimumSystemVersion") == "26.0"
    assert plist.get("NSHighResolutionCapable") is True


def test_macos_app_binary_target_and_architecture(built_app):
    binary = built_app / "Contents" / "MacOS" / "EnigmaTerminal"
    assert binary.exists(), "Executable binary missing"
    assert os.access(binary, os.X_OK), "Binary must be executable"

    done = subprocess.run(
        ["otool", "-l", str(binary)],
        capture_output=True,
        text=True,
        check=True,
    )
    assert "minos 26.0" in done.stdout, f"Binary was not built with minos 26.0:\n{done.stdout}"
    assert "platform 1" in done.stdout, f"Binary platform is not macOS:\n{done.stdout}"


def test_macos_app_bundled_resources(built_app):
    web_dir = built_app / "Contents" / "Resources" / "web"
    assert (web_dir / "index.html").exists(), "web/index.html missing from app bundle"
    assert (web_dir / "js" / "main.js").exists(), "web/js/main.js missing from app bundle"
    assert (web_dir / "css" / "gui.css").exists(), "web/css/gui.css missing from app bundle"

    # Must be identical to docs/index.html
    docs_index = (ROOT / "docs" / "index.html").read_bytes()
    bundled_index = (web_dir / "index.html").read_bytes()
    assert bundled_index == docs_index, "Bundled index.html drifted from docs/index.html"

    # AppIcon.icns check
    icon = built_app / "Contents" / "Resources" / "AppIcon.icns"
    assert icon.exists(), "Contents/Resources/AppIcon.icns is missing"
    assert icon.stat().st_size > 1024, "AppIcon.icns is too small"


def test_macos_app_entitlements():
    entitlements_path = MACOS_DIR / "Resources" / "Entitlements.plist"
    assert entitlements_path.exists(), "Entitlements.plist is missing"

    with entitlements_path.open("rb") as f:
        plist = plistlib.load(f)

    assert plist.get("com.apple.security.network.client") is True
