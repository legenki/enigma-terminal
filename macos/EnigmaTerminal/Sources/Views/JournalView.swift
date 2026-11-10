import SwiftUI

public struct JournalView: View {
    @EnvironmentObject private var appState: AppState

    @State private var filterQuery: String = ""

    public init() {}

    private var filteredJournal: [JournalItem] {
        if filterQuery.isEmpty {
            return appState.journal
        }
        return appState.journal.filter {
            $0.tool.localizedCaseInsensitiveContains(filterQuery) ||
            $0.summary.localizedCaseInsensitiveContains(filterQuery)
        }
    }

    public var body: some View {
        VStack(spacing: 0) {
            // Header bar
            HStack {
                TextField("Filter journal entries...", text: $filterQuery)
                    .textFieldStyle(.roundedBorder)
                    .frame(maxWidth: 300)

                Spacer()

                Button("Purge Journal") {
                    appState.journal.removeAll { !$0.isPinned }
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
            }
            .padding(14)
            .background(Color.secondary.opacity(0.06))

            Divider()

            if filteredJournal.isEmpty {
                VStack(spacing: 8) {
                    Spacer()
                    Image(systemName: "book.closed")
                        .font(.system(size: 36))
                        .foregroundStyle(.tertiary)
                    Text("No journal records match the filter")
                        .foregroundStyle(.secondary)
                    Spacer()
                }
            } else {
                List {
                    ForEach(filteredJournal) { item in
                        HStack(alignment: .center, spacing: 12) {
                            Text(item.tool.uppercased())
                                .font(.caption2.bold().monospaced())
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color.secondary.opacity(0.15), in: RoundedRectangle(cornerRadius: 4))
                                .foregroundStyle(.cyan)

                            VStack(alignment: .leading, spacing: 2) {
                                Text(item.summary)
                                    .font(.body)
                                Text(item.timestamp, style: .time)
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }

                            Spacer()

                            Button {
                                if let idx = appState.journal.firstIndex(where: { $0.id == item.id }) {
                                    appState.journal[idx].isPinned.toggle()
                                }
                            } label: {
                                Image(systemName: item.isPinned ? "pin.fill" : "pin")
                                    .foregroundStyle(item.isPinned ? Color.orange : Color.secondary)
                            }
                            .buttonStyle(.plain)
                        }
                        .padding(.vertical, 4)
                    }
                }
                .listStyle(.inset)
            }
        }
    }
}
