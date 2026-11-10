import SwiftUI
import AppKit

public struct RandomizerView: View {
    @EnvironmentObject private var appState: AppState

    @State private var wordCount: Int = 12
    @State private var generatedPhrase: String = ""
    @State private var words: [String] = []
    @State private var isCopied: Bool = false

    public init() {}

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Entropy & Mnemonic Generator")
                        .font(.title2.bold())
                    Text("Cryptographically secure BIP-39 mnemonic creation from CSPRNG entropy.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                GroupBox("Parameters") {
                    HStack(spacing: 20) {
                        Picker("Word Count", selection: $wordCount) {
                            Text("12 Words (128 bits)").tag(12)
                            Text("15 Words (160 bits)").tag(15)
                            Text("18 Words (192 bits)").tag(18)
                            Text("21 Words (224 bits)").tag(21)
                            Text("24 Words (256 bits)").tag(24)
                        }
                        .frame(maxWidth: 280)

                        Spacer()

                        Button("Generate Fresh Phrase") {
                            generatePhrase()
                        }
                        .buttonStyle(.borderedProminent)
                    }
                    .padding(8)
                }

                if !words.isEmpty {
                    VStack(alignment: .leading, spacing: 14) {
                        HStack {
                            Text("Generated Mnemonic Words")
                                .font(.headline)
                            Spacer()
                            Button {
                                NSPasteboard.general.clearContents()
                                NSPasteboard.general.setString(generatedPhrase, forType: .string)
                                isCopied = true
                                DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                                    isCopied = false
                                }
                            } label: {
                                Label(isCopied ? "Copied to Clipboard" : "Copy Phrase", systemImage: isCopied ? "checkmark" : "doc.on.doc")
                            }
                            .buttonStyle(.bordered)
                        }

                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 120, maximum: 160), spacing: 10)], spacing: 10) {
                            ForEach(Array(words.enumerated()), id: \.offset) { index, word in
                                HStack {
                                    Text("\(index + 1).")
                                        .font(.caption2.monospaced())
                                        .foregroundStyle(.secondary)
                                    Text(word)
                                        .font(.body.monospaced())
                                    Spacer()
                                }
                                .padding(10)
                                .background(Color.secondary.opacity(0.06), in: RoundedRectangle(cornerRadius: 6))
                            }
                        }
                    }
                }
            }
            .padding(20)
        }
        .onAppear {
            if generatedPhrase.isEmpty {
                generatePhrase()
            }
        }
    }

    private func generatePhrase() {
        let phrase = appState.core.randomMnemonic(wordCount: wordCount)
        self.generatedPhrase = phrase
        self.words = phrase.components(separatedBy: .whitespaces)
        appState.log(tool: "randomizer", summary: "Generated \(wordCount)-word mnemonic")
    }
}
