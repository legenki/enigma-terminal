import Foundation
import SwiftUI
import Combine

public enum DaylightMode: String, CaseIterable, Identifiable {
    case live = "LIVE"
    case day = "DAY"
    case night = "NIGHT"

    public var id: String { rawValue }
}

public struct TerminalLine: Identifiable, Hashable {
    public let id = UUID()
    public let text: String
    public let style: TerminalLineStyle

    public init(_ text: String, style: TerminalLineStyle = .normal) {
        self.text = text
        self.style = style
    }
}

public enum TerminalLineStyle {
    case normal
    case prompt
    case ok
    case warn
    case error
    case cyan
    case amber

    public var color: Color {
        switch self {
        case .normal: return Color(red: 0.85, green: 0.87, blue: 0.90)
        case .prompt: return Color(red: 0.40, green: 0.95, blue: 0.70)
        case .ok: return Color(red: 0.35, green: 0.85, blue: 0.55)
        case .warn: return Color(red: 0.95, green: 0.75, blue: 0.30)
        case .error: return Color(red: 0.95, green: 0.35, blue: 0.35)
        case .cyan: return Color(red: 0.35, green: 0.80, blue: 0.95)
        case .amber: return Color(red: 0.95, green: 0.65, blue: 0.25)
        }
    }
}

@MainActor
public final class AppState: ObservableObject {
    @Published public var selectedPanel: AppPanel = .terminal
    @Published public var showInspector: Bool = false
    @Published public var designVariant: DesignVariant = .studio
    @Published public var daylightMode: DaylightMode = .live {
        didSet {
            updateTheme()
        }
    }
    @Published public var soundEnabled: Bool = true
    @Published public var selectedLanguage: String = "EN" {
        didSet {
            reloadGameData()
        }
    }
    @Published public var theme: AppTheme = AppTheme.make(isLight: false)

    public var isLightMode: Bool {
        switch daylightMode {
        case .day: return true
        case .night: return false
        case .live:
            let hour = Calendar.current.component(.hour, from: Date())
            return hour >= 7 && hour < 19
        }
    }

    public func updateTheme() {
        self.theme = AppTheme.make(isLight: isLightMode)
    }

    public func t(_ key: String) -> String {
        I18N.t(key, lang: selectedLanguage)
    }
    @Published public var blockHeight: Int = 881240
    @Published public var blockTimeAgo: String = "4m ago"
    @Published public var journal: [JournalItem] = []
    @Published public var terminalLines: [TerminalLine] = []
    @Published public var solvedCaseIDs: Set<Int> = []
    @Published public var solvedContractIDs: Set<Int> = []
    @Published public var campaignCases: [CampaignCase] = []
    @Published public var contracts: [ContractCase] = []
    @Published public var clients: [ClientInfo] = []
    public let core: EnigmaCore

    public init(core: EnigmaCore = .shared) {
        self.core = core
        setupWelcome()
    }

    private func setupWelcome() {
        terminalLines = [
            TerminalLine("ENIGMA TERMINAL v3.1.0 [macOS Native HIG Edition]", style: .cyan),
            TerminalLine("Connected to Bitcoin mainnet via public explorer client.", style: .normal),
            TerminalLine("Type HELP for command list, or select tools in the sidebar.", style: .normal),
            TerminalLine("---", style: .normal)
        ]
        log(tool: "system", summary: "Session initialized")
        reloadGameData()
    }

    public func reloadGameData() {
        let lang = selectedLanguage.lowercased()
        self.clients = core.loadClients(lang: lang)
        self.campaignCases = core.loadCampaignCases(lang: lang)
        self.contracts = core.loadContracts(lang: lang)
    }

    public func solveCase(id: Int, phrase: String) -> Bool {
        guard let c = campaignCases.first(where: { $0.id == id }) else { return false }
        if core.verifySolution(phrase: phrase, expectedFingerprint: c.fingerprint) {
            solvedCaseIDs.insert(id)
            appendTerminal("[ OK ] WALLET #\(id) DECRYPTED AND CLOSED!", style: .ok)
            appendTerminal("       Codename: \(c.codename)", style: .cyan)
            log(tool: "cases", summary: "Closed campaign case #\(id): \(c.codename)")
            return true
        }
        appendTerminal("[FAIL] Fingerprint mismatch for Wallet #\(id)", style: .error)
        return false
    }

