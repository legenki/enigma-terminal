import SwiftUI

public struct AppToolbar: ToolbarContent {
    @EnvironmentObject private var appState: AppState

    public init() {}

    private var theme: AppTheme { appState.theme }

    public var body: some ToolbarContent {
        ToolbarItem(placement: .principal) {
            // Live Bitcoin block height & pulse pill
            HStack(spacing: 6) {
                Circle()
                    .fill(theme.green)
                    .frame(width: 7, height: 7)
                Text("#\(appState.blockHeight)")
                    .font(.system(size: 11, weight: .bold, design: .monospaced))
                    .foregroundStyle(theme.textPrimary)
                Text("·")
                    .foregroundStyle(theme.textMuted)
                Text(appState.blockTimeAgo)
                    .font(.system(size: 10, design: .monospaced))
                    .foregroundStyle(theme.textSecondary)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(theme.cardInner, in: Capsule())
            .overlay(Capsule().stroke(theme.border, lineWidth: 1))
            .help("Bitcoin Block Clock & Tip Height")
        }

        ToolbarItem(placement: .primaryAction) {
            HStack(spacing: 10) {
                // Daylight Selector (LIVE / DAY / NIGHT)
                HStack(spacing: 2) {
                    ForEach(DaylightMode.allCases) { mode in
                        let isSelected = appState.daylightMode == mode
                        Button {
                            appState.daylightMode = mode
                        } label: {
                            Text(mode.rawValue)
                                .font(.system(size: 9, weight: isSelected ? .bold : .regular))
                                .foregroundStyle(isSelected ? theme.purple : theme.textMuted)
                                .padding(.horizontal, 7)
                                .padding(.vertical, 4)
                                .background(
                                    isSelected ? theme.purpleSoft : Color.clear,
                                    in: RoundedRectangle(cornerRadius: 4)
                                )
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(2)
                .background(theme.cardInner, in: RoundedRectangle(cornerRadius: 6))
                .overlay(RoundedRectangle(cornerRadius: 6).stroke(theme.border, lineWidth: 1))

                // Language Menu (EN / RU / ES / PT)
                Menu {
                    Button("English (EN)") {
                        appState.selectedLanguage = "EN"
                    }
                    Button("Русский (RU)") {
                        appState.selectedLanguage = "RU"
                    }
                    Button("Español (ES)") {
                        appState.selectedLanguage = "ES"
                    }
                    Button("Português (PT)") {
                        appState.selectedLanguage = "PT"
                    }
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "globe")
                            .font(.system(size: 10))
                        Text(appState.selectedLanguage)
                            .font(.system(size: 10, weight: .bold))
                    }
                    .foregroundStyle(theme.textSecondary)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 4)
                    .background(theme.cardInner, in: RoundedRectangle(cornerRadius: 4))
                    .overlay(RoundedRectangle(cornerRadius: 4).stroke(theme.border, lineWidth: 1))
                }
                .buttonStyle(.plain)

                // Sound Chime Button
                Button {
                    appState.soundEnabled.toggle()
                } label: {
                    Image(systemName: appState.soundEnabled ? "bell.fill" : "bell.slash")
                        .font(.system(size: 11))
                        .foregroundStyle(appState.soundEnabled ? theme.purple : theme.textMuted)
                        .padding(5)
                        .background(theme.cardInner, in: RoundedRectangle(cornerRadius: 4))
                        .overlay(RoundedRectangle(cornerRadius: 4).stroke(theme.border, lineWidth: 1))
                }
                .buttonStyle(.plain)
                .help(appState.t("blockChime"))

                // Inspector Toggle Button
                Button {
                    appState.showInspector.toggle()
                } label: {
                    Image(systemName: "sidebar.trailing")
                        .font(.system(size: 11))
                        .foregroundStyle(appState.showInspector ? theme.purple : theme.textSecondary)
                        .padding(5)
                        .background(appState.showInspector ? theme.purpleSoft : theme.cardInner, in: RoundedRectangle(cornerRadius: 4))
                        .overlay(
                            RoundedRectangle(cornerRadius: 4)
                                .stroke(appState.showInspector ? theme.borderGlow : theme.border, lineWidth: 1)
                        )
                }
                .buttonStyle(.plain)
                .help(appState.t("toggleInspector"))
            }
        }
    }
}
