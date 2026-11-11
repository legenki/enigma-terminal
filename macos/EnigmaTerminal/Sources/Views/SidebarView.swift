import SwiftUI

public struct SidebarView: View {
    @EnvironmentObject private var appState: AppState

    public init() {}

    private var theme: AppTheme { appState.theme }

    public var body: some View {
        List(selection: $appState.selectedPanel) {
            Section(appState.t("projects")) {
                sidebarRow(panel: .terminal, badge: nil)
                sidebarRow(panel: .cases, badge: "\(appState.solvedCaseIDs.count)/8")
                sidebarRow(panel: .contracts, badge: "\(appState.solvedContractIDs.count)/256")
                sidebarRow(panel: .acta, badge: nil)
            }

            Section(appState.t("crypto")) {
                sidebarRow(panel: .decrypt, badge: nil)
                sidebarRow(panel: .ledger, badge: nil)
                sidebarRow(panel: .explorer, badge: "#\(appState.blockHeight)")
                sidebarRow(panel: .randomizer, badge: nil)
                sidebarRow(panel: .nameforge, badge: nil)
            }

            Section(appState.t("investigation")) {
                sidebarRow(panel: .journal, badge: "\(appState.journal.count)")
                sidebarRow(panel: .about, badge: nil)
            }
        }
        .listStyle(.sidebar)
        .navigationTitle("Enigma")
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func sidebarRow(panel: AppPanel, badge: String?) -> some View {
        HStack(spacing: 8) {
            Image(systemName: panel.systemImage)
                .font(.system(size: 13))
                .foregroundStyle(iconColor(for: panel))
                .frame(width: 20, alignment: .center)

            Text(appState.t(panel.rawValue))
                .font(.system(size: 13))
                .foregroundStyle(theme.textPrimary)

            Spacer()

            if let b = badge {
                Text(b)
                    .font(.caption2.monospaced())
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.secondary.opacity(0.12), in: Capsule())
                    .foregroundStyle(theme.textSecondary)
            }

            if let shortcut = panel.shortcutNumber {
                Text("⌘\(shortcut)")
                    .font(.caption2.monospaced())
                    .foregroundStyle(theme.textMuted)
            }
        }
        .padding(.vertical, 3)
        .tag(panel)
    }

    private func iconColor(for panel: AppPanel) -> Color {
        switch panel {
        case .terminal: return theme.purple
        case .cases: return Color.blue
        case .contracts: return Color.orange
        case .acta: return Color.pink
        case .decrypt: return theme.cyan
        case .ledger: return theme.green
        case .explorer: return Color.indigo
        case .randomizer: return Color.teal
        case .nameforge: return Color.yellow
        case .archive: return theme.purple
        case .journal: return Color.mint
        case .about: return theme.textSecondary
        }
    }
}
