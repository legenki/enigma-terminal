# Design Specification: Native macOS 26 SwiftUI Application for Enigma Terminal

**Date:** 2026-11-10  
**Target Platform:** macOS 26.0 and above (`LSMinimumSystemVersion = 26.0`, Apple Silicon / Universal binary)  
**Deliverable:** 100% Native SwiftUI Application (`Enigma Terminal.app`) following Apple Human Interface Guidelines for macOS 26+.

---

## 1. Problem Statement & User Intent

The user requires a completely native macOS application where the entire UI is built with native macOS controls, patterns, and design guidelines (Apple HIG), with no browser wrapper (`WKWebView`), no HTML, and no CSS.

The application must look and feel like a modern macOS 26 application:
- Standard multi-pane window layout with native sidebar (`NavigationSplitView`).
- Native macOS toolbars with segmented pickers, status pills, and search fields.
- Native UI components: `Table`, `Form`, `Section`, `Grid`, `GroupBox`, `TextField`, `Picker`, and native buttons.
- Collapsible native Inspector panel (`.inspector`) on the trailing side for quick lookups.
- Native system typography (`SF Pro` for narrative/labels, `SF Mono` for cryptographic data, seeds, addresses, and terminal logs).
- Native system materials (`.ultraThinMaterial`, `.regularMaterial`, `.sidebar`).
- Full keyboard shortcut support (`Cmd+1`..`Cmd+9`, `Cmd+F`, `Cmd+R`, etc.).

---

## 2. Technical Architecture

### 2.1 UI Layer (100% SwiftUI)
Zero WebKit, zero DOM, zero HTML.
- **Root View (`ContentView.swift`):**
  Uses `NavigationSplitView(sidebar:detail:)` with an optional trailing inspector `.inspector(isPresented:)`.
- **Sidebar (`SidebarView.swift`):**
  A native sidebar list categorized into:
  - *Workspace:* Terminal, Case files, Contracts, Acta.
  - *Cryptography & Chain:* Decrypt, Ledger, Explorer, Randomizer, Nameforge.
  - *Investigation:* Archive, Journal, About.
- **Detail View:**
  Dynamically presents native view controllers:
  - `TerminalView`: Native monospace scrollable log with prompt input and command history.
  - `CaseFilesView`: Native cards with Act briefs, evidence tabs, and solution entry.
  - `ContractsBoardView`: Employer selector and filterable contract cards.
  - `DecryptView`: Native 12-word grid with instant BIP-39 checksum badge and derivation table (P2PKH, P2SH-P2WPKH, P2WPKH).
  - `ExplorerView`: Real-time block monitor, fee rate gauges, and on-chain lookup.
  - `RandomizerView`: Native dice/coin entropy generator and BIP-39 mnemonic creator.
  - `NameforgeView`: Vanity address generator form with live difficulty calculations and async search.
  - `JournalView`: Searchable native `Table` with filtering, pinning, and recall.
  - `AboutView`: Native system about panel.
- **Trailing Inspector (`WordlistInspectorView.swift`):**
  Houses the BIP-39 wordlist lookup and missing-word recovery tool.
- **Toolbar:**
  Native macOS toolbar with block countdown pill, daylight segmented control, language picker, and inspector toggle.

### 2.2 Core Logic & Cryptography Bridge (`EnigmaCore.swift`)
- Hosted inside Apple's native in-process `JavaScriptCore` framework (`import JavaScriptCore`).
- Runs headless in memory with zero browser rendering overhead.
- Loads existing verified modules (`bip39.js`, `secp256k1.js`, `hash.js`, `wallet.js`, `encoding.js`) and JSON datasets (`cases.json`, `contracts.json`, `story.json`, `english.txt`).
- Exposes typed Swift interfaces for:
  - Mnemonic checksum validation and error reporting.
  - Key derivation (BIP-32 root key, public keys, addresses).
  - Missing word recovery (BIP-39 checksum search).
  - Contract and case queries.
  - Journal management and local persistence in `UserDefaults` / Application Support.

---

## 3. Directory Layout

```
macos/
└── EnigmaTerminal/
    ├── Sources/
    │   ├── App/
    │   │   ├── EnigmaTerminalApp.swift     # @main SwiftUI App entry point
    │   │   ├── MenuCommands.swift          # Native CommandMenu commands
    │   │   └── AppState.swift              # Observable app state & environment
    │   ├── Core/
    │   │   ├── EnigmaCore.swift            # JavaScriptCore bridge & crypto service
    │   │   └── Models.swift                # Swift structs for Cases, Derivations, Blocks
    │   └── Views/
    │       ├── ContentView.swift           # NavigationSplitView container
    │       ├── SidebarView.swift           # Native macOS sidebar
    │       ├── AppToolbar.swift            # Native toolbar items
    │       ├── TerminalView.swift          # Native terminal console
    │       ├── CaseFilesView.swift         # Case file browser & submission
    │       ├── ContractsBoardView.swift    # 256 contracts matrix
    │       ├── DecryptView.swift           # 12-word seed derivation tool
    │       ├── ExplorerView.swift          # Live chain & mempool view
    │       ├── RandomizerView.swift        # Entropy & mnemonic generator
    │       ├── NameforgeView.swift         # Vanity address forge
    │       ├── JournalView.swift           # Searchable journal table
    │       ├── WordlistInspectorView.swift # Collapsible trailing inspector
    │       └── AboutView.swift             # About dialog view
    └── Resources/
        ├── Info.plist                      # LSMinimumSystemVersion = 26.0
        ├── Entitlements.plist              # Network client entitlement
        └── AppIcon.icns                    # Native application icon
```

---

## 4. Verification & Testing

1. **Compilation Check:**
   Compile with `swiftc -target arm64-apple-macos26.0` using Swift 6 / SwiftUI.
2. **SwiftUI Inspector & SplitView Sanity:**
   Verify all views instantiate and bind to `AppState` without runtime exceptions.
3. **Parity Check:**
   `EnigmaCore` tests verify that `validateMnemonic` and `deriveAddresses` return bit-for-bit identical outputs to `test_vectors.json`.
4. **Bundle Verification:**
   `tests/test_macos_app.py` updated to verify native SwiftUI binary architecture, absence of webview dependency, and compliance with macOS 26.0+.
