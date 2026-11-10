import Foundation

public enum PanelCategory: String, CaseIterable, Identifiable {
    case workspace = "Workspace"
    case crypto = "Cryptography & Chain"
    case investigation = "Investigation"

    public var id: String { rawValue }
}

public enum DesignVariant: String, CaseIterable, Identifiable {
    case studio = "Studio IDE"
    case classicHIG = "Classic HIG"

    public var id: String { rawValue }
}

public enum AppPanel: String, CaseIterable, Identifiable {
    case terminal = "terminal"
    case cases = "cases"
    case contracts = "contracts"
    case acta = "acta"
    case decrypt = "decrypt"
    case ledger = "ledger"
    case explorer = "explorer"
    case randomizer = "randomizer"
    case nameforge = "nameforge"
    case archive = "archive"
    case journal = "journal"
    case about = "about"

    public var id: String { rawValue }

    public var title: String {
        switch self {
        case .terminal: return "Terminal"
        case .cases: return "Case Files"
        case .contracts: return "Contracts Board"
        case .acta: return "Acta"
        case .decrypt: return "Decrypt"
        case .ledger: return "Ledger"
        case .explorer: return "Explorer"
        case .randomizer: return "Randomizer"
        case .nameforge: return "Nameforge"
        case .archive: return "Archive"
        case .journal: return "Journal"
        case .about: return "About"
        }
    }

    public var systemImage: String {
        switch self {
        case .terminal: return "terminal.fill"
        case .cases: return "briefcase.fill"
        case .contracts: return "checkerboard.rectangle"
        case .acta: return "folder.fill"
        case .decrypt: return "lock.open.fill"
        case .ledger: return "list.bullet.rectangle.portrait.fill"
        case .explorer: return "network"
        case .randomizer: return "dice.fill"
        case .nameforge: return "hammer.fill"
        case .archive: return "archivebox.fill"
        case .journal: return "book.closed.fill"
        case .about: return "info.circle.fill"
        }
    }

    public var category: PanelCategory {
        switch self {
        case .terminal, .cases, .contracts, .acta:
            return .workspace
        case .decrypt, .ledger, .explorer, .randomizer, .nameforge:
            return .crypto
        case .archive, .journal, .about:
            return .investigation
        }
    }

    public var shortcutNumber: String? {
        switch self {
        case .terminal: return "1"
        case .cases: return "2"
        case .contracts: return "3"
        case .acta: return "A"
        case .decrypt: return "4"
        case .ledger: return "5"
        case .explorer: return "6"
        case .archive: return "7"
        case .randomizer: return "8"
        case .nameforge: return "F"
        case .journal: return "9"
        case .about: return "0"
        }
    }
}

public struct DerivedAddress: Identifiable, Hashable {
    public let id = UUID()
    public let label: String
    public let derivationPath: String
    public let address: String
    public let scriptType: String

    public init(label: String, derivationPath: String, address: String, scriptType: String) {
        self.label = label
        self.derivationPath = derivationPath
        self.address = address
        self.scriptType = scriptType
    }
}

public struct ValidationResult {
    public let isValid: Bool
    public let isChecksumValid: Bool
    public let words: [String]
    public let errorMessage: String?

    public init(isValid: Bool, isChecksumValid: Bool, words: [String], errorMessage: String? = nil) {
        self.isValid = isValid
        self.isChecksumValid = isChecksumValid
        self.words = words
        self.errorMessage = errorMessage
    }
}

public struct WordEntry: Identifiable, Hashable {
    public var id: Int { index }
    public let index: Int
    public let word: String

    public init(index: Int, word: String) {
        self.index = index
        self.word = word
    }
}

public struct JournalItem: Identifiable, Hashable {
    public let id: UUID
    public let timestamp: Date
    public let tool: String
    public let summary: String
    public var isPinned: Bool

    public init(id: UUID = UUID(), timestamp: Date = Date(), tool: String, summary: String, isPinned: Bool = false) {
        self.id = id
        self.timestamp = timestamp
        self.tool = tool
        self.summary = summary
        self.isPinned = isPinned
    }
}

public struct CampaignCase: Identifiable, Hashable {
    public let id: Int
    public let codename: String
    public let difficulty: Int
    public let fingerprint: String
    public let brief: [String]
    public let evidence: [String]
    public var isSolved: Bool

    public init(id: Int, codename: String, difficulty: Int, fingerprint: String, brief: [String], evidence: [String], isSolved: Bool = false) {
        self.id = id
        self.codename = codename
        self.difficulty = difficulty
        self.fingerprint = fingerprint
        self.brief = brief
        self.evidence = evidence
        self.isSolved = isSolved
    }
}

public struct ContractCase: Identifiable, Hashable {
    public let id: Int
    public let client: String
    public let act: Int // 1..4 (Phase I..IV)
    public let archetype: String
    public let difficulty: Int
    public let fingerprint: String
    public let codename: String
    public let brief: [String]
    public let evidence: [String]
    public var isSolved: Bool

    public init(id: Int, client: String, act: Int, archetype: String, difficulty: Int, fingerprint: String, codename: String, brief: [String], evidence: [String], isSolved: Bool = false) {
        self.id = id
        self.client = client
        self.act = act
        self.archetype = archetype
        self.difficulty = difficulty
        self.fingerprint = fingerprint
        self.codename = codename
        self.brief = brief
        self.evidence = evidence
        self.isSolved = isSolved
    }
}

public struct ClientInfo: Identifiable, Hashable {
    public var id: String { slug }
    public let slug: String
    public let name: String
    public let district: String
    public let kind: String

    public init(slug: String, name: String, district: String, kind: String) {
        self.slug = slug
        self.name = name
        self.district = district
        self.kind = kind
    }
}
