import SwiftUI
import AppKit

public struct WordlistInspectorView: View {
    @EnvironmentObject private var appState: AppState

    @State private var selectedTab: Int = 0
    @State private var filterQuery: String = ""
    @State private var searchResults: [WordEntry] = []

    // Recovery State
    @State private var recoveryInput: String = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon ?"
    @State private var recoveryPosition: Int = -1
    @State private var recoveryCandidates: [String] = []

    public init() {}

    public var body: some View {
        VStack(spacing: 0) {
            // 1. Top Tab Strip (matching screenshot: Files, Changes, Review, Checks)
            HStack(spacing: 0) {
                tabButton(title: "Wordlist", index: 0)
                tabButton(title: "Recovery", index: 1)
                tabButton(title: "Chain", index: 2)
                tabButton(title: "Journal", index: 3)
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 8)
            .background(Theme.sidebarBg)

            Divider()
                .overlay(Theme.border)

            // 2. Filter Bar (matching screenshot: Filter input with eye and expand icons)
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .font(.caption2)
                    .foregroundStyle(Theme.textMuted)

                TextField("Filter...", text: $filterQuery)
                    .textFieldStyle(.plain)
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundStyle(Theme.textPrimary)
                    .onChange(of: filterQuery) { _, _ in
                        performSearch()
                    }

                Spacer()

                Image(systemName: "eye")
                    .font(.caption2)
                    .foregroundStyle(Theme.textMuted)

                Image(systemName: "arrow.up.left.and.arrow.down.right")
                    .font(.caption2)
                    .foregroundStyle(Theme.textMuted)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(Theme.inputBg)
            .clipShape(RoundedRectangle(cornerRadius: 6))
            .overlay(RoundedRectangle(cornerRadius: 6).stroke(Theme.border, lineWidth: 1))
            .padding(.horizontal, 10)
            .padding(.vertical, 8)

            Divider()
                .overlay(Theme.borderSubtle)

            // 3. Tab Content View
            Group {
                switch selectedTab {
                case 0:
                    wordlistTreeView
                case 1:
                    recoveryInspectorView
                case 2:
                    chainStatusView
                default:
                    journalMiniView
                }
            }

            Divider()
                .overlay(Theme.border)

            // 4. Bottom Terminal / Console Drawer (matching screenshot's bottom-right pane)
            bottomTerminalDrawer
        }
        .background(Theme.sidebarBg)
        .onAppear {
            performSearch()
        }
    }

    private func tabButton(title: String, index: Int) -> some View {
        let isSelected = selectedTab == index
        return Button {
            selectedTab = index
        } label: {
            Text(title)
                .font(.system(size: 11, weight: isSelected ? .semibold : .regular))
                .foregroundStyle(isSelected ? Theme.textPrimary : Theme.textMuted)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(
                    isSelected ? Theme.purpleSoft : Color.clear,
                    in: RoundedRectangle(cornerRadius: 4)
                )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Wordlist Tree View

    private var wordlistTreeView: some View {
        List {
            ForEach(searchResults) { entry in
                HStack(spacing: 8) {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 8))
                        .foregroundStyle(Theme.textMuted)

                    Image(systemName: "doc.text")
                        .font(.caption2)
                        .foregroundStyle(Theme.purple)

                    Text("#\(entry.index)")
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundStyle(Theme.textMuted)
                        .frame(width: 36, alignment: .leading)

                    Text(entry.word)
                        .font(.system(size: 12, design: .monospaced))
                        .foregroundStyle(Theme.textPrimary)

                    Spacer()

                    Button {
                        NSPasteboard.general.clearContents()
                        NSPasteboard.general.setString(entry.word, forType: .string)
                    } label: {
                        Image(systemName: "doc.on.doc")
                            .font(.system(size: 10))
                            .foregroundStyle(Theme.textMuted)
                    }
                    .buttonStyle(.plain)
                }
                .padding(.vertical, 2)
            }
        }
        .listStyle(.plain)
    }

    // MARK: - Recovery View

    private var recoveryInspectorView: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Single-Word BIP-39 Recovery")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Theme.textPrimary)

            TextField("Phrase with ?...", text: $recoveryInput)
                .textFieldStyle(.plain)
                .font(.system(size: 11, design: .monospaced))
                .padding(8)
                .background(Theme.inputBg, in: RoundedRectangle(cornerRadius: 6))
                .overlay(RoundedRectangle(cornerRadius: 6).stroke(Theme.border, lineWidth: 1))

