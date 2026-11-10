import SwiftUI

@main
struct EnigmaTerminalApp: App {
    @StateObject private var appState = AppState()

    var body: some Scene {
        WindowGroup("ENIGMA TERMINAL") {
            ContentView()
                .environmentObject(appState)
                .preferredColorScheme(appState.daylightMode == .day ? .light : (appState.daylightMode == .night ? .dark : nil))
        }
        .windowStyle(.titleBar)
        .defaultSize(width: 1200, height: 800)
        .commands {
            MenuCommands(appState: appState)
        }
    }
}
