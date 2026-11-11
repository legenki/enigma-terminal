import SwiftUI

public struct ContentView: View {
    @EnvironmentObject private var appState: AppState

    public init() {}

    private var theme: AppTheme { appState.theme }

    public var body: some View {
        NavigationSplitView {
            SidebarView()
                .navigationSplitViewColumnWidth(min: 210, ideal: 240, max: 280)
        } detail: {
            VStack(spacing: 0) {
                // Header Bar (Document View Title)
                HStack(spacing: 8) {
                    Image(systemName: appState.selectedPanel.systemImage)
                        .font(.headline)
                        .foregroundStyle(theme.purple)
                    Text(appState.t(appState.selectedPanel.rawValue))
                        .font(.title3.bold())
                        .foregroundStyle(theme.textPrimary)
                    Spacer()
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
                .background(theme.cardBg)

                Divider()
                    .overlay(theme.border)

                // Main Detail Content Area (Clean Edge-to-Edge)
                Group {
                    switch appState.selectedPanel {
                    case .terminal:
                        TerminalView()
                    case .cases, .acta:
                        CaseFilesView()
                    case .contracts:
                        ContractsBoardView()
                    case .decrypt, .ledger:
                        DecryptView()
                    case .explorer:
                        ExplorerView()
                    case .randomizer:
                        RandomizerView()
                    case .nameforge:
                        NameforgeView()
                    case .archive, .journal:
                        JournalView()
                    case .about:
                        AboutView()
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .frame(minWidth: 700, minHeight: 500)
            .background(theme.bgDeep)
        }
        .inspector(isPresented: $appState.showInspector) {
            WordlistInspectorView()
                .inspectorColumnWidth(min: 260, ideal: 300, max: 360)
        }
        .toolbar {
            AppToolbar()
        }
    }
}
