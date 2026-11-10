import SwiftUI

public struct CaseFilesView: View {
    @EnvironmentObject private var appState: AppState

    @State private var selectedCaseID: Int = 1
    @State private var phraseInput: String = ""
    @State private var verifyError: String?
    @State private var solvedAddresses: [DerivedAddress] = []

    public init() {}

    private var currentCases: [CampaignCase] {
        if appState.campaignCases.isEmpty {
            return appState.core.loadCampaignCases(lang: appState.selectedLanguage.lowercased())
        }
        return appState.campaignCases
    }

    private var activeCase: CampaignCase? {
        currentCases.first(where: { $0.id == selectedCaseID }) ?? currentCases.first
    }

    public var body: some View {
        HSplitView {
            // Left Pane: Case Files Master List
            VStack(spacing: 0) {
                HStack {
                    Text("CAMPAIGN ACTS")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(Theme.textMuted)
                    Spacer()
                    Text("\(appState.solvedCaseIDs.count)/\(currentCases.count) Closed")
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundStyle(Theme.green)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(Theme.sidebarBg.opacity(0.8))

                Divider()
                    .overlay(Theme.border)

                List(currentCases) { c in
                    let isSelected = selectedCaseID == c.id
                    let isSolved = appState.solvedCaseIDs.contains(c.id)

                    Button {
                        selectedCaseID = c.id
                        phraseInput = ""
                        verifyError = nil
                        solvedAddresses = []
                    } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text("WALLET #\(c.id)")
                                    .font(.system(size: 10, weight: .bold, design: .monospaced))
                                    .foregroundStyle(isSelected ? Theme.cyan : Theme.textMuted)

                                Spacer()

                                if isSolved {
                                    Text("CLOSED")
                                        .font(.system(size: 8, weight: .bold, design: .monospaced))
                                        .padding(.horizontal, 5)
                                        .padding(.vertical, 1)
                                        .background(Theme.green.opacity(0.2), in: Capsule())
                                        .foregroundStyle(Theme.green)
                                } else {
                                    HStack(spacing: 2) {
                                        ForEach(0..<c.difficulty, id: \.self) { _ in
                                            Circle()
                                                .fill(Theme.amber)
                                                .frame(width: 4, height: 4)
                                        }
                                    }
                                }
                            }

                            Text(c.codename)
                                .font(.system(size: 12, weight: isSelected ? .bold : .medium))
                                .foregroundStyle(isSelected ? Theme.textPrimary : Theme.textSecondary)
                                .lineLimit(1)
                        }
                        .padding(.horizontal, 8)
                        .padding(.vertical, 6)
                        .background(
                            isSelected ? Theme.purpleSoft : Color.clear,
                            in: RoundedRectangle(cornerRadius: 6)
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 6)
                                .stroke(isSelected ? Theme.borderGlow : Color.clear, lineWidth: 1)
                        )
                    }
                    .buttonStyle(.plain)
                    .listRowInsets(EdgeInsets(top: 2, leading: 6, bottom: 2, trailing: 6))
                }
                .listStyle(.plain)
            }
            .frame(minWidth: 220, idealWidth: 240, maxWidth: 280)
            .background(Theme.sidebarBg)

            // Right Pane: Active Case Dossier
            if let active = activeCase {
                let isSolved = appState.solvedCaseIDs.contains(active.id)

                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        // Header
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                HStack(spacing: 8) {
                                    Text("INVESTIGATION DOSSIER #\(active.id)")
                                        .font(.caption.monospaced().bold())
                                        .foregroundStyle(Theme.cyan)
                                    Text("· Difficulty \(active.difficulty)/5")
                                        .font(.caption2)
                                        .foregroundStyle(Theme.amber)
                                }
                                Text(active.codename)
                                    .font(.title2.bold())
                                    .foregroundStyle(Theme.textPrimary)
                            }

                            Spacer()

                            Label(isSolved ? "CLOSED" : "ACTIVE", systemImage: isSolved ? "lock.fill" : "lock.open")
                                .font(.system(size: 11, weight: .bold, design: .monospaced))
                                .padding(.horizontal, 10)
                                .padding(.vertical, 5)
                                .background(isSolved ? Theme.green.opacity(0.2) : Theme.amber.opacity(0.2), in: Capsule())
                                .foregroundStyle(isSolved ? Theme.green : Theme.amber)
                        }

                        Divider()
                            .overlay(Theme.border)

                        // Briefing Card
                        VStack(alignment: .leading, spacing: 8) {
                            Label("BRIEFING", systemImage: "text.alignleft")
                                .font(.system(size: 11, weight: .bold, design: .monospaced))
                                .foregroundStyle(Theme.purple)

                            VStack(alignment: .leading, spacing: 4) {
                                ForEach(active.brief, id: \.self) { line in
                                    Text(line)
                                        .font(.system(size: 13))
                                        .foregroundStyle(Theme.textPrimary)
                                }
                            }
                            .padding(14)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Theme.cardInner, in: RoundedRectangle(cornerRadius: 8))
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(Theme.border, lineWidth: 1))
                        }

                        // Forensic Evidence Card
                        VStack(alignment: .leading, spacing: 8) {
                            Label("FORENSIC EVIDENCE", systemImage: "magnifyingglass")
                                .font(.system(size: 11, weight: .bold, design: .monospaced))
                                .foregroundStyle(Theme.amber)

                            VStack(alignment: .leading, spacing: 6) {
                                ForEach(active.evidence, id: \.self) { fragment in
                                    Text(fragment)
                                        .font(.system(size: 12, design: .monospaced))
                                        .foregroundStyle(Theme.textPrimary)
                                        .textSelection(.enabled)
                                        .padding(.vertical, 2)
                                }
                            }
                            .padding(14)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Theme.cardInner, in: RoundedRectangle(cornerRadius: 8))
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(Theme.border, lineWidth: 1))
                        }

                        // Solution / Decrypt Box
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Label("DECRYPT SEED PHRASE", systemImage: "key.fill")
                                    .font(.system(size: 11, weight: .bold, design: .monospaced))
                                    .foregroundStyle(Theme.green)
                                Spacer()
                                if active.id == 1 && !isSolved {
                                    Button("Fill Test Vector") {
                                        phraseInput = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
                                    }
                                    .buttonStyle(.plain)
                                    .font(.caption2.monospaced())
                                    .foregroundStyle(Theme.cyan)
                                }
                            }

                            if isSolved {
                                VStack(alignment: .leading, spacing: 8) {
                                    HStack {
                                        Image(systemName: "checkmark.seal.fill")
                                            .font(.title3)
                                            .foregroundStyle(Theme.green)
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text("WALLET DRAINED & CLOSED")
                                                .font(.headline)
                                                .foregroundStyle(Theme.green)
                                            Text("Fingerprint: \(active.fingerprint)")
                                                .font(.system(size: 10, design: .monospaced))
                                                .foregroundStyle(Theme.textMuted)
                                                .lineLimit(1)
                                        }
                                    }

                                    if !solvedAddresses.isEmpty {
                                        Divider()
                                            .overlay(Theme.borderSubtle)
                                        ForEach(solvedAddresses) { addr in
                                            HStack {
                                                Text(addr.label)
                                                    .font(.caption.bold())
                                                    .foregroundStyle(Theme.textSecondary)
                                                Spacer()
                                                Text(addr.address)
                                                    .font(.system(size: 11, design: .monospaced))
                                                    .foregroundStyle(Theme.textPrimary)
                                                    .textSelection(.enabled)
                                            }
                                        }
                                    }
                                }
                                .padding(14)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(Theme.green.opacity(0.12), in: RoundedRectangle(cornerRadius: 8))
                                .overlay(RoundedRectangle(cornerRadius: 8).stroke(Theme.green.opacity(0.3), lineWidth: 1))
                            } else {
                                VStack(spacing: 10) {
                                    TextField("Enter 12-word seed phrase recovered from clues...", text: $phraseInput)
                                        .textFieldStyle(.plain)
                                        .font(.system(size: 13, design: .monospaced))
                                        .padding(10)
                                        .background(Theme.inputBg, in: RoundedRectangle(cornerRadius: 6))
                                        .overlay(RoundedRectangle(cornerRadius: 6).stroke(Theme.border, lineWidth: 1))

                                    HStack {
                                        if let err = verifyError {
                                            Text(err)
                                                .font(.caption.bold())
                                                .foregroundStyle(Theme.red)
                                        }
                                        Spacer()
                                        Button("Verify & Close Wallet") {
                                            let ok = appState.solveCase(id: active.id, phrase: phraseInput)
                                            if ok {
                                                verifyError = nil
                                                solvedAddresses = appState.core.derive(mnemonic: phraseInput)
                                            } else {
                                                verifyError = "Fingerprint check failed. Check wordlist & checksum."
                                            }
                                        }
                                        .buttonStyle(.borderedProminent)
                                    }
                                }
                                .padding(14)
                                .background(Theme.cardInner, in: RoundedRectangle(cornerRadius: 8))
                                .overlay(RoundedRectangle(cornerRadius: 8).stroke(Theme.border, lineWidth: 1))
                            }
                        }
                    }
                    .padding(20)
                }
                .background(Theme.bgDeep)
            }
        }
        .onAppear {
            if appState.campaignCases.isEmpty {
                appState.reloadGameData()
            }
        }
    }
}
