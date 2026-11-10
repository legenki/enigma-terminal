import SwiftUI

public struct MenuCommands: Commands {
    @ObservedObject var appState: AppState

    public init(appState: AppState) {
        self.appState = appState
    }

    public var body: some Commands {
        CommandMenu("Panels") {
            Button("Terminal") { appState.selectedPanel = .terminal }
                .keyboardShortcut("1", modifiers: .command)

            Button("Case Files") { appState.selectedPanel = .cases }
                .keyboardShortcut("2", modifiers: .command)

            Button("Contracts Board") { appState.selectedPanel = .contracts }
                .keyboardShortcut("3", modifiers: .command)

            Button("Decrypt") { appState.selectedPanel = .decrypt }
                .keyboardShortcut("4", modifiers: .command)

            Button("Explorer") { appState.selectedPanel = .explorer }
                .keyboardShortcut("6", modifiers: .command)

            Button("Randomizer") { appState.selectedPanel = .randomizer }
                .keyboardShortcut("8", modifiers: .command)

            Button("Journal") { appState.selectedPanel = .journal }
                .keyboardShortcut("9", modifiers: .command)

            Divider()

            Button("Toggle Inspector") { appState.showInspector.toggle() }
                .keyboardShortcut("i", modifiers: [.command, .option])
        }

        CommandMenu("Daylight") {
            Button("Live (Follows Time)") { appState.daylightMode = .live }
                .keyboardShortcut("l", modifiers: [.command, .option])

            Button("Day (Ivory)") { appState.daylightMode = .day }
                .keyboardShortcut("d", modifiers: [.command, .option])

            Button("Night (Dark)") { appState.daylightMode = .night }
                .keyboardShortcut("n", modifiers: [.command, .option])
        }
    }
}
