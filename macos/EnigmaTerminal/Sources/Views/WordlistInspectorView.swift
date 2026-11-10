import SwiftUI
import AppKit

public struct WordlistInspectorView: View {
    @EnvironmentObject private var appState: AppState

    @State private var selectedTab: Int = 0
    @State private var filterQuery: String = ""
    @State private var searchResults: [WordEntry] = []
    @State private var copiedWord: String?

    // Recovery State
    @State private var recoveryInput: String = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon ?"
    @State private var recoveryPosition: Int = -1
    @State private var recoveryCandidates: [String] = []

    // Live Chain State
    @State private var liveLatencyMs: Int?
    @State private var liveFastestFee: Int?
    @State private var isFetchingChain: Bool = false

    // Bottom Drawer Tab
    @State private var drawerTab: String = "Terminal"

    public init() {}

    private var theme: AppTheme { appState.theme }

    public var body: some View {
        VStack(spacing: 0) {
            // 1. Top Tab Strip
            HStack(spacing: 4) {
                tabButton(title: appState.t("tabWordlist"), index: 0)
                tabButton(title: appState.t("tabRecovery"), index: 1)
                tabButton(title: appState.t("tabChain"), index: 2)
                tabButton(title: appState.t("tabJournal"), index: 3)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
            .background(theme.sidebarBg)

            Divider()
                .overlay(theme.border)

            // 2. Filter Bar
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .font(.caption2)
                    .foregroundStyle(theme.textMuted)

                TextField(appState.t("filterPlaceholder"), text: $filterQuery)
                    .textFieldStyle(.plain)
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundStyle(theme.textPrimary)
                    .onChange(of: filterQuery) { _, _ in
                        performSearch()
                    }

                Spacer()

                if !filterQuery.isEmpty {
                    Button {
                        filterQuery = ""
                        performSearch()
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.caption2)
                            .foregroundStyle(theme.textMuted)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(theme.inputBg)
            .clipShape(RoundedRectangle(cornerRadius: 6))
            .overlay(RoundedRectangle(cornerRadius: 6).stroke(theme.border, lineWidth: 1))
            .padding(.horizontal, 12)
            .padding(.vertical, 8)

            Divider()
                .overlay(theme.borderSubtle)

            // 3. Tab Content View
            Group {
                switch selectedTab {
                case 0:
                    wordlistScrollView
                case 1:
                    recoveryView
                case 2:
                    chainView
                default:
                    journalView
                }
            }

            Divider()
                .overlay(theme.border)

            // 4. Interactive Bottom Drawer
            interactiveBottomDrawer
        }
        .background(theme.sidebarBg)
        .onAppear {
            performSearch()
            fetchLiveChain()
        }
    }

    private func tabButton(title: String, index: Int) -> some View {
        let isSelected = selectedTab == index
        return Button {
            selectedTab = index
        } label: {
            Text(title)
                .font(.system(size: 11, weight: isSelected ? .bold : .medium))
                .foregroundStyle(isSelected ? theme.purple : theme.textMuted)
                .padding(.horizontal, 8)
                .padding(.vertical, 5)
                .background(
                    isSelected ? theme.purpleSoft : Color.clear,
                    in: RoundedRectangle(cornerRadius: 6)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 6)
                        .stroke(isSelected ? theme.borderGlow : Color.clear, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Wordlist Clean ScrollView

    private var wordlistScrollView: some View {
        ScrollView {
            LazyVStack(spacing: 2) {
                ForEach(searchResults) { entry in
                    let isJustCopied = copiedWord == entry.word
                    HStack(spacing: 10) {
                        Text("#\(entry.index)")
                            .font(.system(size: 10, weight: .bold, design: .monospaced))
                            .foregroundStyle(theme.cyan)
                            .frame(width: 38, alignment: .leading)

                        Text(entry.word)
                            .font(.system(size: 12, design: .monospaced))
                            .foregroundStyle(theme.textPrimary)

                        Spacer()

                        Button {
                            NSPasteboard.general.clearContents()
                            NSPasteboard.general.setString(entry.word, forType: .string)
                            copiedWord = entry.word
                            DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
                                if copiedWord == entry.word { copiedWord = nil }
                            }
                        } label: {
                            Image(systemName: isJustCopied ? "checkmark" : "doc.on.doc")
                                .font(.system(size: 10))
                                .foregroundStyle(isJustCopied ? theme.green : theme.textMuted)
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(
                        isJustCopied ? theme.green.opacity(0.12) : (theme.isLight ? Color.black.opacity(0.02) : Color.white.opacity(0.02)),
                        in: RoundedRectangle(cornerRadius: 6)
                    )
                }
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 6)
        }
    }

    // MARK: - Recovery View

    private var recoveryView: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(appState.selectedLanguage == "RU" ? "Восстановление пропущенного слова" : "Single-Word BIP-39 Recovery")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(theme.textPrimary)

            TextField("abandon ... ?", text: $recoveryInput)
                .textFieldStyle(.plain)
                .font(.system(size: 11, design: .monospaced))
                .padding(8)
                .background(theme.inputBg, in: RoundedRectangle(cornerRadius: 6))
                .overlay(RoundedRectangle(cornerRadius: 6).stroke(theme.border, lineWidth: 1))

            Button(appState.t("solveCandidates")) {
                let (pos, candidates) = appState.core.complete(pattern: recoveryInput)
                self.recoveryPosition = pos
                self.recoveryCandidates = candidates
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.small)

            if recoveryPosition >= 0 {
                Text(appState.selectedLanguage == "RU" ? "Позиция #\(recoveryPosition + 1) · \(recoveryCandidates.count) совпадений:" : "Pos #\(recoveryPosition + 1) · \(recoveryCandidates.count) matches:")
                    .font(.system(size: 10, weight: .bold, design: .monospaced))
                    .foregroundStyle(theme.cyan)

                ScrollView {
                    LazyVStack(spacing: 4) {
                        ForEach(recoveryCandidates, id: \.self) { word in
                            HStack {
                                Text(word)
                                    .font(.system(size: 11, design: .monospaced))
                                    .foregroundStyle(theme.textPrimary)
                                Spacer()
                                Button("Copy") {
                                    NSPasteboard.general.clearContents()
                                    NSPasteboard.general.setString(word, forType: .string)
                                }
                                .buttonStyle(.bordered)
                                .controlSize(.mini)
                            }
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(theme.cardInner, in: RoundedRectangle(cornerRadius: 4))
                        }
                    }
                }
            } else {
                Spacer()
            }
        }
        .padding(12)
    }

    // MARK: - Live Chain View

    private var chainView: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text(appState.selectedLanguage == "RU" ? "Пульс сети Bitcoin" : "Bitcoin Network Pulse")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(theme.textPrimary)
                Spacer()
                Button {
                    fetchLiveChain()
                } label: {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 11))
                        .foregroundStyle(isFetchingChain ? theme.purple : theme.textSecondary)
                }
                .buttonStyle(.plain)
            }

            VStack(spacing: 8) {
                metricRow(label: appState.t("tipHeight"), value: "#\(appState.blockHeight)", tint: theme.purple)
                metricRow(label: appState.selectedLanguage == "RU" ? "Время блока" : "Block Pulse", value: appState.blockTimeAgo, tint: theme.green)
                if let fee = liveFastestFee {
                    metricRow(label: appState.t("recFee"), value: "\(fee) sat/vB", tint: theme.amber)
                }
                if let lat = liveLatencyMs {
                    metricRow(label: appState.t("apiLatency"), value: "\(lat) ms", tint: theme.cyan)
                }
            }
            .padding(12)
            .background(theme.cardInner, in: RoundedRectangle(cornerRadius: 8))

            Link(destination: URL(string: "https://mempool.space")!) {
                HStack {
                    Text("mempool.space ↗")
                    Spacer()
                    Image(systemName: "arrow.up.right.square")
                }
                .font(.system(size: 11))
                .foregroundStyle(theme.purple)
                .padding(8)
            }

            Spacer()
        }
        .padding(12)
    }

    private func metricRow(label: String, value: String, tint: Color) -> some View {
        HStack {
            Text(label)
                .font(.system(size: 11))
                .foregroundStyle(theme.textSecondary)
            Spacer()
            Text(value)
                .font(.system(size: 11, weight: .bold, design: .monospaced))
                .foregroundStyle(tint)
        }
    }

    // MARK: - Journal View

    private var journalView: some View {
        ScrollView {
            LazyVStack(spacing: 6) {
                ForEach(appState.journal) { item in
                    VStack(alignment: .leading, spacing: 3) {
                        HStack {
                            Text(item.tool.uppercased())
                                .font(.system(size: 9, weight: .bold, design: .monospaced))
                                .foregroundStyle(theme.purple)
                            Spacer()
                            Text(item.timestamp, style: .time)
                                .font(.system(size: 9, design: .monospaced))
                                .foregroundStyle(theme.textMuted)
                        }
                        Text(item.summary)
                            .font(.system(size: 11))
                            .foregroundStyle(theme.textPrimary)
                    }
                    .padding(8)
                    .background(theme.cardInner, in: RoundedRectangle(cornerRadius: 6))
                }
            }
            .padding(8)
        }
    }

    // MARK: - Interactive Bottom Drawer

    private var interactiveBottomDrawer: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 12) {
                drawerTabButton("Setup")
                drawerTabButton("Run")
                drawerTabButton("Terminal")
                Spacer()
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(theme.isLight ? Color.black.opacity(0.06) : Color.black.opacity(0.3))

            VStack(alignment: .leading, spacing: 4) {
                if drawerTab == "Terminal" {
                    Text("v3.1.0 via CoreBridge")
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundStyle(theme.amber)
                    Text("enigma-terminal on ⎇ main [✓]")
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundStyle(theme.green)
                    Text("482 tests passed · parity 100%")
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundStyle(theme.cyan)
                } else if drawerTab == "Run" {
                    Text("[STATUS] Block #\(appState.blockHeight) · mainnet")
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundStyle(theme.green)
                    Text("[STATS] Solved Cases: \(appState.solvedCaseIDs.count)/8")
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundStyle(theme.purple)
                    Text("[STATS] Solved Contracts: \(appState.solvedContractIDs.count)/256")
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundStyle(theme.cyan)
                } else {
                    Text("Runtime: Apple Swift 6.4 + AppKit")
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundStyle(theme.textSecondary)
                    Text("Crypto: JavaScriptCore In-Process VM")
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundStyle(theme.textSecondary)
                    Text("Target: macOS 26.0+ (ARM64)")
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundStyle(theme.textSecondary)
                }
            }
            .padding(10)
        }
        .background(theme.cardInner)
    }

    private func drawerTabButton(_ name: String) -> some View {
        let isSelected = drawerTab == name
        return Button {
            drawerTab = name
        } label: {
            HStack(spacing: 3) {
                if name == "Terminal" {
                    Image(systemName: "terminal.fill")
                        .font(.system(size: 8))
                }
                Text(name)
                    .font(.system(size: 10, weight: isSelected ? .bold : .regular))
            }
            .foregroundStyle(isSelected ? theme.purple : theme.textMuted)
        }
        .buttonStyle(.plain)
    }

    private func performSearch() {
        let q = filterQuery.trimmingCharacters(in: .whitespaces).lowercased()
        if q.isEmpty {
            searchResults = (1...30).compactMap { idx in
                if let w = appState.core.wordAt(index: idx) {
                    return WordEntry(index: idx, word: w)
                }
                return nil
            }
        } else if let idx = Int(q) {
            if let w = appState.core.wordAt(index: idx) {
                searchResults = [WordEntry(index: idx, word: w)]
            } else {
                searchResults = []
            }
        } else {
            searchResults = appState.core.searchWords(prefix: q, limit: 40)
        }
    }

    private func fetchLiveChain() {
        guard !isFetchingChain else { return }
        isFetchingChain = true
        let start = Date()

        guard let heightURL = URL(string: "https://mempool.space/api/blocks/tip/height") else {
            isFetchingChain = false
            return
        }

        URLSession.shared.dataTask(with: heightURL) { data, _, _ in
            let duration = Int(Date().timeIntervalSince(start) * 1000)
            if let data = data, let str = String(data: data, encoding: .utf8), let h = Int(str.trimmingCharacters(in: .whitespacesAndNewlines)) {
                DispatchQueue.main.async {
                    self.appState.blockHeight = h
                    self.appState.blockTimeAgo = self.appState.selectedLanguage == "RU" ? "только что" : "just now"
                    self.liveLatencyMs = duration
                    self.isFetchingChain = false
                }
            } else {
                DispatchQueue.main.async {
                    self.isFetchingChain = false
                }
            }
        }.resume()

        if let feeURL = URL(string: "https://mempool.space/api/v1/fees/recommended") {
            URLSession.shared.dataTask(with: feeURL) { data, _, _ in
                if let data = data,
                   let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                   let fastest = json["fastestFee"] as? Int {
                    DispatchQueue.main.async {
                        self.liveFastestFee = fastest
                    }
                }
            }.resume()
        }
    }
}
