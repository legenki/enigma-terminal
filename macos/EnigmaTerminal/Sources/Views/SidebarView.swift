import SwiftUI

public struct SidebarView: View {
    @EnvironmentObject private var appState: AppState

    public init() {}

    private var theme: AppTheme { appState.theme }

    public var body: some View {
        VStack(spacing: 0) {
            // Top Workspace Header
            HStack(spacing: 8) {
                Image(systemName: "star")
                    .font(.caption)
                    .foregroundStyle(theme.textSecondary)
                Text("Enigma Terminal")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(theme.textPrimary)
                Spacer()
                Image(systemName: "chevron.up.chevron.down")
                    .font(.caption2)
                    .foregroundStyle(theme.textMuted)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)

            Divider()
                .overlay(theme.border)

            // Scrollable Navigation Items
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    sectionView(title: appState.t("projects")) {
                        sidebarRow(
                            panel: .terminal,
                            avatarText: ">_",
                            avatarColor: theme.purple,
                            title: appState.t("terminal"),
                            subtitle: appState.t("terminalSub"),
                            badge: "v3.1"
                        )
                        sidebarRow(
                            panel: .cases,
                            avatarText: "CF",
                            avatarColor: Color.blue,
                            title: appState.t("cases"),
                            subtitle: appState.t("casesSub"),
                            badge: "\(appState.solvedCaseIDs.count)/8"
                        )
                        sidebarRow(
                            panel: .contracts,
                            avatarText: "CB",
                            avatarColor: Color.orange,
                            title: appState.t("contracts"),
                            subtitle: appState.t("contractsSub"),
                            badge: "\(appState.solvedContractIDs.count)/256"
                        )
                        sidebarRow(
                            panel: .acta,
                            avatarText: "AC",
                            avatarColor: Color.pink,
                            title: appState.t("acta"),
                            subtitle: appState.t("actaSub"),
                            badge: nil
                        )
                    }

                    sectionView(title: appState.t("crypto")) {
                        sidebarRow(
                            panel: .decrypt,
                            avatarText: "DC",
                            avatarColor: theme.cyan,
                            title: appState.t("decrypt"),
                            subtitle: appState.t("decryptSub"),
                            badge: "3 addrs"
                        )
                        sidebarRow(
                            panel: .ledger,
                            avatarText: "LD",
                            avatarColor: theme.green,
                            title: appState.t("ledger"),
                            subtitle: appState.t("ledgerSub"),
                            badge: nil
                        )
                        sidebarRow(
                            panel: .explorer,
                            avatarText: "EX",
                            avatarColor: Color.indigo,
                            title: appState.t("explorer"),
                            subtitle: appState.t("explorerSub"),
                            badge: "#\(appState.blockHeight)"
                        )
                        sidebarRow(
                            panel: .randomizer,
                            avatarText: "RN",
                            avatarColor: Color.teal,
                            title: appState.t("randomizer"),
                            subtitle: appState.t("randomizerSub"),
                            badge: nil
                        )
                        sidebarRow(
                            panel: .nameforge,
                            avatarText: "NF",
                            avatarColor: Color.yellow,
                            title: appState.t("nameforge"),
                            subtitle: appState.t("nameforgeSub"),
                            badge: nil
                        )
                    }

                    sectionView(title: appState.t("investigation")) {
                        sidebarRow(
                            panel: .journal,
                            avatarText: "JN",
                            avatarColor: Color.mint,
                            title: appState.t("journal"),
                            subtitle: "\(appState.journal.count) \(appState.t("journalSub"))",
                            badge: "\(appState.journal.count)"
                        )
                        sidebarRow(
                            panel: .about,
                            avatarText: "ET",
                            avatarColor: theme.purple,
                            title: appState.t("about"),
                            subtitle: appState.t("aboutSub"),
                            badge: nil
                        )
                    }
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 10)
            }

            Divider()
                .overlay(theme.border)

            // Bottom Status / Git Branch Footer
            HStack(spacing: 8) {
                Image(systemName: "point.filled.topleft.down.curvedto.point.bottomright.up")
                    .font(.caption2)
                    .foregroundStyle(theme.purple)
                Text("main")
                    .font(.caption.monospaced())
                    .foregroundStyle(theme.textSecondary)

                Spacer()

                Button {
                    appState.showInspector.toggle()
                } label: {
                    Image(systemName: "sidebar.trailing")
                        .font(.caption)
                }
                .buttonStyle(.plain)
                .foregroundStyle(theme.textSecondary)
                .help(appState.t("toggleInspector"))
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(theme.sidebarBg)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(theme.sidebarBg)
    }

    private func sectionView<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(title)
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(theme.textMuted)
                Spacer()
                Image(systemName: "plus")
                    .font(.system(size: 10))
                    .foregroundStyle(theme.textMuted)
            }
            .padding(.horizontal, 8)
            .padding(.bottom, 2)

            content()
        }
    }

    private func sidebarRow(
        panel: AppPanel,
        avatarText: String,
        avatarColor: Color,
        title: String,
        subtitle: String,
        badge: String?
    ) -> some View {
        let isSelected = appState.selectedPanel == panel

        return Button {
            appState.selectedPanel = panel
        } label: {
            HStack(spacing: 9) {
                // Avatar badge
                ZStack {
                    RoundedRectangle(cornerRadius: 6)
                        .fill(avatarColor.opacity(isSelected ? 0.3 : 0.15))
                        .frame(width: 26, height: 26)
                        .overlay(
                            RoundedRectangle(cornerRadius: 6)
                                .stroke(avatarColor.opacity(isSelected ? 0.8 : 0.3), lineWidth: 1)
                        )
                    Text(avatarText)
                        .font(.system(size: 10, weight: .bold, design: .monospaced))
                        .foregroundStyle(avatarColor)
                }

                // Titles & Subtitles
                VStack(alignment: .leading, spacing: 1) {
                    Text(title)
                        .font(.system(size: 12, weight: isSelected ? .semibold : .medium))
                        .foregroundStyle(isSelected ? theme.textPrimary : theme.textSecondary)
                        .lineLimit(1)
                    Text(subtitle)
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundStyle(theme.textMuted)
                        .lineLimit(1)
                }

                Spacer()

                // Trailing badge
                if let b = badge {
                    Text(b)
                        .font(.system(size: 9, weight: .bold, design: .monospaced))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(
                            isSelected ? theme.purple.opacity(0.25) : Color.white.opacity(0.06),
                            in: Capsule()
                        )
                        .foregroundStyle(isSelected ? theme.purple : theme.textMuted)
                }
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 6)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(isSelected ? theme.purpleSoft : Color.clear)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(isSelected ? theme.borderGlow : Color.clear, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}
