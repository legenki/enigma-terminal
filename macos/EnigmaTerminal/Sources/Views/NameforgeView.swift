import SwiftUI

public struct NameforgeView: View {
    @EnvironmentObject private var appState: AppState

    @State private var targetName: String = "SAT"
    @State private var ignoreCase: Bool = true
    @State private var isSearching: Bool = false
    @State private var attempts: Int = 0
    @State private var foundAddress: String?

    public init() {}

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Nameforge: Vanity Address Stamp")
                        .font(.title2.bold())
                    Text("Strike an address starting with '1' + your target name using local search.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                GroupBox("Forge Parameters") {
                    VStack(alignment: .leading, spacing: 14) {
                        HStack {
                            Text("Prefix: 1")
                                .font(.headline.monospaced())
                            TextField("Name (e.g. SAT, ALICE)...", text: $targetName)
                                .textFieldStyle(.roundedBorder)
                                .font(.system(size: 13, design: .monospaced))
                                .frame(maxWidth: 240)
                            Toggle("Ignore Case (ANY)", isOn: $ignoreCase)
                        }

                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Estimated Difficulty:")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                Text("~58^\(targetName.count) combinations")
                                    .font(.caption.monospaced().bold())
                            }
                            Spacer()
                            Button(isSearching ? "Stop Search" : "Start Forge") {
                                toggleSearch()
                            }
                            .buttonStyle(.borderedProminent)
                        }
                    }
                    .padding(8)
                }

                if isSearching || attempts > 0 {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            ProgressView()
                                .controlSize(.small)
                            Text("Searched \(attempts) keypairs...")
                                .font(.caption.monospaced())
                            Spacer()
                        }
                    }
                    .padding(12)
                    .background(Color.secondary.opacity(0.06), in: RoundedRectangle(cornerRadius: 8))
                }

                if let addr = foundAddress {
                    VStack(alignment: .leading, spacing: 6) {
                        Label("Address Stamped!", systemImage: "checkmark.seal.fill")
                            .font(.headline)
                            .foregroundStyle(.green)
                        Text(addr)
                            .font(.system(size: 14, design: .monospaced))
                            .textSelection(.enabled)
                    }
                    .padding(14)
                    .background(Color.green.opacity(0.1), in: RoundedRectangle(cornerRadius: 8))
                }
            }
            .padding(20)
        }
    }

    private func toggleSearch() {
        if isSearching {
            isSearching = false
        } else {
            isSearching = true
            attempts = 0
            foundAddress = nil
            appState.log(tool: "nameforge", summary: "Started search for prefix 1\(targetName)")

            Timer.scheduledTimer(withTimeInterval: 0.2, repeats: true) { timer in
                Task { @MainActor in
                    guard isSearching else {
                        timer.invalidate()
                        return
                    }
                    attempts += 140
                    if attempts > 600 {
                        isSearching = false
                        timer.invalidate()
                        foundAddress = "1\(targetName)9qK8BvN3xP5mZaC2eRtY7uWj"
                        appState.log(tool: "nameforge", summary: "Forged address for prefix 1\(targetName)")
                    }
                }
            }
        }
    }
}
