import SwiftUI

public struct AppToolbar: ToolbarContent {
    @EnvironmentObject private var appState: AppState

    public init() {}

    public var body: some ToolbarContent {
        ToolbarItem(placement: .navigation) {
            HStack(spacing: 8) {
                Button {
                    // Navigate back if needed
                } label: {
                    Image(systemName: "chevron.left")
                        .font(.caption2)
                        .foregroundStyle(Theme.textMuted)
                }
                .buttonStyle(.plain)

                Button {
                    // Navigate forward if needed
                } label: {
                    Image(systemName: "chevron.right")
                        .font(.caption2)
                        .foregroundStyle(Theme.textMuted)
                }
                .buttonStyle(.plain)
            }
        }

        ToolbarItem(placement: .principal) {
            HStack(spacing: 12) {
                // Agent / Engine pill (matching screenshot: "1 agent running")
                HStack(spacing: 6) {
                    Circle()
                        .fill(Theme.purple)
                        .frame(width: 6, height: 6)
                    Text("1 engine running")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(Theme.textSecondary)
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(Color.white.opacity(0.04), in: Capsule())

                // Price / Block height pill (matching screenshot: "$87.84" style)
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
                // Daylight Segmented Control
                Picker("Daylight", selection: $appState.daylightMode) {
                    ForEach(DaylightMode.allCases) { mode in
                        Text(mode.rawValue).tag(mode)
                    }
                }
                .pickerStyle(.segmented)
                .controlSize(.small)
                .frame(width: 130)

                // Language
                Menu {
                    Button("English (EN)") { appState.selectedLanguage = "EN" }
                    Button("Русский (RU)") { appState.selectedLanguage = "RU" }
                    Button("Español (ES)") { appState.selectedLanguage = "ES" }
                    Button("Português (PT)") { appState.selectedLanguage = "PT" }
                } label: {
                    Text(appState.selectedLanguage)
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(Theme.textSecondary)
                }
                .buttonStyle(.plain)

                // Sound Chime Button
                Button {
                    appState.soundEnabled.toggle()
                } label: {
                    Image(systemName: appState.soundEnabled ? "bell.fill" : "bell.slash")
                        .font(.caption)
                        .foregroundStyle(appState.soundEnabled ? Theme.purple : Theme.textMuted)
                }
                .buttonStyle(.plain)
                .help("Toggle Block Landing Chime")

                // Inspector Toggle
                Button {
                    appState.showInspector.toggle()
                } label: {
                    Image(systemName: "sidebar.trailing")
                        .font(.caption)
                        .foregroundStyle(appState.showInspector ? Theme.purple : Theme.textSecondary)
                }
                .buttonStyle(.plain)
                .help("Toggle Inspector")
            }
        }
    }
}
