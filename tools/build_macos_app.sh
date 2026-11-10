#!/usr/bin/env bash
set -euo pipefail

# Build script for Enigma Terminal Native SwiftUI macOS App
# Target: macOS 26.0 and above

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

APP_NAME="Enigma Terminal"
BUNDLE_NAME="${APP_NAME}.app"
DIST_DIR="${ROOT_DIR}/dist"
APP_DIR="${DIST_DIR}/${BUNDLE_NAME}"
MACOS_DIR="${ROOT_DIR}/macos/EnigmaTerminal"
MIN_MACOS_VERSION="26.0"
TARGET_TRIPLE="arm64-apple-macos${MIN_MACOS_VERSION}"

echo "==> Building native SwiftUI ${APP_NAME} for macOS ${MIN_MACOS_VERSION}+ (${TARGET_TRIPLE})"

# 1. Clean previous build artifact
rm -rf "${APP_DIR}"
mkdir -p "${APP_DIR}/Contents/MacOS"
mkdir -p "${APP_DIR}/Contents/Resources"

# 2. Ensure AppIcon exists
if [ ! -f "${MACOS_DIR}/Resources/AppIcon.icns" ]; then
    echo "==> Generating AppIcon.icns..."
    swift "${ROOT_DIR}/tools/generate_icon.swift"
    iconutil -c icns /tmp/AppIcon.iconset -o "${MACOS_DIR}/Resources/AppIcon.icns"
    rm -rf /tmp/AppIcon.iconset
fi
cp "${MACOS_DIR}/Resources/AppIcon.icns" "${APP_DIR}/Contents/Resources/AppIcon.icns"

# 3. Copy Info.plist
cp "${MACOS_DIR}/Resources/Info.plist" "${APP_DIR}/Contents/Info.plist"

# 4. Ensure bundled enigma_engine.js exists
echo "==> Bundling JavaScriptCore crypto engine..."
node "${ROOT_DIR}/tools/build_engine_bundle.mjs"
cp "${MACOS_DIR}/Resources/enigma_engine.js" "${APP_DIR}/Contents/Resources/enigma_engine.js"

# 4b. Copy real game data (cases, contracts, clients)
echo "==> Bundling game datasets (cases, contracts, clients)..."
mkdir -p "${APP_DIR}/Contents/Resources/data"
cp "${ROOT_DIR}/data/cases.json" "${APP_DIR}/Contents/Resources/data/cases.json"
cp "${ROOT_DIR}/data/contracts.json" "${APP_DIR}/Contents/Resources/data/contracts.json"
cp "${ROOT_DIR}/data/clients.json" "${APP_DIR}/Contents/Resources/data/clients.json"
# 5. Compile Native SwiftUI sources
echo "==> Compiling Native SwiftUI sources targeting ${TARGET_TRIPLE}..."
swiftc \
    -target "${TARGET_TRIPLE}" \
    -O \
    -parse-as-library \
    "${MACOS_DIR}/Sources/Core/"*.swift \
    "${MACOS_DIR}/Sources/App/"*.swift \
    "${MACOS_DIR}/Sources/Views/"*.swift \
    -o "${APP_DIR}/Contents/MacOS/EnigmaTerminal"

chmod +x "${APP_DIR}/Contents/MacOS/EnigmaTerminal"

# 6. Ad-hoc codesign bundle
echo "==> Signing bundle with ad-hoc identity..."
codesign --force --deep --sign - \
    --entitlements "${MACOS_DIR}/Resources/Entitlements.plist" \
    "${APP_DIR}"

codesign --verify --deep "${APP_DIR}"

echo "==> Build successful: ${APP_DIR}"
echo "==> Size: $(du -sh "${APP_DIR}" | cut -f1)"
