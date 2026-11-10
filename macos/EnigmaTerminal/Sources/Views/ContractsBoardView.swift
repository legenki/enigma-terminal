import SwiftUI

public struct ContractsBoardView: View {
    @EnvironmentObject private var appState: AppState

    private let employers = [
        "ESCRIBANÍA CERO", "MARTILLERO", "BAJOFONDO", "CRUZ DEL SUR",
        "SANATORIO NORTE", "MESA DE ENTRADAS", "SALAR", "ALEPH"
    ]

    @State private var selectedEmployer: String = "ESCRIBANÍA CERO"
    @State private var selectedPhase: Int = 1

    public init() {}

    public var body: some View {
        VStack(spacing: 0) {
            // Employer Selector & Phase
            HStack(spacing: 16) {
                Picker("Employer", selection: $selectedEmployer) {
                    ForEach(employers, id: \.self) { emp in
                        Text(emp).tag(emp)
                    }
                }
                .frame(maxWidth: 260)

                Picker("Phase", selection: $selectedPhase) {
                    Text("Phase I (Contracts 1-8)").tag(1)
                    Text("Phase II (Contracts 9-16)").tag(2)
                    Text("Phase III (Contracts 17-24)").tag(3)
                    Text("Phase IV (Contracts 25-32)").tag(4)
                }
                .pickerStyle(.segmented)
                .frame(maxWidth: 400)

                Spacer()
            }
            .padding(14)
            .background(Color.secondary.opacity(0.06))

            Divider()

            // Contracts Grid
            ScrollView {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 240, maximum: 300), spacing: 14)], spacing: 14) {
                    ForEach(1...8, id: \.self) { idx in
                        let contractNum = (selectedPhase - 1) * 8 + idx
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Text("#\(contractNum)")
                                    .font(.caption.monospaced().bold())
                                    .foregroundStyle(.cyan)
                                Spacer()
                                Text("Available")
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }

                            Text("Contract \(selectedEmployer.prefix(4))-\(contractNum)")
                                .font(.headline)

                            Text("Handwriting scheme: Index Math & Unique Prefix. Machine-verified solvable.")
                                .font(.caption)
                                .foregroundStyle(.secondary)

                            HStack {
                                Spacer()
                                Button("Open Dossier") {
                                    appState.log(tool: "contracts", summary: "Opened contract #\(contractNum) for \(selectedEmployer)")
                                }
                                .buttonStyle(.bordered)
                                .controlSize(.small)
                            }
                        }
                        .padding(12)
                        .background(Color.secondary.opacity(0.05), in: RoundedRectangle(cornerRadius: 8))
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.secondary.opacity(0.15), lineWidth: 1))
                    }
                }
                .padding(16)
            }
        }
    }
}
