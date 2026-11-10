import SwiftUI

public struct ContentView: View {
    @EnvironmentObject private var appState: AppState

    public init() {}

    public var body: some View {
        NavigationSplitView {
            SidebarView()
        } detail: {
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
            .navigationTitle(appState.selectedPanel.title)
        }
        .inspector(isPresented: $appState.showInspector) {
            WordlistInspectorView()
        }
        .toolbar {
            AppToolbar()
        }
        .frame(minWidth: 960, minHeight: 640)
    }
}