    public func solveContract(id: Int, phrase: String) -> Bool {
        guard let c = contracts.first(where: { $0.id == id }) else { return false }
        if core.verifySolution(phrase: phrase, expectedFingerprint: c.fingerprint) {
            solvedContractIDs.insert(id)
            appendTerminal("[ OK ] CONTRACT #\(id) SOLVED!", style: .ok)
            appendTerminal("       Codename: \(c.codename) · Client: \(c.client)", style: .cyan)
            log(tool: "contracts", summary: "Solved contract #\(id): \(c.codename)")
            return true
        }
        appendTerminal("[FAIL] Verification rejected for contract #\(id)", style: .error)
        return false
    }

    public func log(tool: String, summary: String) {
        let item = JournalItem(tool: tool, summary: summary)
        journal.insert(item, at: 0)
    }

    public func appendTerminal(_ line: String, style: TerminalLineStyle = .normal) {
        terminalLines.append(TerminalLine(line, style: style))
    }

    public func clearTerminal() {
        terminalLines.removeAll()
    }

    public func runCommand(_ input: String) {
        let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        appendTerminal("nullsec@enigma:~$ \(trimmed)", style: .prompt)
        log(tool: "terminal", summary: trimmed)

        let parts = trimmed.components(separatedBy: .whitespaces).filter { !$0.isEmpty }
        let cmd = parts[0].uppercased()
        let args = Array(parts.dropFirst())

        switch cmd {
        case "HELP", "?":
            appendTerminal("Available commands: HELP, CLEAR, CASES, DECRYPT, WORD, FIND, RANDOM, STATUS", style: .cyan)
            appendTerminal("Sidebar provides full native GUI for all 12 modules.", style: .normal)

        case "CLEAR":
            clearTerminal()

        case "STATUS":
            appendTerminal("[ OK ] Height: \(blockHeight) · Pulse: \(blockTimeAgo) · Network: mainnet", style: .ok)
            appendTerminal("[INFO] Daylight: \(daylightMode.rawValue) · Language: \(selectedLanguage)", style: .normal)

        case "WORD":
            if let first = args.first, let idx = Int(first) {
                if let w = core.wordAt(index: idx) {
                    appendTerminal("[ OK ] Word #\(idx): \(w)", style: .ok)
                } else {
                    appendTerminal("[FAIL] Index must be 1..2048", style: .error)
                }
            } else if let first = args.first {
                let idx = core.indexOf(word: first)
                if idx > 0 {
                    appendTerminal("[ OK ] '\(first)' is at position #\(idx)", style: .ok)
                } else {
                    appendTerminal("[FAIL] Word not in BIP-39 wordlist", style: .error)
                }
            } else {
                appendTerminal("Usage: WORD <index|word>", style: .warn)
            }

        case "RANDOM", "ROLL":
            let phrase = core.randomMnemonic(wordCount: 12)
            appendTerminal("[ OK ] Generated fresh 12-word mnemonic:", style: .ok)
            appendTerminal("       \(phrase)", style: .cyan)

        case "DECRYPT":
            let phrase = args.joined(separator: " ")
            let val = core.validate(mnemonic: phrase)
            if !val.isValid {
                appendTerminal("[FAIL] \(val.errorMessage ?? "Invalid mnemonic")", style: .error)
            } else {
                appendTerminal("[ OK ] BIP-39 checksum valid (\(val.words.count) words)", style: .ok)
                let addrs = core.derive(mnemonic: phrase)
                for a in addrs {
                    appendTerminal("[+] \(a.label): \(a.address)", style: .normal)
                }
            }

        case "FIND", "COMPLETE":
            let pattern = args.joined(separator: " ")
            let (pos, candidates) = core.complete(pattern: pattern)
            if pos >= 0 {
                appendTerminal("[ OK ] Position #\(pos + 1) matches \(candidates.count) candidates:", style: .ok)
                appendTerminal("       \(candidates.prefix(12).joined(separator: ", "))\(candidates.count > 12 ? "..." : "")", style: .cyan)
            } else {
                appendTerminal("[FAIL] Place '?' at the missing word position", style: .error)
            }

        default:
            appendTerminal("[WARN] Command '\(cmd)' dispatched. Use sidebar to view dedicated panel.", style: .warn)
        }
    }
}
