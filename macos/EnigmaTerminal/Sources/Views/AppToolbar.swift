import SwiftUI

public struct AppToolbar: ToolbarContent {
    @EnvironmentObject private var appState: AppState

    public init() {}

    public var body: some ToolbarContent {
        ToolbarItem(placement: .principal) {
            HStack(spacing: 10) {
                // Engine pill
                HStack(spacing: 5) {
                    Circle()
                        .fill(Theme.purple)
                        .frame(width: 6, height: 6)
                    Text("1 engine active")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(Theme.textSecondary)
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(Color.white.opacity(0.04), in: Capsule())

                // Bitcoin block height & pulse pill
                HStack(spacing: 6) {
                    Circle()
                        .fill(Theme.green)
                        .frame(width: 6, height: 6)
                    Text("#\(appState.blockHeight)")
                        .font(.system(size: 11, weight: .bold, design: .monospaced))
                        .foregroundStyle(Theme.textPrimary)
                    Text("·")
                        .foregroundStyle(Theme.textMuted)
                    Text(appState.blockTimeAgo)
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundStyle(Theme.textSecondary)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background(Theme.cardInner, in: Capsule())
                .overlay(Capsule().stroke(Theme.border, lineWidth: 1))
            }
        }

        ToolbarItem(placement: .primaryAction) {
            HStack(spacing: 10) {
                // Custom Dark Daylight Selector (No clashing bright blue!)
                HStack(spacing: 2) {
                    ForEach(DaylightMode.allCases) { mode in
                        let isSelected = appState.daylightMode == mode
                        Button {
                            appState.daylightMode = mode
                        } label: {
                            Text(mode.rawValue)
                                .font(.system(size: 9, weight: isSelected ? .bold : .regular))
                                .foregroundStyle(isSelected ? Theme.purple : Theme.textMuted)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 3)
                                .background(
                                    isSelected ? Theme.purpleSoft : Color.clear,
                                    in: RoundedRectangle(cornerRadius: 4)
                                )
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(2)
                .background(Theme.cardInner, in: RoundedRectangle(cornerRadius: 6))
                .overlay(RoundedRectangle(cornerRadius: 6).stroke(Theme.border, lineWidth: 1))

                // Language Menu
                Menu {
                    Button("English (EN)") {
                        appState.selectedLanguage = "EN"
                        appState.reloadGameData()
                    }
                    Button("Русский (RU)") {
                        appState.selectedLanguage = "RU"
                        appState.reloadGameData()
                    }
                    Button("Español (ES)") {
                        appState.selectedLanguage = "ES"
                        appState.reloadGameData()
                    }
                    Button("Português (PT)") {
                        appState.selectedLanguage = "PT"
                        appState.reloadGameData()
                    }
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "globe")
                            .font(.system(size: 10))
                        Text(appState.selectedLanguage)
                            .font(.system(size: 10, weight: .bold))
                    }
                    .foregroundStyle(Theme.textSecondary)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 3)
                    .background(Theme.cardInner, in: RoundedRectangle(cornerRadius: 4))
                }
                .buttonStyle(.plain)

                // Sound Chime Button
                Button {
                    appState.soundEnabled.toggle()
                } label: {
                    Image(systemName: appState.soundEnabled ? "bell.fill" : "bell.slash")
                        .font(.system(size: 11))
                        .foregroundStyle(appState.soundEnabled ? Theme.purple : Theme.textMuted)
                        .padding(5)
                        .background(Theme.cardInner, in: RoundedRectangle(cornerRadius: 4))
                }
                .buttonStyle(.plain)
                .help("Toggle Block Chime")

                // Inspector Toggle Button
                Button {
                    appState.showInspector.toggle()
                } label: {
                    Image(systemName: "sidebar.trailing")
                        .font(.system(size: 11))
                        .foregroundStyle(appState.showInspector ? Theme.purple : Theme.textSecondary)
                        .padding(5)
                        .background(appState.showInspector ? Theme.purpleSoft : Theme.cardInner, in: RoundedRectangle(cornerRadius: 4))
                        .overlay(
                            RoundedRectangle(cornerRadius: 4)
                                .stroke(appState.showInspector ? Theme.borderGlow : Theme.border, lineWidth: 1)
                        )
                }
                .buttonStyle(.plain)
                .help("Toggle Inspector")
            }
        }
    }
}
