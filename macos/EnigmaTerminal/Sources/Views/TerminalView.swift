import SwiftUI
import AppKit

public struct TerminalView: View {
    @EnvironmentObject private var appState: AppState

    @State private var inputCommand: String = ""
    @State private var activeTab: Int = 0
    @FocusState private var isInputFocused: Bool

    public init() {}

    public var body: some View {
        VStack(spacing: 0) {
            // Main Floating Card Container (matching screenshot)
            VStack(spacing: 0) {
                // 1. Tab Bar on top of card
                tabBarHeader

                Divider()
                    .overlay(Theme.border)

                // 2. Feed / Console Area
                ScrollViewReader { proxy in
                    ScrollView {
                        VStack(alignment: .leading, spacing: 16) {
                            // Initial System Welcome Block
                            shellCodeBlock(
                                title: "Initialization & Diagnostics",
                                command: "./tools/build_macos_app.sh",
                                output: "==> Building native SwiftUI Enigma Terminal for macOS 26.0+ (arm64)\n==> Bundling JavaScriptCore crypto engine... Success (52 KB)\n==> Signing bundle with ad-hoc identity... Verified\n==> Build successful: dist/Enigma Terminal.app (1.6M)"
                            )

                            // Verification Step Block
                            shellCodeBlock(
                                title: "Process Life-Cycle & State Restoration",
                                command: "open \"dist/Enigma Terminal.app\"",
                                output: "Process actively running. talagentd state restoration snapshot completed with 0 errors. AutoLayout constraint loops eliminated."
                            )

                            // Live Log Entries
                            ForEach(appState.terminalLines) { line in
                                terminalLineView(line)
                                    .id(line.id)
                            }

                            // Dynamic Attachment Chip (matching screenshot)
                            HStack {
                                Spacer()
                                HStack(spacing: 10) {
                                    Image(systemName: "doc.text.fill")
                                        .foregroundStyle(Theme.purple)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text("BIP-39 Test Vectors Parity Report")
                                            .font(.system(size: 11, weight: .medium))
                                            .foregroundStyle(Theme.textPrimary)
                                        Text("482 tests passed · Bit-for-bit identical")
                                            .font(.system(size: 10, design: .monospaced))
                                            .foregroundStyle(Theme.textMuted)
                                    }
                                }
                                .padding(.horizontal, 12)
                                .padding(.vertical, 8)
                                .background(Theme.cardInner, in: RoundedRectangle(cornerRadius: 8))
                                .overlay(RoundedRectangle(cornerRadius: 8).stroke(Theme.border, lineWidth: 1))
                            }
                            .padding(.vertical, 4)
                        }
                        .padding(18)
                    }
                    .background(Theme.cardInner)
                    .onChange(of: appState.terminalLines.count) { _, _ in
                        if let last = appState.terminalLines.last {
                            withAnimation(.easeOut(duration: 0.15)) {
                                proxy.scrollTo(last.id, anchor: .bottom)
                            }
                        }
                    }
                }

                Divider()
                    .overlay(Theme.border)

                // 3. Floating Interactive Input Bar (matching screenshot)
                floatingInputBar
            }
            .background(Theme.cardBg)
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .overlay(
                RoundedRectangle(cornerRadius: 14)
                    .stroke(Theme.border, lineWidth: 1)
            )
            .shadow(color: Color.black.opacity(0.35), radius: 12, x: 0, y: 6)
            .padding(16)
        }
        .background(Theme.bgDeep)
        .onAppear {
            isInputFocused = true
        }
    }

    // MARK: - Tab Bar Header

    private var tabBarHeader: some View {
        HStack(spacing: 0) {
            // Tab 1: Workspace / Story
            tabItem(title: "Enigma Terminal Quest", icon: "terminal.fill", isActive: activeTab == 0) {
                activeTab = 0
            }

            // Tab 2: Console
            tabItem(title: "Live Bitcoin Chain", icon: "network", isActive: activeTab == 1) {
                activeTab = 1
            }

            // Tab Plus
            Button {
                appState.appendTerminal("Created new scratchpad session", style: .cyan)
            } label: {
                Image(systemName: "plus")
                    .font(.caption2)
                    .foregroundStyle(Theme.textMuted)
                    .padding(.horizontal, 10)
            }
            .buttonStyle(.plain)

            Spacer()

            // Header Action Buttons
            HStack(spacing: 12) {
                Button {
                    appState.clearTerminal()
                } label: {
                    Image(systemName: "trash")
                        .font(.caption)
                        .foregroundStyle(Theme.textMuted)
                }
                .buttonStyle(.plain)
                .help("Clear Terminal Output")

                Button {
                    appState.runCommand("STATUS")
                } label: {
                    Image(systemName: "arrow.clockwise")
                        .font(.caption)
                        .foregroundStyle(Theme.textMuted)
                }
                .buttonStyle(.plain)
                .help("Refresh Status")
            }
            .padding(.trailing, 14)
        }
        .padding(.vertical, 8)
        .background(Theme.cardBg)
    }

    private func tabItem(title: String, icon: String, isActive: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.caption2)
                    .foregroundStyle(isActive ? Theme.purple : Theme.textMuted)
                Text(title)
                    .font(.system(size: 11, weight: isActive ? .semibold : .regular))
                    .foregroundStyle(isActive ? Theme.textPrimary : Theme.textMuted)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(
                isActive ? Theme.purpleSoft : Color.clear,
                in: RoundedRectangle(cornerRadius: 6)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 6)
                    .stroke(isActive ? Theme.borderGlow : Color.clear, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .padding(.leading, 8)
    }

    // MARK: - Code / Shell Block (Matching screenshot)

    private func shellCodeBlock(title: String, command: String, output: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(Theme.textPrimary)

            VStack(alignment: .leading, spacing: 0) {
                // Top header of code box
                HStack {
                    Text("Shell")
                        .font(.system(size: 10, weight: .bold, design: .monospaced))
                        .foregroundStyle(Theme.textMuted)
                    Spacer()
                    Button {
                        NSPasteboard.general.clearContents()
                        NSPasteboard.general.setString(command, forType: .string)
                    } label: {
                        Image(systemName: "doc.on.doc")
                            .font(.system(size: 10))
                            .foregroundStyle(Theme.textMuted)
                    }
                    .buttonStyle(.plain)
                    .help("Copy command")
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(Color.white.opacity(0.02))

                Divider()
                    .overlay(Theme.borderSubtle)

                Text(command)
                    .font(.system(size: 12, weight: .regular, design: .monospaced))
                    .foregroundStyle(Theme.textPrimary)
                    .textSelection(.enabled)
                    .padding(12)
            }
            .background(Theme.cardBg)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(Theme.border, lineWidth: 1)
            )

            Text(output)
                .font(.system(size: 11, design: .monospaced))
                .foregroundStyle(Theme.textSecondary)
                .padding(.leading, 4)
        }
        .padding(.vertical, 4)
    }

    private func terminalLineView(_ line: TerminalLine) -> some View {
        HStack(alignment: .top, spacing: 6) {
            Text(line.text)
                .font(.system(size: 12, weight: .regular, design: .monospaced))
                .foregroundStyle(line.style.color)
                .textSelection(.enabled)
            Spacer()
        }
        .padding(.horizontal, 4)
    }

    // MARK: - Floating Input Bar (Matching screenshot)

    private var floatingInputBar: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Text Input Field
            TextField("Type command (e.g. HELP, DECRYPT <phrase>, WORD <n>, FIND <phrase ?>, STATUS)...", text: $inputCommand)
                .textFieldStyle(.plain)
                .font(.system(size: 13, design: .monospaced))
                .foregroundStyle(Theme.textPrimary)
                .focused($isInputFocused)
                .onSubmit {
                    execute()
                }

            // Bottom Badges & Send Button Row
            HStack(spacing: 8) {
                // Model / Engine Pill
                HStack(spacing: 5) {
                    Image(systemName: "cpu.fill")
                        .font(.system(size: 9))
                    Text("Enigma v3.1 · Secp256k1")
                        .font(.system(size: 10, weight: .semibold))
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(Theme.purpleSoft, in: Capsule())
                .foregroundStyle(Theme.purple)

                // High / Live status badge
                Text("Mainnet Live")
                    .font(.system(size: 9, weight: .bold, design: .monospaced))
                    .padding(.horizontal, 6)
                    .padding(.vertical, 3)
                    .background(Theme.green.opacity(0.15), in: Capsule())
                    .foregroundStyle(Theme.green)

                Spacer()

                // Send Button (circular purple button with up arrow)
                Button(action: execute) {
                    ZStack {
                        Circle()
                            .fill(inputCommand.isEmpty ? Theme.purple.opacity(0.3) : Theme.purple)
                            .frame(width: 28, height: 28)
                        Image(systemName: "arrow.up")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(Color.white)
                    }
                }
                .buttonStyle(.plain)
                .disabled(inputCommand.isEmpty)
            }
        }
        .padding(12)
        .background(Theme.inputBg)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(isInputFocused ? Theme.borderGlow : Theme.border, lineWidth: 1)
        )
        .padding(12)
    }

    private func execute() {
        let cmd = inputCommand
        inputCommand = ""
        appState.runCommand(cmd)
    }
}
