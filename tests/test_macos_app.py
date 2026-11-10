"""Tests for the native macOS SwiftUI application bundle and build artifacts."""

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

    # Verify native SwiftUI and JavaScriptCore linkage with zero WebKit dependency
    libs = subprocess.run(
        ["otool", "-L", str(binary)],
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    assert "SwiftUI.framework" in libs, "Binary does not link native SwiftUI"
    assert "JavaScriptCore.framework" in libs, "Binary does not link JavaScriptCore"
    assert "WebKit.framework" not in libs, "Binary unexpectedly links WebKit; must be pure native SwiftUI"


def test_macos_app_bundled_resources(built_app):
    resources_dir = built_app / "Contents" / "Resources"
    engine_js = resources_dir / "enigma_engine.js"
    assert engine_js.exists(), "enigma_engine.js missing from app bundle Resources"
    assert engine_js.stat().st_size > 10000, "enigma_engine.js is unexpectedly truncated"

    # AppIcon.icns check
    icon = resources_dir / "AppIcon.icns"
    assert icon.exists(), "Contents/Resources/AppIcon.icns is missing"
    assert icon.stat().st_size > 1024, "AppIcon.icns is too small"


def test_macos_app_entitlements():
    entitlements_path = MACOS_DIR / "Resources" / "Entitlements.plist"
    assert entitlements_path.exists(), "Entitlements.plist is missing"

    with entitlements_path.open("rb") as f:
        plist = plistlib.load(f)

    assert plist.get("com.apple.security.network.client") is True
