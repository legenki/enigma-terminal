import SwiftUI

public struct ClassicHIGLayoutView: View {
    @EnvironmentObject private var appState: AppState

    public init() {}

    private var theme: AppTheme { appState.theme }

    public var body: some View {
        NavigationSplitView {
            classicSidebar
                .navigationSplitViewColumnWidth(min: 220, ideal: 240, max: 300)
        } detail: {
            classicDetailView
                .frame(minWidth: 700, minHeight: 500)
        }
        .inspector(isPresented: $appState.showInspector) {
            WordlistInspectorView()
                .inspectorColumnWidth(min: 260, ideal: 300, max: 360)
        }
        .toolbar {
            AppToolbar()
        }
    }

    // MARK: - Classic HIG Sidebar (Native List Style, System HIG)

    private var classicSidebar: some View {
        List(selection: $appState.selectedPanel) {
            Section(appState.t("projects")) {
                classicSidebarItem(panel: .terminal, badge: "v3.1")
                classicSidebarItem(panel: .cases, badge: "\(appState.solvedCaseIDs.count)/8")
                classicSidebarItem(panel: .contracts, badge: "\(appState.solvedContractIDs.count)/256")
                classicSidebarItem(panel: .acta, badge: nil)
            }

            Section(appState.t("crypto")) {
                classicSidebarItem(panel: .decrypt, badge: "3 addrs")
                classicSidebarItem(panel: .ledger, badge: nil)
                classicSidebarItem(panel: .explorer, badge: "#\(appState.blockHeight)")
                classicSidebarItem(panel: .randomizer, badge: nil)
                classicSidebarItem(panel: .nameforge, badge: nil)
            }

            Section(appState.t("investigation")) {
                classicSidebarItem(panel: .journal, badge: "\(appState.journal.count)")
                classicSidebarItem(panel: .about, badge: nil)
            }
        }
        .listStyle(.sidebar)
        .navigationTitle("Enigma")
    }

    private func classicSidebarItem(panel: AppPanel, badge: String?) -> some View {
        HStack {
            Label(appState.t(panel.rawValue), systemImage: panel.systemImage)
                .font(.system(size: 13))
            Spacer()
            if let b = badge {
                Text(b)
                    .font(.caption2.monospaced())
                    .foregroundStyle(.secondary)
            }
        }
        .tag(panel)
    }

    // MARK: - Classic HIG Detail (Clean Edge-to-Edge Document View)

    private var classicDetailView: some View {
        VStack(spacing: 0) {
            // Document View Title Header
            HStack {
                Text(appState.t(appState.selectedPanel.rawValue))
                    .font(.title2.bold())
                Spacer()
            }
            .padding(.horizontal, 24)
            .padding(.top, 16)
            .padding(.bottom, 8)

            Divider()

            // Edge-to-edge clean document body
            Group {
                switch appState.selectedPanel {
                case .terminal:
                    classicTerminalBody
                case .cases, .acta:
                    CaseFilesView()
                case .contracts:
                    ContractsBoardView()
                case .decrypt, .ledger:
                    DecryptView()
                case .explorer:
                    ExplorerView()
                case .randomizer:
                    RandomizerView()
                case .nameforge:
                    NameforgeView()
                case .archive, .journal:
                    JournalView()
                case .about:
                    AboutView()
                }
            }
        }
        .background(theme.isLight ? Color(nsColor: .windowBackgroundColor) : Color(nsColor: .windowBackgroundColor))
    }

    // MARK: - Classic Terminal Body (Standard macOS Terminal Style)

    @State private var terminalInput: String = ""

    private var classicTerminalBody: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 4) {
                        ForEach(appState.terminalLines) { line in
                            Text(line.text)
                                .font(.system(size: 13, weight: .regular, design: .monospaced))
                                .foregroundStyle(line.style.color)
                                .textSelection(.enabled)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .id(line.id)
                        }
                    }
                    .padding(16)
                }
                .background(Color(red: 0.04, green: 0.05, blue: 0.07))
                .onChange(of: appState.terminalLines.count) { _, _ in
                    if let last = appState.terminalLines.last {
                        proxy.scrollTo(last.id, anchor: .bottom)
                    }
                }
            }

            Divider()

            HStack(spacing: 8) {
                Text("nullsec@enigma:~$")
                    .font(.system(size: 13, weight: .bold, design: .monospaced))
                    .foregroundStyle(Color(red: 0.35, green: 0.90, blue: 0.65))

                TextField(appState.t("cmdPlaceholder"), text: $terminalInput)
                    .textFieldStyle(.plain)
                    .font(.system(size: 13, design: .monospaced))
                    .onSubmit {
                        let cmd = terminalInput
                        terminalInput = ""
                        appState.runCommand(cmd)
                    }

                Button("Send") {
                    let cmd = terminalInput
                    terminalInput = ""
                    appState.runCommand(cmd)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.small)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(Color(nsColor: .controlBackgroundColor))
        }
    }
}
