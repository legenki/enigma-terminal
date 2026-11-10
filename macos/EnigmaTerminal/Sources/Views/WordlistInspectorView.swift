import SwiftUI
import AppKit

public struct WordlistInspectorView: View {
    @EnvironmentObject private var appState: AppState

    @State private var selectedTab: Int = 0
    @State private var searchQuery: String = ""
    @State private var searchResults: [WordEntry] = []

    @State private var recoveryInput: String = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon ?"
    @State private var recoveryPosition: Int = -1
    @State private var recoveryCandidates: [String] = []

    public init() {}

    public var body: some View {
        VStack(spacing: 0) {
            Picker("Inspector Tool", selection: $selectedTab) {
                Text("Wordlist").tag(0)
                Text("Recovery (?)").tag(1)
            }
            .pickerStyle(.segmented)
            .padding(12)

            Divider()

            if selectedTab == 0 {
                wordlistSearchSection
            } else {
                recoverySection
            }
        }
        .onAppear {
            performSearch()
        }
    }

    private var wordlistSearchSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            TextField("Search word or index...", text: $searchQuery)
                .textFieldStyle(.roundedBorder)
                .padding(.horizontal, 12)
                .padding(.top, 8)
                .onChange(of: searchQuery) { _, _ in
                    performSearch()
                }

            List(searchResults) { entry in
                HStack {
                    Text("#\(entry.index)")
                        .font(.caption.monospaced())
                        .foregroundStyle(.secondary)
                        .frame(width: 44, alignment: .leading)
                    Text(entry.word)
                        .font(.body.monospaced())
                    Spacer()
                    Button {
                        NSPasteboard.general.clearContents()
                        NSPasteboard.general.setString(entry.word, forType: .string)
                    } label: {
                        Image(systemName: "doc.on.doc")
                            .font(.caption)
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(.secondary)
                }
                .padding(.vertical, 2)
            }
            .listStyle(.plain)
        }
    }

    private var recoverySection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Place '?' where a word is missing in a 12-word phrase to recover checksum-valid candidates.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .padding(.horizontal, 12)
                .padding(.top, 8)

            TextField("Phrase with ?", text: $recoveryInput)
                .textFieldStyle(.roundedBorder)
                .font(.caption.monospaced())
                .padding(.horizontal, 12)

            Button("Recover Candidates") {
                solveRecovery()
            }
            .buttonStyle(.borderedProminent)
            .padding(.horizontal, 12)

            if recoveryPosition >= 0 {
                Text("Position #\(recoveryPosition + 1) — \(recoveryCandidates.count) matches:")
                    .font(.caption.bold())
                    .padding(.horizontal, 12)
                    .padding(.top, 4)

                List(recoveryCandidates, id: \.self) { word in
                    HStack {
                        Text(word)
                            .font(.body.monospaced())
                        Spacer()
                        Button("Copy") {
                            NSPasteboard.general.clearContents()
                            NSPasteboard.general.setString(word, forType: .string)
                        }
                        .buttonStyle(.bordered)
                        .controlSize(.small)
                    }
                }
                .listStyle(.plain)
            } else {
                Spacer()
            }
        }
    }

    private func performSearch() {
        let q = searchQuery.trimmingCharacters(in: .whitespaces).lowercased()
        if q.isEmpty {
            searchResults = (1...20).compactMap { idx in
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

    private func solveRecovery() {
        let (pos, candidates) = appState.core.complete(pattern: recoveryInput)
        self.recoveryPosition = pos
        self.recoveryCandidates = candidates
        appState.log(tool: "recovery", summary: "Recovered \(candidates.count) words for pattern")
    }
}
