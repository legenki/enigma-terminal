import SwiftUI

public struct AppToolbar: ToolbarContent {
    @EnvironmentObject private var appState: AppState

    public init() {}

    public var body: some ToolbarContent {
        ToolbarItem(placement: .automatic) {
            HStack(spacing: 6) {
                Circle()
                    .fill(Color.green)
                    .frame(width: 7, height: 7)
                Text("#\(appState.blockHeight)")
                    .font(.caption.monospaced().bold())
                Text("·")
                    .foregroundStyle(.secondary)
                Text(appState.blockTimeAgo)
                    .font(.caption.monospaced())
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(Color.secondary.opacity(0.12), in: Capsule())
            .help("Bitcoin Block Clock & Height")
        }

        ToolbarItem(placement: .automatic) {
            Picker("Daylight", selection: $appState.daylightMode) {
                ForEach(DaylightMode.allCases) { mode in
                    Text(mode.rawValue).tag(mode)
                }
            }
            .pickerStyle(.segmented)
            .help("Interface Daylight Palette (Live/Day/Night)")
        }

        ToolbarItem(placement: .automatic) {
            Menu {
                Button("English (EN)") { appState.selectedLanguage = "EN" }
                Button("Русский (RU)") { appState.selectedLanguage = "RU" }
                Button("Español (ES)") { appState.selectedLanguage = "ES" }
                Button("Português (PT)") { appState.selectedLanguage = "PT" }
            } label: {
                Label(appState.selectedLanguage, systemImage: "globe")
            }
            .help("Narrative Language")
        }

        ToolbarItem(placement: .automatic) {
            Button {
                appState.soundEnabled.toggle()
            } label: {
                Image(systemName: appState.soundEnabled ? "speaker.wave.2.fill" : "speaker.slash.fill")
            }
            .help(appState.soundEnabled ? "Mute block chime" : "Unmute block chime")
        }

        ToolbarItem(placement: .primaryAction) {
            Button {
                appState.showInspector.toggle()
            } label: {
                Image(systemName: "sidebar.trailing")
            }
            .help("Toggle BIP-39 Wordlist & Recovery Inspector")
        }
    }
}
