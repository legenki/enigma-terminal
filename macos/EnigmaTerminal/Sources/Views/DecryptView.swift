import SwiftUI
import AppKit

public struct DecryptView: View {
    @EnvironmentObject private var appState: AppState

    @State private var phraseInput: String = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
    @State private var validationResult: ValidationResult?
    @State private var derivedAddresses: [DerivedAddress] = []
    @State private var copiedIndex: Int?

    public init() {}

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                // Header
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("BIP-39 / BIP-32 Key Derivation")
                            .font(.title2.bold())
                        Text("Validate mnemonic checksum and walk secp256k1 derivation paths to live Bitcoin addresses.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Button("Fill Test Vector") {
                        phraseInput = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
                        runDerivation()
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                }

                // Input Box
                GroupBox("Mnemonic Phrase") {
                    VStack(alignment: .leading, spacing: 10) {
                        TextEditor(text: $phraseInput)
                            .font(.system(size: 14, weight: .regular, design: .monospaced))
                            .frame(minHeight: 64)
                            .padding(4)
                            .background(Color.secondary.opacity(0.06), in: RoundedRectangle(cornerRadius: 6))
                            .onChange(of: phraseInput) { _, _ in
                                runDerivation()
                            }

                        HStack {
                            if let res = validationResult {
                                if res.isValid {
                                    Label("BIP-39 Checksum Valid (\(res.words.count) words)", systemImage: "checkmark.circle.fill")
                                        .foregroundStyle(.green)
                                        .font(.caption.bold())
                                } else {
                                    Label(res.errorMessage ?? "Invalid Checksum", systemImage: "exclamationmark.triangle.fill")
                                        .foregroundStyle(.red)
                                        .font(.caption.bold())
                                }
                            }
                            Spacer()
                            Button("Derive Addresses") {
                                runDerivation()
                            }
                            .buttonStyle(.borderedProminent)
                        }
                    }
                    .padding(8)
                }

                // Derivations Result
                if !derivedAddresses.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Derived Public Addresses")
                            .font(.headline)

                        ForEach(Array(derivedAddresses.enumerated()), id: \.element.id) { index, item in
                            HStack {
                                VStack(alignment: .leading, spacing: 4) {
                                    HStack {
                                        Text(item.label)
                                            .font(.subheadline.bold())
                                        Text("· \(item.derivationPath)")
                                            .font(.caption.monospaced())
                                            .foregroundStyle(.secondary)
                                    }
                                    Text(item.address)
                                        .font(.system(size: 13, design: .monospaced))
                                        .foregroundStyle(.primary)
                                        .textSelection(.enabled)
                                }
                                Spacer()
                                Button {
                                    NSPasteboard.general.clearContents()
                                    NSPasteboard.general.setString(item.address, forType: .string)
                                    copiedIndex = index
                                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                                        if copiedIndex == index { copiedIndex = nil }
                                    }
                                } label: {
                                    Label(copiedIndex == index ? "Copied" : "Copy", systemImage: copiedIndex == index ? "checkmark" : "doc.on.doc")
                                }
                                .buttonStyle(.bordered)
                                .controlSize(.small)
                            }
                            .padding(12)
                            .background(Color.secondary.opacity(0.06), in: RoundedRectangle(cornerRadius: 8))
                        }
                    }
                }
            }
            .padding(20)
        }
        .onAppear {
            runDerivation()
        }
    }

    private func runDerivation() {
        let trimmed = phraseInput.trimmingCharacters(in: .whitespacesAndNewlines)
        let res = appState.core.validate(mnemonic: trimmed)
        self.validationResult = res
        if res.isValid {
            self.derivedAddresses = appState.core.derive(mnemonic: trimmed)
            appState.log(tool: "decrypt", summary: "Derived \(derivedAddresses.count) addresses from valid mnemonic")
        } else {
            self.derivedAddresses = []
        }
    }
}
