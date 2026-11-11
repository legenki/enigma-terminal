import SwiftUI
import AppKit

public struct TerminalView: View {
    @EnvironmentObject private var appState: AppState

    @State private var inputCommand: String = ""
    @FocusState private var isInputFocused: Bool

    public init() {}

    private var theme: AppTheme { appState.theme }

    public var body: some View {
        VStack(spacing: 0) {
            // Console Toolbar
            HStack(spacing: 8) {
                Label("nullsec@enigma:~$", systemImage: "terminal.fill")
                    .font(.system(size: 11, weight: .bold, design: .monospaced))
                    .foregroundStyle(theme.purple)

                Spacer()

                Button("Help") { appState.runCommand("HELP") }
                    .buttonStyle(.bordered)
                    .controlSize(.small)

                Button("Status") { appState.runCommand("STATUS") }
                    .buttonStyle(.bordered)
                    .controlSize(.small)

                Button("Roll") { appState.runCommand("ROLL") }
                    .buttonStyle(.bordered)
                    .controlSize(.small)

                Button("Clear") { appState.clearTerminal() }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .background(theme.cardBg)

            Divider()
                .overlay(theme.border)

            // Scrollable Terminal Logs Area
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 4) {
                        ForEach(appState.terminalLines) { line in
                            Text(line.text)
                                .font(.system(size: 13, weight: .regular, design: .monospaced))
                                .foregroundStyle(theme.isLight ? (line.style == .normal ? theme.textPrimary : line.style.color) : line.style.color)
                                .textSelection(.enabled)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .id(line.id)
                        }
                    }
                    .padding(16)
                }
                .background(theme.isLight ? Color(red: 0.96, green: 0.95, blue: 0.92) : Color(red: 0.04, green: 0.05, blue: 0.07))
                .onChange(of: appState.terminalLines.count) { _, _ in
                    if let last = appState.terminalLines.last {
                        proxy.scrollTo(last.id, anchor: .bottom)
                    }
                }
            }

            Divider()
                .overlay(theme.border)

            // Console Prompt Input Row (Standard macOS Console Style)
            HStack(spacing: 8) {
                Text("nullsec@enigma:~$")
                    .font(.system(size: 13, weight: .bold, design: .monospaced))
                    .foregroundStyle(theme.purple)

                TextField(appState.t("cmdPlaceholder"), text: $inputCommand)
                    .textFieldStyle(.plain)
                    .font(.system(size: 13, design: .monospaced))
                    .foregroundStyle(theme.textPrimary)
                    .focused($isInputFocused)
                    .onSubmit {
                        submitCommand()
                    }

                Button("Run") {
                    submitCommand()
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.small)
                .disabled(inputCommand.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(theme.cardBg)
        }
        .onAppear {
            isInputFocused = true
        }
    }

    private func submitCommand() {
        let cmd = inputCommand.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cmd.isEmpty else { return }
        inputCommand = ""
        appState.runCommand(cmd)
    }
}
