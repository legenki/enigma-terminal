import SwiftUI

public struct CaseFilesView: View {
    @EnvironmentObject private var appState: AppState

    @State private var selectedCaseID: Int = 1
    @State private var phraseInput: String = ""
    @State private var verifyError: String?
    @State private var solvedAddresses: [DerivedAddress] = []

    public init() {}

    private var theme: AppTheme { appState.theme }

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
                    Text(appState.t("campaignActs"))
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(theme.textMuted)
                    Spacer()
                    Text("\(appState.solvedCaseIDs.count)/\(currentCases.count) \(appState.t("closed"))")
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundStyle(theme.green)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(theme.sidebarBg)

                Divider()
                    .overlay(theme.border)

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
                                    .foregroundStyle(isSelected ? theme.cyan : theme.textMuted)

                                Spacer()

                                if isSolved {
                                    Text(appState.t("closed").uppercased())
                                        .font(.system(size: 8, weight: .bold, design: .monospaced))
                                        .padding(.horizontal, 5)
                                        .padding(.vertical, 1)
                                        .background(theme.green.opacity(0.2), in: Capsule())
                                        .foregroundStyle(theme.green)
                                } else {
                                    HStack(spacing: 2) {
                                        ForEach(0..<c.difficulty, id: \.self) { _ in
                                            Circle()
                                                .fill(theme.amber)
                                                .frame(width: 4, height: 4)
                                        }
                                    }
                                }
                            }

                            Text(c.codename)
                                .font(.system(size: 12, weight: isSelected ? .bold : .medium))
                                .foregroundStyle(isSelected ? theme.textPrimary : theme.textSecondary)
                                .lineLimit(1)
                        }
                        .padding(.horizontal, 8)
                        .padding(.vertical, 6)
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
                    .listRowInsets(EdgeInsets(top: 2, leading: 6, bottom: 2, trailing: 6))
                }
                .listStyle(.plain)
            }
            .frame(minWidth: 220, idealWidth: 240, maxWidth: 280)
            .background(theme.sidebarBg)

            // Right Pane: Active Case Dossier
            if let active = activeCase {
                let isSolved = appState.solvedCaseIDs.contains(active.id)

                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        // Header
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                HStack(spacing: 8) {
                                    Text("DOSSIER #\(active.id)")
                                        .font(.caption.monospaced().bold())
                                        .foregroundStyle(theme.cyan)
                                    Text("· \(appState.t("difficulty")) \(active.difficulty)/5")
                                        .font(.caption2)
                                        .foregroundStyle(theme.amber)
                                }
                                Text(active.codename)
                                    .font(.title2.bold())
                                    .foregroundStyle(theme.textPrimary)
                            }

                            Spacer()

                            Label(isSolved ? appState.t("closed").uppercased() : appState.t("active"), systemImage: isSolved ? "lock.fill" : "lock.open")
                                .font(.system(size: 11, weight: .bold, design: .monospaced))
                                .padding(.horizontal, 10)
                                .padding(.vertical, 5)
                                .background(isSolved ? theme.green.opacity(0.2) : theme.amber.opacity(0.2), in: Capsule())
                                .foregroundStyle(isSolved ? theme.green : theme.amber)
                        }

                        Divider()
                            .overlay(theme.border)

                        // Briefing Card
                        VStack(alignment: .leading, spacing: 8) {
                            Label(appState.t("briefing"), systemImage: "text.alignleft")
                                .font(.system(size: 11, weight: .bold, design: .monospaced))
                                .foregroundStyle(theme.purple)

                            VStack(alignment: .leading, spacing: 4) {
                                ForEach(active.brief, id: \.self) { line in
                                    Text(line)
                                        .font(.system(size: 13))
                                        .foregroundStyle(theme.textPrimary)
                                }
                            }
                            .padding(14)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(theme.cardInner, in: RoundedRectangle(cornerRadius: 8))
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(theme.border, lineWidth: 1))
                        }

                        // Forensic Evidence Card
                        VStack(alignment: .leading, spacing: 8) {
                            Label(appState.t("evidence"), systemImage: "magnifyingglass")
                                .font(.system(size: 11, weight: .bold, design: .monospaced))
                                .foregroundStyle(theme.amber)

                            VStack(alignment: .leading, spacing: 6) {
                                ForEach(active.evidence, id: \.self) { fragment in
                                    Text(fragment)
                                        .font(.system(size: 12, design: .monospaced))
                                        .foregroundStyle(theme.textPrimary)
                                        .textSelection(.enabled)
                                        .padding(.vertical, 2)
                                }
                            }
                            .padding(14)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(theme.cardInner, in: RoundedRectangle(cornerRadius: 8))
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(theme.border, lineWidth: 1))
                        }

                        // Solution / Decrypt Box
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Label("BIP-39 / BIP-32", systemImage: "key.fill")
                                    .font(.system(size: 11, weight: .bold, design: .monospaced))
                                    .foregroundStyle(theme.green)
                                Spacer()
                                if active.id == 1 && !isSolved {
                                    Button(appState.t("fillTestVector")) {
                                        phraseInput = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
                                    }
                                    .buttonStyle(.plain)
                                    .font(.caption2.monospaced())
                                    .foregroundStyle(theme.cyan)
                                }
                            }

                            if isSolved {
                                VStack(alignment: .leading, spacing: 8) {
                                    HStack {
                                        Image(systemName: "checkmark.seal.fill")
                                            .font(.title3)
                                            .foregroundStyle(theme.green)
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(appState.t("walletDrained"))
                                                .font(.headline)
                                                .foregroundStyle(theme.green)
                                            Text("Fingerprint: \(active.fingerprint)")
                                                .font(.system(size: 10, design: .monospaced))
                                                .foregroundStyle(theme.textMuted)
                                                .lineLimit(1)
                                        }
                                    }

                                    if !solvedAddresses.isEmpty {
                                        Divider()
                                            .overlay(theme.borderSubtle)
                                        ForEach(solvedAddresses) { addr in
                                            HStack {
                                                Text(addr.label)
                                                    .font(.caption.bold())
                                                    .foregroundStyle(theme.textSecondary)
                                                Spacer()
                                                Text(addr.address)
                                                    .font(.system(size: 11, design: .monospaced))
                                                    .foregroundStyle(theme.textPrimary)
                                                    .textSelection(.enabled)
                                            }
                                        }
                                    }
                                }
                                .padding(14)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(theme.green.opacity(0.12), in: RoundedRectangle(cornerRadius: 8))
                                .overlay(RoundedRectangle(cornerRadius: 8).stroke(theme.green.opacity(0.3), lineWidth: 1))
                            } else {
                                VStack(spacing: 10) {
                                    TextField(appState.selectedLanguage == "RU" ? "Введите 12 слов найденной мнемоники..." : "Enter 12-word seed phrase recovered from clues...", text: $phraseInput)
                                        .textFieldStyle(.plain)
                                        .font(.system(size: 13, design: .monospaced))
                                        .padding(10)
                                        .background(theme.inputBg, in: RoundedRectangle(cornerRadius: 6))
                                        .overlay(RoundedRectangle(cornerRadius: 6).stroke(theme.border, lineWidth: 1))

                                    HStack {
                                        if let err = verifyError {
                                            Text(err)
                                                .font(.caption.bold())
                                                .foregroundStyle(theme.red)
                                        }
                                        Spacer()
                                        Button(appState.t("verifyClose")) {
                                            let ok = appState.solveCase(id: active.id, phrase: phraseInput)
                                            if ok {
                                                verifyError = nil
                                                solvedAddresses = appState.core.derive(mnemonic: phraseInput)
                                            } else {
                                                verifyError = appState.selectedLanguage == "RU" ? "Неверная контрольная сумма или фингерпринт" : "Fingerprint check failed. Check wordlist & checksum."
                                            }
                                        }
                                        .buttonStyle(.borderedProminent)
                                    }
                                }
                                .padding(14)
                                .background(theme.cardInner, in: RoundedRectangle(cornerRadius: 8))
                                .overlay(RoundedRectangle(cornerRadius: 8).stroke(theme.border, lineWidth: 1))
                            }
                        }
                    }
                    .padding(20)
                }
                .background(theme.bgDeep)
            }
        }
        .onAppear {
            if appState.campaignCases.isEmpty {
                appState.reloadGameData()
            }
        }
    }
}
