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
            .frame(minWidth: 700, minHeight: 500)
        }
        .inspector(isPresented: $appState.showInspector) {
            WordlistInspectorView()
                .inspectorColumnWidth(min: 260, ideal: 300, max: 400)
        }
        .toolbar {
            AppToolbar()
        }
    }
}
