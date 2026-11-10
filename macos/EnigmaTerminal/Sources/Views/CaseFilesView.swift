import SwiftUI

public struct CaseFilesView: View {
    @EnvironmentObject private var appState: AppState

    @State private var cases: [CaseRecord] = [
        CaseRecord(
            id: "W1",
            title: "Wallet 1: The Zero Vault",
            district: "Microcentro, La City",
            employer: "ESCRIBANÍA CERO",
            brief: "The sudestada has not let up in eighteen days, Microcentro is ankle-deep. ORACLE called the first wallet his zero vault. A line in his notebook holds not a single complete word."
        ),
        CaseRecord(
            id: "W2",
            title: "Wallet 2: Dársena Sur Haven",
            district: "Dársena Sur",
            employer: "BAJOFONDO",
            brief: "Subsea data havens along the dock. Water level sensors reading high tide. Two transactions recorded at midnight."
        ),
        CaseRecord(
            id: "W3",
            title: "Wallet 3: Grey Fund Auction",
            district: "Recoleta",
            employer: "MARTILLERO",
            brief: "Lot 2048: a private key split across sixteen catalogue descriptions. The gavel lands on the first block."
        ),
        CaseRecord(
            id: "W4",
            title: "Wallet 4: Orbital Key Custody",
            district: "Paseo Colón",
            employer: "CRUZ DEL SUR",
            brief: "Satellite downlink telemetry decoded into 128 bits of raw entropy. Three relays confirmed the timestamp."
        )
    ]

    @State private var selectedCaseID: String?

    public init() {}

    private var activeCase: CaseRecord? {
        if let id = selectedCaseID, let found = cases.first(where: { $0.id == id }) {
            return found
        }
        return cases.first
    }

    public var body: some View {
        HSplitView {
            List(cases, selection: $selectedCaseID) { c in
                VStack(alignment: .leading, spacing: 4) {
                    Text(c.title)
                        .font(.headline)
                    Text(c.district)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text(c.employer)
                        .font(.caption2.bold())
                        .foregroundStyle(.cyan)
                }
                .padding(.vertical, 4)
                .tag(c.id)
            }
            .frame(minWidth: 220, idealWidth: 260, maxWidth: 320)

            if let active = activeCase {
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(active.title)
                                    .font(.title.bold())
                                Text("\(active.district) · \(active.employer)")
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Label(active.solved ? "CLOSED" : "OPEN", systemImage: active.solved ? "lock.fill" : "lock.open")
                                .font(.caption.bold())
                                .padding(.horizontal, 10)
                                .padding(.vertical, 5)
                                .background(active.solved ? Color.green.opacity(0.15) : Color.orange.opacity(0.15), in: Capsule())
                                .foregroundStyle(active.solved ? .green : .orange)
                        }

                        Divider()

                        GroupBox("Briefing") {
                            Text(active.brief)
                                .font(.body)
                                .padding(8)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }

                        GroupBox("Submit Phrase to Close Wallet") {
                            HStack {
                                TextField("12-word recovery mnemonic...", text: .constant(""))
                                    .textFieldStyle(.roundedBorder)
                                Button("Verify") {
                                    appState.log(tool: "cases", summary: "Submitted solution attempt for \(active.id)")
                                }
                                .buttonStyle(.borderedProminent)
                            }
                            .padding(8)
                        }
                    }
                    .padding(20)
                }
                .frame(minWidth: 440)
            } else {
                Text("Select a case file")
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
    }
}
