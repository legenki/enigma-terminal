import SwiftUI

public struct ContractsBoardView: View {
    @EnvironmentObject private var appState: AppState

    @State private var selectedClientSlug: String = "escribania"
    @State private var selectedAct: Int = 1
    @State private var activeContract: ContractCase?
    @State private var solutionInput: String = ""
    @State private var solutionError: String?
    @State private var isSolvedSuccess: Bool = false

    public init() {}

    private var currentContracts: [ContractCase] {
        let list = appState.contracts.filter {
            $0.client.lowercased() == selectedClientSlug.lowercased() && $0.act == selectedAct
        }
        if list.isEmpty {
            return appState.core.loadContracts(clientSlug: selectedClientSlug, act: selectedAct, lang: appState.selectedLanguage.lowercased())
        }
        return list
    }

    private var activeClient: ClientInfo {
        if let found = appState.clients.first(where: { $0.slug == selectedClientSlug }) {
            return found
        }
        return ClientInfo(slug: "escribania", name: "ESCRIBANÍA CERO", district: "Microcentro, La City", kind: "private forensic bureau")
    }

    public var body: some View {
        VStack(spacing: 0) {
            // 1. Employer Selector (Clean Horizontal Scroll of Cards)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(appState.clients) { client in
                        clientChip(client)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
            }
            .background(Theme.sidebarBg.opacity(0.8))

            Divider()
                .overlay(Theme.border)

            // 2. Phase Navigation Bar (Custom Dark Pills, no clashing blue!)
            HStack(spacing: 8) {
                Text("PHASE:")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(Theme.textMuted)

                ForEach(1...4, id: \.self) { act in
                    let isSelected = selectedAct == act
                    Button {
                        selectedAct = act
                    } label: {
                        Text(actTitle(act))
                            .font(.system(size: 11, weight: isSelected ? .semibold : .regular))
                            .foregroundStyle(isSelected ? Theme.purple : Theme.textSecondary)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 5)
                            .background(
                                isSelected ? Theme.purpleSoft : Color.white.opacity(0.04),
                                in: RoundedRectangle(cornerRadius: 6)
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: 6)
                                    .stroke(isSelected ? Theme.borderGlow : Color.clear, lineWidth: 1)
                            )
                    }
                    .buttonStyle(.plain)
                }

                Spacer()

