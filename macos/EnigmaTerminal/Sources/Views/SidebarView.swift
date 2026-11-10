import SwiftUI

public struct SidebarView: View {
    @EnvironmentObject private var appState: AppState

    public init() {}

    public var body: some View {
        VStack(spacing: 0) {
            // Top Workspace Header
            HStack(spacing: 8) {
                Image(systemName: "star")
                    .font(.caption)
                    .foregroundStyle(Theme.textSecondary)
                Text("Enigma Terminal")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.textPrimary)
                Spacer()
                Image(systemName: "chevron.up.chevron.down")
                    .font(.caption2)
                    .foregroundStyle(Theme.textMuted)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)

            Divider()
                .overlay(Theme.border)

            // Scrollable Navigation Items
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    sectionView(title: "PROJECTS / WORKSPACE") {
                        sidebarRow(
                            panel: .terminal,
                            avatarText: ">_",
                            avatarColor: Theme.purple,
                            title: "enigma-terminal",
                            subtitle: "main ★ · live feed",
                            badge: "v3.1"
                        )
                        sidebarRow(
                            panel: .cases,
                            avatarText: "CF",
                            avatarColor: Color.blue,
                            title: "Case Files",
                            subtitle: "Act 1 & 2 · 4 active",
                            badge: "4"
                        )
                        sidebarRow(
                            panel: .contracts,
                            avatarText: "CB",
                            avatarColor: Color.orange,
                            title: "Contracts Board",
                            subtitle: "8 employers · 256 jobs",
                            badge: "256"
                        )
                        sidebarRow(
                            panel: .acta,
                            avatarText: "AC",
                            avatarColor: Color.pink,
                            title: "Acta Records",
                            subtitle: "Caja book · wet papers",
                            badge: nil
                        )
                    }

                    sectionView(title: "CRYPTOGRAPHY") {
                        sidebarRow(
                            panel: .decrypt,
                            avatarText: "DC",
                            avatarColor: Theme.cyan,
                            title: "Decrypt & Derive",
                            subtitle: "BIP-39 / BIP-32 / secp",
                            badge: "3 addrs"
                        )
                        sidebarRow(
                            panel: .ledger,
                            avatarText: "LD",
                            avatarColor: Theme.green,
                            title: "Ledger Sync",
                            subtitle: "UTXO & balance probes",
                            badge: nil
                        )
                        sidebarRow(
                            panel: .explorer,
                            avatarText: "EX",
                            avatarColor: Color.indigo,
                            title: "Live Explorer",
                            subtitle: "#\(appState.blockHeight) · mempool",
                            badge: "live"
                        )
                        sidebarRow(
                            panel: .randomizer,
                            avatarText: "RN",
                            avatarColor: Color.teal,
                            title: "Randomizer",
                            subtitle: "CSPRNG entropy rolls",
                            badge: nil
                        )
                        sidebarRow(
                            panel: .nameforge,
                            avatarText: "NF",
                            avatarColor: Color.yellow,
                            title: "Nameforge",
                            subtitle: "1<Name> vanity stamps",
                            badge: nil
                        )
                    }

                    sectionView(title: "INVESTIGATION") {
                        sidebarRow(
                            panel: .journal,
                            avatarText: "JN",
                            avatarColor: Color.mint,
                            title: "Audit Journal",
                            subtitle: "\(appState.journal.count) entries recorded",
                            badge: "\(appState.journal.count)"
                        )
                        sidebarRow(
                            panel: .about,
                            avatarText: "ET",
                            avatarColor: Theme.purple,
                            title: "System & About",
                            subtitle: "macOS 26 Native HIG",
                            badge: nil
                        )
                    }
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 12)
            }

            Divider()
                .overlay(Theme.border)

            // Bottom Status / Git Branch Footer (matching screenshot)
            HStack(spacing: 8) {
                Image(systemName: "point.filled.topleft.down.curvedto.point.bottomright.up")
                    .font(.caption2)
                    .foregroundStyle(Theme.purple)
                Text("main")
                    .font(.caption.monospaced())
                    .foregroundStyle(Theme.textSecondary)

                Spacer()

                Button {
                    appState.showInspector.toggle()
                } label: {
                    Image(systemName: "sidebar.trailing")
                        .font(.caption)
                }
                .buttonStyle(.plain)
                .foregroundStyle(Theme.textSecondary)
                .help("Toggle Right Inspector")
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(Theme.sidebarBg.opacity(0.6))
        }
        .background(Theme.sidebarBg)
        .frame(minWidth: 220, idealWidth: 240, maxWidth: 280)
    }

    private func sectionView<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(title)
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(Theme.textMuted)
                Spacer()
                Image(systemName: "plus")
                    .font(.system(size: 10))
                    .foregroundStyle(Theme.textMuted)
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
            HStack(spacing: 10) {
                // Avatar badge
                ZStack {
                    RoundedRectangle(cornerRadius: 6)
                        .fill(avatarColor.opacity(isSelected ? 0.3 : 0.15))
                        .frame(width: 28, height: 28)
                        .overlay(
                            RoundedRectangle(cornerRadius: 6)
                                .stroke(avatarColor.opacity(isSelected ? 0.8 : 0.3), lineWidth: 1)
                        )
                    Text(avatarText)
                        .font(.system(size: 11, weight: .bold, design: .monospaced))
                        .foregroundStyle(avatarColor)
                }

                // Titles & Subtitles
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.system(size: 12, weight: isSelected ? .semibold : .medium))
                        .foregroundStyle(isSelected ? Theme.textPrimary : Theme.textSecondary)
                        .lineLimit(1)
                    Text(subtitle)
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundStyle(Theme.textMuted)
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
                            isSelected ? Theme.purple.opacity(0.25) : Color.white.opacity(0.06),
                            in: Capsule()
                        )
                        .foregroundStyle(isSelected ? Theme.purple : Theme.textMuted)
                }
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 6)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(isSelected ? Theme.purpleSoft : Color.clear)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(isSelected ? Theme.borderGlow : Color.clear, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}
