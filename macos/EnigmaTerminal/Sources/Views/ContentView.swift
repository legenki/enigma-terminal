import SwiftUI

public struct ContentView: View {
    @EnvironmentObject private var appState: AppState

    public init() {}

    public var body: some View {
        NavigationSplitView {
            SidebarView()
        } detail: {
            ZStack {
                Theme.backgroundGradient
                    .ignoresSafeArea()

                Group {
                    switch appState.selectedPanel {
                    case .terminal:
                        TerminalView()
                    case .cases, .acta:
                        cardWrapper(title: "Case Files & Briefings") {
                            CaseFilesView()
                        }
                    case .contracts:
                        cardWrapper(title: "Contracts Matrix (256 Tasks)") {
                            ContractsBoardView()
                        }
                    case .decrypt, .ledger:
                        cardWrapper(title: "Cryptographic Key Derivation") {
                            DecryptView()
                        }
                    case .explorer:
                        cardWrapper(title: "Bitcoin Blockchain Explorer") {
                            ExplorerView()
                        }
                    case .randomizer:
                        cardWrapper(title: "CSPRNG Entropy Generator") {
                            RandomizerView()
                        }
                    case .nameforge:
                        cardWrapper(title: "Nameforge Vanity Generator") {
                            NameforgeView()
                        }
                    case .archive, .journal:
                        cardWrapper(title: "Investigation Audit Journal") {
                            JournalView()
                        }
                    case .about:
                        cardWrapper(title: "About Enigma Terminal") {
                            AboutView()
                        }
                    }
                }
            }
            .navigationTitle("")
            .frame(minWidth: 700, minHeight: 500)
        }
        .inspector(isPresented: $appState.showInspector) {
            WordlistInspectorView()
                .inspectorColumnWidth(min: 260, ideal: 300, max: 360)
        }
        .toolbar {
            AppToolbar()
        }
        .background(Theme.bgDeep)
    }

    private func cardWrapper<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(spacing: 0) {
            HStack {
                HStack(spacing: 6) {
                    Circle()
                        .fill(Theme.purple)
                        .frame(width: 8, height: 8)
                    Text(title)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Theme.textPrimary)
                }
                Spacer()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(Theme.cardBg)

            Divider()
                .overlay(Theme.border)

            content()
        }
        .background(Theme.cardBg)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(Theme.border, lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(0.35), radius: 12, x: 0, y: 6)
        .padding(16)
    }
}
