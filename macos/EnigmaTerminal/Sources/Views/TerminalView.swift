import SwiftUI
import AppKit

public struct TerminalView: View {
    @EnvironmentObject private var appState: AppState
    @State private var inputCommand: String = ""
    @FocusState private var isInputFocused: Bool

    public init() {}

    public var body: some View {
        VStack(spacing: 0) {
            // Terminal Header Banner
            HStack {
                Label("Terminal Console", systemImage: "terminal.fill")
                    .font(.headline)
                Spacer()
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
            .padding(.vertical, 10)
            .background(Color.secondary.opacity(0.06))

            Divider()

            // Console output area
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 4) {
                        ForEach(appState.terminalLines) { line in
                            Text(line.text)
                                .font(.system(size: 13, weight: .regular, design: .monospaced))
                                .foregroundStyle(line.style.color)
                                .textSelection(.enabled)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .id(line.id)
                        }
                    }
                    .padding(14)
                }
                .background(Color(red: 0.04, green: 0.05, blue: 0.07))
                .onChange(of: appState.terminalLines.count) { _, _ in
                    if let last = appState.terminalLines.last {
                        withAnimation(.easeOut(duration: 0.1)) {
                            proxy.scrollTo(last.id, anchor: .bottom)
                        }
                    }
                }
            }

            Divider()

            // Command input row
            HStack(spacing: 8) {
                Text("nullsec@enigma:~$")
                    .font(.system(size: 13, weight: .bold, design: .monospaced))
                    .foregroundStyle(Color(red: 0.35, green: 0.90, blue: 0.65))

                TextField("Type command (e.g. HELP, STATUS, ROLL, DECRYPT <phrase>)...", text: $inputCommand)
                    .textFieldStyle(.plain)
                    .font(.system(size: 13, weight: .regular, design: .monospaced))
                    .focused($isInputFocused)
                    .onSubmit {
                        let cmd = inputCommand
                        inputCommand = ""
                        appState.runCommand(cmd)
                    }

                if !inputCommand.isEmpty {
                    Button {
                        let cmd = inputCommand
                        inputCommand = ""
                        appState.runCommand(cmd)
                    } label: {
                        Image(systemName: "return")
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(.secondary)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(Color.secondary.opacity(0.08))
        }
        .onAppear {
            isInputFocused = true
        }
    }
}
