import SwiftUI

public struct ContentView: View {
    @EnvironmentObject private var appState: AppState

    public init() {}

    private var theme: AppTheme { appState.theme }

    public var body: some View {
        NavigationSplitView {
            SidebarView()
                .navigationSplitViewColumnWidth(min: 220, ideal: 250, max: 320)
        } detail: {
            ZStack {
                theme.backgroundGradient
                    .ignoresSafeArea()

                Group {
                    switch appState.selectedPanel {
                    case .terminal:
                        TerminalView()
                    case .cases, .acta:
                        cardWrapper(title: appState.t("cardCases")) {
                            CaseFilesView()
                        }
                    case .contracts:
                        cardWrapper(title: appState.t("cardContracts")) {
                            ContractsBoardView()
                        }
                    case .decrypt, .ledger:
                        cardWrapper(title: appState.t("cardDecrypt")) {
                            DecryptView()
                        }
                    case .explorer:
                        cardWrapper(title: appState.t("cardExplorer")) {
                            ExplorerView()
                        }
                    case .randomizer:
                        cardWrapper(title: appState.t("cardRandomizer")) {
                            RandomizerView()
                        }
                    case .nameforge:
                        cardWrapper(title: appState.t("cardNameforge")) {
                            NameforgeView()
                        }
                    case .archive, .journal:
                        cardWrapper(title: appState.t("cardJournal")) {
                            JournalView()
                        }
                    case .about:
                        cardWrapper(title: appState.t("cardAbout")) {
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
        .background(theme.bgDeep)
    }

    private func cardWrapper<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(spacing: 0) {
            HStack {
                HStack(spacing: 6) {
                    Circle()
                        .fill(theme.purple)
                        .frame(width: 8, height: 8)
                    Text(title)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(theme.textPrimary)
                }
                Spacer()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(theme.cardBg)

            Divider()
                .overlay(theme.border)

            content()
        }
        .background(theme.cardBg)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(theme.border, lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(theme.isLight ? 0.08 : 0.35), radius: 12, x: 0, y: 6)
        .padding(16)
    }
}