                // Client Summary Tag
                HStack(spacing: 6) {
                    Image(systemName: "mappin.circle.fill")
                        .font(.caption2)
                        .foregroundStyle(Theme.cyan)
                    Text(activeClient.district)
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundStyle(Theme.textSecondary)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .background(Theme.cardBg)

            Divider()
                .overlay(Theme.borderSubtle)

            // 3. Contracts Grid Area
            ScrollView {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 260, maximum: 340), spacing: 14)], spacing: 14) {
                    ForEach(currentContracts) { contract in
                        contractCard(contract)
                    }
                }
                .padding(16)
            }
            .background(Theme.cardInner)
        }
        .onAppear {
            if appState.clients.isEmpty {
                appState.reloadGameData()
            }
        }
        .sheet(item: $activeContract) { contract in
            contractDossierSheet(contract)
        }
    }

    private func actTitle(_ act: Int) -> String {
        switch act {
        case 1: return "Phase I (1-8)"
        case 2: return "Phase II (9-16)"
        case 3: return "Phase III (17-24)"
        default: return "Phase IV (25-32)"
        }
    }

    // MARK: - Client Chip

    private func clientChip(_ client: ClientInfo) -> some View {
        let isSelected = selectedClientSlug == client.slug
        return Button {
            selectedClientSlug = client.slug
        } label: {
            HStack(spacing: 8) {
                ZStack {
                    RoundedRectangle(cornerRadius: 6)
                        .fill(isSelected ? Theme.purple : Color.white.opacity(0.06))
                        .frame(width: 24, height: 24)
                    Text(String(client.name.prefix(2)))
                        .font(.system(size: 9, weight: .bold, design: .monospaced))
                        .foregroundStyle(isSelected ? Color.white : Theme.textSecondary)
                }

                VStack(alignment: .leading, spacing: 1) {
                    Text(client.name)
                        .font(.system(size: 11, weight: isSelected ? .bold : .medium))
                        .foregroundStyle(isSelected ? Theme.textPrimary : Theme.textSecondary)
                        .lineLimit(1)
                    Text(client.district)
                        .font(.system(size: 9))
                        .foregroundStyle(Theme.textMuted)
                        .lineLimit(1)
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(
                isSelected ? Theme.purpleSoft : Color.white.opacity(0.03),
                in: RoundedRectangle(cornerRadius: 8)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(isSelected ? Theme.borderGlow : Theme.border, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Contract Card

    private func contractCard(_ contract: ContractCase) -> some View {
        let isSolved = appState.solvedContractIDs.contains(contract.id)

        return VStack(alignment: .leading, spacing: 10) {
            // Header
            HStack {
                Text("#\(contract.id)")
                    .font(.caption.monospaced().bold())
                    .foregroundStyle(Theme.cyan)

                Text("· Phase \(contract.act)")
                    .font(.caption2.monospaced())
                    .foregroundStyle(Theme.textMuted)

                Spacer()

                Text(isSolved ? "SOLVED" : "AVAILABLE")
                    .font(.system(size: 9, weight: .bold, design: .monospaced))
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(
                        isSolved ? Theme.green.opacity(0.2) : Color.white.opacity(0.06),
                        in: Capsule()
                    )
                    .foregroundStyle(isSolved ? Theme.green : Theme.textMuted)
            }

            // Codename
            Text(contract.codename)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.textPrimary)
                .lineLimit(1)

            // Archetype / Scheme tag
            HStack {
                Image(systemName: "puzzlepiece.fill")
                    .font(.system(size: 9))
                Text(contract.archetype.replacingOccurrences(of: "_", with: " ").capitalized)
                    .font(.system(size: 10, design: .monospaced))
            }
            .foregroundStyle(Theme.purple)

            // Brief summary
            if let firstLine = contract.brief.first {
                Text(firstLine)
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.textSecondary)
                    .lineLimit(2)
            }

            Spacer()

            // Action Button
            Button {
                solutionInput = ""
                solutionError = nil
                isSolvedSuccess = appState.solvedContractIDs.contains(contract.id)
                activeContract = contract
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "doc.text.magnifyingglass")
                    Text("Open Dossier")
                }
                .font(.system(size: 11, weight: .medium))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 6)
                .background(Theme.purpleSoft, in: RoundedRectangle(cornerRadius: 6))
                .overlay(RoundedRectangle(cornerRadius: 6).stroke(Theme.borderGlow, lineWidth: 1))
                .foregroundStyle(Theme.purple)
            }
            .buttonStyle(.plain)
        }
        .padding(14)
        .background(Theme.cardBg)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(isSolved ? Theme.green.opacity(0.4) : Theme.border, lineWidth: 1)
        )
    }

    // MARK: - Interactive Dossier Sheet (Real content & solving!)

    private func contractDossierSheet(_ contract: ContractCase) -> some View {
        VStack(spacing: 0) {
            // Sheet Header
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 8) {
                        Text("CONTRACT #\(contract.id)")
                            .font(.caption.monospaced().bold())
                            .foregroundStyle(Theme.cyan)
                        Text("· \(contract.client.uppercased())")
                            .font(.caption2.bold())
                            .foregroundStyle(Theme.purple)
                    }
                    Text(contract.codename)
                        .font(.title3.bold())
                        .foregroundStyle(Theme.textPrimary)
                }

                Spacer()

                Button {
                    activeContract = nil
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.title2)
                        .foregroundStyle(Theme.textMuted)
                }
                .buttonStyle(.plain)
            }
            .padding(20)
            .background(Theme.cardBg)

            Divider()
                .overlay(Theme.border)

            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    // Briefing Section
                    VStack(alignment: .leading, spacing: 8) {
                        Label("BRIEFING & BACKGROUND", systemImage: "info.circle.fill")
                            .font(.system(size: 11, weight: .bold, design: .monospaced))
                            .foregroundStyle(Theme.cyan)

                        VStack(alignment: .leading, spacing: 4) {
                            ForEach(contract.brief, id: \.self) { line in
                                Text(line)
                                    .font(.system(size: 13))
                                    .foregroundStyle(Theme.textPrimary)
                            }
                        }
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Theme.cardInner, in: RoundedRectangle(cornerRadius: 8))
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Theme.border, lineWidth: 1))
                    }

                    // Clues & Evidence Section
                    VStack(alignment: .leading, spacing: 8) {
                        Label("FORENSIC EVIDENCE & CLUES", systemImage: "magnifyingglass")
                            .font(.system(size: 11, weight: .bold, design: .monospaced))
                            .foregroundStyle(Theme.amber)

                        VStack(alignment: .leading, spacing: 6) {
                            ForEach(contract.evidence, id: \.self) { clue in
                                HStack(alignment: .top, spacing: 8) {
                                    Text("›")
                                        .foregroundStyle(Theme.amber)
                                    Text(clue)
                                        .font(.system(size: 12, design: .monospaced))
                                        .foregroundStyle(Theme.textPrimary)
                                        .textSelection(.enabled)
                                }
                            }
                        }
                        .padding(14)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Theme.cardInner, in: RoundedRectangle(cornerRadius: 8))
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Theme.border, lineWidth: 1))
                    }

                    // Decrypt & Verification Box
                    VStack(alignment: .leading, spacing: 10) {
                        Label("DECRYPT & FILE CONTRACT", systemImage: "lock.shield.fill")
                            .font(.system(size: 11, weight: .bold, design: .monospaced))
                            .foregroundStyle(Theme.green)

                        if isSolvedSuccess {
                            HStack {
                                Image(systemName: "checkmark.seal.fill")
                                    .font(.title2)
                                    .foregroundStyle(Theme.green)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("CONTRACT SOLVED & CLOSED")
                                        .font(.headline)
                                        .foregroundStyle(Theme.green)
                                    Text("Fingerprint verified against the Bitcoin network.")
                                        .font(.caption)
                                        .foregroundStyle(Theme.textSecondary)
                                }
                            }
                            .padding(12)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Theme.green.opacity(0.12), in: RoundedRectangle(cornerRadius: 8))
                        } else {
                            VStack(spacing: 10) {
                                TextField("Enter 12-word recovery seed phrase or hex solution...", text: $solutionInput)
                                    .textFieldStyle(.plain)
                                    .font(.system(size: 13, design: .monospaced))
                                    .padding(10)
                                    .background(Theme.inputBg, in: RoundedRectangle(cornerRadius: 6))
                                    .overlay(RoundedRectangle(cornerRadius: 6).stroke(Theme.border, lineWidth: 1))

                                HStack {
                                    if let err = solutionError {
                                        Text(err)
                                            .font(.caption.bold())
                                            .foregroundStyle(Theme.red)
                                    }
                                    Spacer()
                                    Button("Verify & Solve") {
                                        let solved = appState.solveContract(id: contract.id, phrase: solutionInput)
                                        if solved {
                                            isSolvedSuccess = true
                                            solutionError = nil
                                        } else {
                                            solutionError = "Fingerprint mismatch. Check clue handwriting."
                                        }
                                    }
                                    .buttonStyle(.borderedProminent)
                                }
                            }
                            .padding(12)
                            .background(Theme.cardInner, in: RoundedRectangle(cornerRadius: 8))
                        }
                    }
                }
                .padding(20)
            }
            .background(Theme.bgDeep)
        }
        .frame(minWidth: 540, minHeight: 480)
    }
}
