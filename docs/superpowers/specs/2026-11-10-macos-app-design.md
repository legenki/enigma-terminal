# Design Specification: Native macOS Application for Enigma Terminal

**Date:** 2026-11-10  
**Target Platform:** macOS 26.0 and above (`LSMinimumSystemVersion` 26.0, Apple Silicon / Universal binary)  
**Deliverable:** `Enigma Terminal.app` bundled macOS desktop application and automated build tooling.

---

## 1. Context and Problem Statement

Enigma Terminal is an interactive detective quest set against the real Bitcoin blockchain. It includes a 12-panel interface, canvas terminal, BIP-39 / BIP-32 / secp256k1 derivation engine, 256 generated client contracts, daylight-responsive palette, and live network integration with public block explorers.

The repository previously deprecated a Python terminal client because maintaining two separate game engines cost more than it was worth and lost parity with browser canvas and network behavior. To provide a first-class native macOS desktop experience on macOS 26+ without duplicating business logic, we build a native Swift/AppKit application container hosting the bundled application assets via an embedded, sandboxed WebKit container (`WKWebView`).

---

## 2. Requirements & Constraints

1. **Platform Floor:** macOS 26.0 (`macOS 26.0+`).
2. **Native Application Bundle:**
   - Produces standard macOS bundle: `Enigma Terminal.app`.
   - Contains `Contents/MacOS/EnigmaTerminal` executable, `Contents/Resources` (bundled assets + app icon), and `Contents/Info.plist`.
   - `LSMinimumSystemVersion` set to `26.0`.
   - `CFBundleIdentifier`: `com.enigmaterminal.app`.
   - High DPI / Retina capable (`NSHighResolutionCapable = YES`).
3. **Asset Serving via Custom URL Scheme (`enigma://`):**
   - Implements `WKURLSchemeHandler` (`EnigmaSchemeHandler`) to intercept `enigma://app/*` requests.
   - Maps requests directly to bundled resources in `Contents/Resources/web/`.
   - Serves HTML, JS (with correct `application/javascript` MIME type for ES modules), CSS, JSON, fonts, and worker scripts without starting an unneeded local HTTP daemon.
   - Preserves `localStorage` persistence between launches.
4. **macOS Integration:**
   - Native macOS Window (`NSWindow`): minimum dimensions (960×640), remembered position/size, full-size content view with transparent titlebar for modern macOS aesthetic.
   - Native Main Menu (`NSMenu`):
     - Standard Application menu (About Enigma Terminal, Hide, Quit `Cmd+Q`).
     - Edit menu (Cut, Copy, Paste, Select All).
     - View menu (Reload `Cmd+R`, Toggle Full Screen `Cmd+Ctrl+F`, Zoom In/Out).
     - Daylight menu (Live, Day, Night presets).
     - Window & Help menus.
5. **Network Connectivity:**
   - Retains access to external public explorers (`mempool.space`, `blockstream.info`, `blockchain.info`) configured in App Transport Security.
6. **Build & Test Automation:**
   - Standalone build script `tools/build_macos_app.sh` that compiles with `swiftc` or `xcodebuild`, creates the app bundle, syncs assets from `docs/`, and builds an icon.
   - Test suite verification (`tests/test_macos_app.py`) validating bundle structure, `Info.plist`, compilation, and asset inclusion.

---

## 3. Architecture & File Structure

```
macos/
└── EnigmaTerminal/
    ├── Sources/
    │   ├── main.swift                 # Application entry point
    │   ├── AppDelegate.swift          # NSApplicationDelegate, window & menu setup
    │   ├── MainWindowController.swift # NSWindowController and styling
    │   ├── EnigmaSchemeHandler.swift  # WKURLSchemeHandler for enigma://app/
    │   └── MenuBuilder.swift          # Native macOS menu construction
    └── Resources/
        ├── Info.plist                 # Bundle metadata, LSMinimumSystemVersion 26.0
        ├── AppIcon.icns               # macOS icon
        └── Entitlements.plist         # Hardened runtime / network client entitlement
tools/
└── build_macos_app.sh                 # Compiles Swift, packages .app bundle
tests/
└── test_macos_app.py                  # Automated verification of macOS app bundle
```

---

## 4. Components Detail

### 4.1 EnigmaSchemeHandler (`WKURLSchemeHandler`)
- Registers scheme `enigma`.
- Intercepts URLs of format `enigma://app/<path>`.
- Resolves `<path>` relative to `Bundle.main.resourceURL/web/`. Defaults `/` to `index.html`.
- Determines MIME type via file extension (e.g., `.js` -> `application/javascript; charset=utf-8`, `.html` -> `text/html; charset=utf-8`, `.css` -> `text/css`, `.json` -> `application/json`, `.ttf`/`.woff2` -> font types).
- Returns `HTTPURLResponse` with status 200 (or 404) and writes file data into `WKURLSchemeTask`.

### 4.2 WebKit Configuration
- `WKWebViewConfiguration` registers `EnigmaSchemeHandler` for scheme `"enigma"`.
- `WKPreferences` enables DeveloperExtras (optional debug) and JavaScript.
- Loads `enigma://app/index.html`.

### 4.3 Window & Menu
- Window size: default 1200×800, min 960×640.
- Title: "ENIGMA TERMINAL".
- Window style: `.titled`, `.closable`, `.miniaturizable`, `.resizable`, `.fullSizeContentView`.
- Titlebar style: transparent titlebar with hidden title text so the application header seamlessly occupies the top bar.

### 4.4 Build Script (`tools/build_macos_app.sh`)
- Compiles Swift sources targeting `arm64-apple-macos26.0`.
- Assembles directory structure:
  ```
  dist/Enigma Terminal.app/
    Contents/
      MacOS/EnigmaTerminal
      Resources/
        Info.plist
        AppIcon.icns
        web/ (mirrored from docs/)
  ```
- Strips any unneeded metadata.

---

## 5. Verification Plan

1. **Compilation Check:** Run build script on macOS; ensure zero errors and zero warnings.
2. **Bundle Structure & Metadata Test (`tests/test_macos_app.py`):**
   - Check `Info.plist` parses with `plistlib`.
   - Assert `LSMinimumSystemVersion` is `26.0`.
   - Assert `CFBundleIdentifier` is `com.enigmaterminal.app`.
   - Assert `Contents/MacOS/EnigmaTerminal` is executable.
   - Assert `Contents/Resources/web/index.html` exists and matches `docs/index.html`.
3. **Launch & Smoke Test:**
   - Execute binary or bundle via `open` or CLI test execution to verify startup and clean termination.
