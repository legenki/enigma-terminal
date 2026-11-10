import SwiftUI

public struct SidebarView: View {
    @EnvironmentObject private var appState: AppState

    public init() {}

    public var body: some View {
        List(selection: $appState.selectedPanel) {
            ForEach(PanelCategory.allCases) { category in
                Section(category.rawValue) {
                    ForEach(AppPanel.allCases.filter { $0.category == category }) { panel in
                        HStack {
                            Label(panel.title, systemImage: panel.systemImage)
                            Spacer()
                            if let shortcut = panel.shortcutNumber {
                                Text("⌘\(shortcut)")
                                    .font(.caption2.monospaced())
                                    .foregroundStyle(.tertiary)
                            }
                        }
                        .tag(panel)
                    }
                }
            }
        }
        .listStyle(.sidebar)
        .navigationTitle("Enigma")
    }
}