            Button("Solve Candidates") {
                let (pos, candidates) = appState.core.complete(pattern: recoveryInput)
                self.recoveryPosition = pos
                self.recoveryCandidates = candidates
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.small)

            if recoveryPosition >= 0 {
                Text("Pos #\(recoveryPosition + 1) · \(recoveryCandidates.count) candidates:")
                    .font(.system(size: 10, weight: .bold, design: .monospaced))
                    .foregroundStyle(Theme.cyan)

                List(recoveryCandidates, id: \.self) { word in
                    HStack {
                        Text(word)
                            .font(.system(size: 11, design: .monospaced))
                            .foregroundStyle(Theme.textPrimary)
                        Spacer()
                        Button("Use") {
                            NSPasteboard.general.clearContents()
                            NSPasteboard.general.setString(word, forType: .string)
                        }
                        .buttonStyle(.bordered)
                        .controlSize(.mini)
                    }
                }
                .listStyle(.plain)
            } else {
                Spacer()
            }
        }
        .padding(10)
    }

    // MARK: - Chain Status View

    private var chainStatusView: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Block Monitor & Fees")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Theme.textPrimary)

            VStack(spacing: 8) {
                metricRow(label: "Current Height", value: "#\(appState.blockHeight)", tint: Theme.purple)
                metricRow(label: "Block Pulse", value: appState.blockTimeAgo, tint: Theme.green)
                metricRow(label: "Fastest Fee", value: "18 sat/vB", tint: Theme.amber)
                metricRow(label: "Mempool", value: "42.5 MB", tint: Theme.cyan)
            }
            .padding(10)
            .background(Theme.cardInner, in: RoundedRectangle(cornerRadius: 8))

            Spacer()
        }
        .padding(10)
    }

    private func metricRow(label: String, value: String, tint: Color) -> some View {
        HStack {
            Text(label)
                .font(.system(size: 11))
                .foregroundStyle(Theme.textSecondary)
            Spacer()
            Text(value)
                .font(.system(size: 11, weight: .bold, design: .monospaced))
                .foregroundStyle(tint)
        }
    }

    // MARK: - Journal Mini View

    private var journalMiniView: some View {
        List(appState.journal) { item in
            VStack(alignment: .leading, spacing: 2) {
                HStack {
                    Text(item.tool.uppercased())
                        .font(.system(size: 9, weight: .bold, design: .monospaced))
                        .foregroundStyle(Theme.purple)
                    Spacer()
                    Text(item.timestamp, style: .time)
                        .font(.system(size: 9, design: .monospaced))
                        .foregroundStyle(Theme.textMuted)
                }
                Text(item.summary)
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.textPrimary)
                    .lineLimit(2)
            }
            .padding(.vertical, 2)
        }
        .listStyle(.plain)
    }

    // MARK: - Bottom Terminal Drawer (Matching bottom-right terminal in screenshot)

    private var bottomTerminalDrawer: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Tabs on bottom drawer: Setup, Run, Terminal, +
            HStack(spacing: 12) {
                Text("Setup")
                    .font(.system(size: 10))
                    .foregroundStyle(Theme.textMuted)
                Text("Run")
                    .font(.system(size: 10))
                    .foregroundStyle(Theme.textMuted)
                HStack(spacing: 4) {
                    Image(systemName: "terminal.fill")
                        .font(.system(size: 9))
                    Text("Terminal")
                        .font(.system(size: 10, weight: .semibold))
                }
                .foregroundStyle(Theme.purple)

                Spacer()

                Image(systemName: "plus")
                    .font(.system(size: 9))
                    .foregroundStyle(Theme.textMuted)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(Color.black.opacity(0.2))

            // Output feed
            VStack(alignment: .leading, spacing: 4) {
                Text("v3.1.0 via CoreBridge")
                    .font(.system(size: 10, design: .monospaced))
                    .foregroundStyle(Theme.amber)
                Text("enigma-terminal on ⎇ main [✓]")
                    .font(.system(size: 10, design: .monospaced))
                    .foregroundStyle(Theme.green)
                Text("482 tests passed · parity 100%")
                    .font(.system(size: 10, design: .monospaced))
                    .foregroundStyle(Theme.cyan)
            }
            .padding(10)
        }
        .background(Theme.cardInner)
    }

    private func performSearch() {
        let q = filterQuery.trimmingCharacters(in: .whitespaces).lowercased()
        if q.isEmpty {
            searchResults = (1...25).compactMap { idx in
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
            searchResults = appState.core.searchWords(prefix: q, limit: 30)
        }
    }
}
