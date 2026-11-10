# Native macOS 26 SwiftUI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a 100% native SwiftUI desktop application for macOS 26 and above following Apple Human Interface Guidelines, completely replacing the webview wrapper.

**Architecture:** A native SwiftUI application (`NavigationSplitView`, native Toolbar, `.sidebar`, `.inspector`, `Table`, `Form`, `SF Mono` / `San Francisco` fonts) driven by an `AppState` observable environment object. Core cryptographic operations, BIP-39 validation, and contract data are executed in-process through Apple's native `JavaScriptCore` (`JSContext`) engine without any DOM or WebKit.

**Tech Stack:** Swift 6, SwiftUI, AppKit, JavaScriptCore, macOS SDK 26.0+, Python 3 (tests).

**Spec:** `docs/superpowers/specs/2026-11-10-native-swiftui-macos-design.md`

## Global Constraints

- Target OS version: macOS 26.0+ (`LSMinimumSystemVersion = 26.0`).
- Pure native SwiftUI UI: zero `WKWebView`, zero HTML, zero CSS.
- Design: Apple HIG compliant — sidebar, standard toolbar, native inspector, native controls, standard keyboard shortcuts.
- In-process execution: `JavaScriptCore` executes purely in memory.

## Review Focus

1. Text inputs in SwiftUI must handle copy, paste, select all, undo, and redo without browser dependencies.
2. Derivation grid must handle invalid mnemonics gracefully with red status indicators rather than throwing unhandled exceptions.
3. Native inspector must toggle smoothly on macOS using the standard toolbar toggle.
4. Daylight themes (Live, Day, Night) must dynamically adjust SwiftUI window background and accent tones.
5. Missing word completion must evaluate synchronously and populate suggestion pickers.

---

### Task 1: EnigmaCore and Models

**Files:**
- Create: `macos/EnigmaTerminal/Sources/Core/Models.swift`
- Create: `macos/EnigmaTerminal/Sources/Core/EnigmaCore.swift`

- [ ] **Step 1: Define Swift models for Panel, DerivedAddress, CaseBrief, Contract, and JournalEntry**
- [ ] **Step 2: Implement EnigmaCore loading JavaScriptCore context with crypto modules and data**
- [ ] **Step 3: Implement validation, derivation, wordlist search, and command dispatch in EnigmaCore**

---

### Task 2: AppState and SwiftUI Shell

**Files:**
- Create: `macos/EnigmaTerminal/Sources/App/AppState.swift`
- Create: `macos/EnigmaTerminal/Sources/App/EnigmaTerminalApp.swift`
- Create: `macos/EnigmaTerminal/Sources/App/MenuCommands.swift`
- Create: `macos/EnigmaTerminal/Sources/Views/ContentView.swift`
- Create: `macos/EnigmaTerminal/Sources/Views/SidebarView.swift`
- Create: `macos/EnigmaTerminal/Sources/Views/AppToolbar.swift`
- Create: `macos/EnigmaTerminal/Sources/Views/WordlistInspectorView.swift`

- [ ] **Step 1: Implement AppState with active panel selection, inspector state, daylight mode, and core bridge**
- [ ] **Step 2: Implement SidebarView with sections, SF Symbols, and badge counters**
- [ ] **Step 3: Implement AppToolbar with block status pill, daylight picker, sound button, and inspector toggle**
- [ ] **Step 4: Implement WordlistInspectorView with word search and missing word solver**
- [ ] **Step 5: Assemble ContentView with NavigationSplitView and native .inspector**
- [ ] **Step 6: Implement EnigmaTerminalApp and MenuCommands with native macOS shortcuts**

---

### Task 3: Native Feature Views

**Files:**
- Create: `macos/EnigmaTerminal/Sources/Views/TerminalView.swift`
- Create: `macos/EnigmaTerminal/Sources/Views/DecryptView.swift`
- Create: `macos/EnigmaTerminal/Sources/Views/CaseFilesView.swift`
- Create: `macos/EnigmaTerminal/Sources/Views/ContractsBoardView.swift`
- Create: `macos/EnigmaTerminal/Sources/Views/ExplorerView.swift`
- Create: `macos/EnigmaTerminal/Sources/Views/RandomizerView.swift`
- Create: `macos/EnigmaTerminal/Sources/Views/NameforgeView.swift`
- Create: `macos/EnigmaTerminal/Sources/Views/JournalView.swift`
- Create: `macos/EnigmaTerminal/Sources/Views/AboutView.swift`

- [ ] **Step 1: Implement TerminalView with command history, colorized tags, and scroll-to-bottom**
- [ ] **Step 2: Implement DecryptView with 12-word grid, checksum status pill, and address copy cards**
- [ ] **Step 3: Implement CaseFilesView and ContractsBoardView with native macOS cards and badges**
- [ ] **Step 4: Implement ExplorerView, RandomizerView, NameforgeView, JournalView, and AboutView**

---

### Task 4: Build Script and Verification

**Files:**
- Modify: `tools/build_macos_app.sh`
- Modify: `tests/test_macos_app.py`

- [ ] **Step 1: Update build script to compile all SwiftUI sources into the native executable**
- [ ] **Step 2: Copy JavaScriptCore scripts and data into Resources/jsc**
- [ ] **Step 3: Update automated test suite to assert native SwiftUI binary and verify zero WKWebView references**
- [ ] **Step 4: Run pytest and launch verification**
