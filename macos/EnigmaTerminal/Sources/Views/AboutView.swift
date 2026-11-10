import SwiftUI
import AppKit

public struct AboutView: View {
    public init() {}

    public var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                Image(nsImage: NSApp.applicationIconImage)
                    .resizable()
                    .frame(width: 96, height: 96)
                    .clipShape(RoundedRectangle(cornerRadius: 20))
                    .shadow(radius: 6)

                VStack(spacing: 4) {
                    Text("ENIGMA TERMINAL")
                        .font(.title.bold())
                    Text("Version 3.1.0 · macOS 26+ Native Edition")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                Text("A detective quest played against the live Bitcoin network.\nBuenos Aires, now — or a version of now.")
                    .multilineTextAlignment(.center)
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: 480)

                Divider()
                    .frame(maxWidth: 440)

                VStack(alignment: .leading, spacing: 10) {
                    Label("100% Native macOS 26 HIG User Interface", systemImage: "macwindow")
                    Label("BIP-39 / BIP-32 / secp256k1 Bit-for-Bit Verified Cryptography", systemImage: "lock.shield.fill")
                    Label("Live Bitcoin Network Blockchain Explorer Integration", systemImage: "network")
                    Label("256 Machine-Verified Forensic Contracts Across 8 Employers", systemImage: "checkerboard.rectangle")
                }
                .font(.subheadline)
                .frame(maxWidth: 440, alignment: .leading)

                HStack(spacing: 16) {
                    Link(destination: URL(string: "https://github.com/legenki/enigma-terminal")!) {
                        Label("GitHub Repository", systemImage: "arrow.up.right.square")
                    }
                    .buttonStyle(.bordered)

                    Link(destination: URL(string: "https://legenki.github.io/enigma-terminal/")!) {
                        Label("Web Edition", systemImage: "globe")
                    }
                    .buttonStyle(.bordered)
                }
            }
            .padding(32)
            .frame(maxWidth: .infinity)
        }
    }
}
