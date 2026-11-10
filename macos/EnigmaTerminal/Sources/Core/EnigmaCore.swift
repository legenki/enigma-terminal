import Foundation
import JavaScriptCore
import CryptoKit

public final class EnigmaCore: @unchecked Sendable {
    public static let shared = EnigmaCore()

    private let jsContext: JSContext
    private let bridge: JSValue?
    private let queue = DispatchQueue(label: "com.enigmaterminal.core", qos: .userInitiated)

    public init() {
        let ctx = JSContext() ?? JSContext(virtualMachine: JSVirtualMachine())!
        self.jsContext = ctx

        // Locate bundled enigma_engine.js
        let bundle = Bundle.main
        var engineURL = bundle.url(forResource: "enigma_engine", withExtension: "js")

        if engineURL == nil {
            let fallback = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
                .appendingPathComponent("macos/EnigmaTerminal/Resources/enigma_engine.js")
            if FileManager.default.fileExists(atPath: fallback.path) {
                engineURL = fallback
            }
        }

        if let url = engineURL, let script = try? String(contentsOf: url, encoding: .utf8) {
            ctx.evaluateScript(script)
            self.bridge = ctx.objectForKeyedSubscript("EnigmaBridge")
        } else {
            self.bridge = nil
        }
    }

    public func validate(mnemonic: String) -> ValidationResult {
        return queue.sync {
            guard let bridge = self.bridge else {
                return ValidationResult(isValid: false, isChecksumValid: false, words: [], errorMessage: "Core engine unavailable")
            }

            guard let val = bridge.objectForKeyedSubscript("validateMnemonic")
                .call(withArguments: [mnemonic]),
                let jsonStr = val.toString(),
                let data = jsonStr.data(using: .utf8),
                let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                return ValidationResult(isValid: false, isChecksumValid: false, words: [], errorMessage: "Parse error")
            }

            let valid = json["valid"] as? Bool ?? false
            let checksum = json["checksum"] as? Bool ?? false
            let words = json["words"] as? [String] ?? []
            let error = json["error"] as? String

            return ValidationResult(isValid: valid, isChecksumValid: checksum, words: words, errorMessage: error)
        }
    }

    public func derive(mnemonic: String) -> [DerivedAddress] {
        return queue.sync {
            guard let bridge = self.bridge else { return [] }

            guard let val = bridge.objectForKeyedSubscript("deriveWallet")
                .call(withArguments: [mnemonic]),
                let jsonStr = val.toString(),
                let data = jsonStr.data(using: .utf8),
                let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                let addresses = json["addresses"] as? [[String: Any]] else {
                return []
            }

            return addresses.compactMap { entry in
                guard let addr = entry["address"] as? String,
                      let path = entry["path"] as? String,
                      let scriptType = entry["scriptType"] as? String else {
                    return nil
                }
                let purpose = entry["purpose"] as? Int ?? 44
                let label: String
                switch purpose {
                case 44: label = "Legacy (P2PKH)"
                case 49: label = "Nested SegWit (P2SH)"
                case 84: label = "Native SegWit (Bech32)"
                default: label = "BIP-\(purpose)"
                }
                return DerivedAddress(label: label, derivationPath: path, address: addr, scriptType: scriptType)
            }
        }
    }

    public func computeFingerprint(phrase: String) -> String {
        let normalized = phrase.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            .components(separatedBy: .whitespacesAndNewlines)
            .filter { !$0.isEmpty }
            .joined(separator: " ")
        let hash = SHA256.hash(data: Data(normalized.utf8))
        return hash.map { String(format: "%02x", $0) }.joined()
    }

    public func verifySolution(phrase: String, expectedFingerprint: String) -> Bool {
        return computeFingerprint(phrase: phrase) == expectedFingerprint.lowercased()
    }

    public func complete(pattern: String) -> (position: Int, candidates: [String]) {
        return queue.sync {
            guard let bridge = self.bridge else { return (-1, []) }

            guard let val = bridge.objectForKeyedSubscript("completeMnemonic")
                .call(withArguments: [pattern]),
                let jsonStr = val.toString(),
                let data = jsonStr.data(using: .utf8),
                let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                return (-1, [])
            }

            let pos = json["position"] as? Int ?? -1
            let candidates = json["candidates"] as? [String] ?? []
            return (pos, candidates)
        }
    }

    public func searchWords(prefix: String, limit: Int = 25) -> [WordEntry] {
        return queue.sync {
            guard let bridge = self.bridge else { return [] }

            guard let val = bridge.objectForKeyedSubscript("searchWords")
                .call(withArguments: [prefix, limit]),
                let jsonStr = val.toString(),
                let data = jsonStr.data(using: .utf8),
                let items = try? JSONSerialization.jsonObject(with: data) as? [[Any]] else {
                return []
            }

            return items.compactMap { item in
                guard item.count == 2,
                      let index = item[0] as? Int,
                      let word = item[1] as? String else { return nil }
                return WordEntry(index: index, word: word)
            }
        }
    }

    public func wordAt(index: Int) -> String? {
        return queue.sync {
            guard let bridge = self.bridge else { return nil }
            let val = bridge.objectForKeyedSubscript("wordAt").call(withArguments: [index])
            guard let str = val?.toString(), str != "undefined", str != "null" else { return nil }
            return str
        }
    }

    public func indexOf(word: String) -> Int {
        return queue.sync {
            guard let bridge = self.bridge else { return -1 }
            let val = bridge.objectForKeyedSubscript("indexOf").call(withArguments: [word])
            return Int(val?.toInt32() ?? -1)
        }
    }

    public func randomMnemonic(wordCount: Int = 12) -> String {
        var words: [String] = []
        for _ in 0..<(wordCount - 1) {
            let rnd = Int.random(in: 1...2048)
            if let w = wordAt(index: rnd) {
                words.append(w)
            } else {
                words.append("abandon")
            }
        }
        words.append("?")
        let (_, candidates) = complete(pattern: words.joined(separator: " "))
        if let last = candidates.randomElement() {
            words[words.count - 1] = last
            return words.joined(separator: " ")
        }
        return "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
    }

    // MARK: - Data Loaders

    private func findDataFile(filename: String) -> URL? {
        // Try Bundle resources
        if let url = Bundle.main.url(forResource: filename, withExtension: "json", subdirectory: "data") {
            return url
        }
        if let url = Bundle.main.url(forResource: filename, withExtension: "json") {
            return url
        }
        // Try file path directly
        let paths = [
            "data/\(filename).json",
            "../data/\(filename).json",
            "Contents/Resources/data/\(filename).json"
        ]
        for p in paths {
            let url = URL(fileURLWithPath: p)
            if FileManager.default.fileExists(atPath: url.path) {
                return url
            }
        }
        return nil
    }

    public func loadClients(lang: String = "en") -> [ClientInfo] {
        guard let url = findDataFile(filename: "clients"),
              let data = try? Data(contentsOf: url),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let list = json["clients"] as? [[String: Any]] else {
            return defaultClients
        }

        return list.compactMap { item in
            guard let slug = item["slug"] as? String,
                  let nameObj = item["name"] as? [String: String],
                  let distObj = item["district"] as? [String: String],
                  let kindObj = item["kind"] as? [String: String] else { return nil }

            let name = nameObj[lang] ?? nameObj["en"] ?? slug.uppercased()
            let district = distObj[lang] ?? distObj["en"] ?? ""
            let kind = kindObj[lang] ?? kindObj["en"] ?? ""
            return ClientInfo(slug: slug, name: name, district: district, kind: kind)
        }
    }

    public func loadCampaignCases(lang: String = "en") -> [CampaignCase] {
        guard let url = findDataFile(filename: "cases"),
              let data = try? Data(contentsOf: url),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let cases = json["cases"] as? [[String: Any]] else {
            return []
        }

        return cases.compactMap { item in
            guard let id = item["id"] as? Int,
                  let codenameObj = item["codename"] as? [String: String],
                  let difficulty = item["difficulty"] as? Int,
                  let fingerprint = item["fingerprint"] as? String,
                  let briefObj = item["brief"] as? [String: Any],
                  let evidenceObj = item["evidence"] as? [String: Any] else { return nil }

            let codename = codenameObj[lang] ?? codenameObj["en"] ?? "CASE #\(id)"
            let briefLines = (briefObj[lang] as? [String]) ?? (briefObj["en"] as? [String]) ?? []
            let evidenceLines = (evidenceObj[lang] as? [String]) ?? (evidenceObj["en"] as? [String]) ?? []

            return CampaignCase(
                id: id,
                codename: codename,
                difficulty: difficulty,
                fingerprint: fingerprint,
                brief: briefLines,
                evidence: evidenceLines
            )
        }
    }

    public func loadContracts(clientSlug: String? = nil, act: Int? = nil, lang: String = "en") -> [ContractCase] {
        guard let url = findDataFile(filename: "contracts"),
              let data = try? Data(contentsOf: url),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let cases = json["cases"] as? [[String: Any]] else {
            return []
        }

        var results: [ContractCase] = []
        for item in cases {
            guard let id = item["id"] as? Int,
                  let client = item["client"] as? String,
                  let a = item["act"] as? Int,
                  let archetype = item["archetype"] as? String,
                  let difficulty = item["difficulty"] as? Int,
                  let fingerprint = item["fingerprint"] as? String,
                  let codenameObj = item["codename"] as? [String: String],
                  let briefObj = item["brief"] as? [String: Any],
                  let evidenceObj = item["evidence"] as? [String: Any] else { continue }

            if let cs = clientSlug, client.lowercased() != cs.lowercased() {
                continue
            }
            if let targetAct = act, a != targetAct {
                continue
            }

            let codename = codenameObj[lang] ?? codenameObj["en"] ?? "CONTRACT #\(id)"
            let briefLines = (briefObj[lang] as? [String]) ?? (briefObj["en"] as? [String]) ?? []
            let evidenceLines = (evidenceObj[lang] as? [String]) ?? (evidenceObj["en"] as? [String]) ?? []

            results.append(ContractCase(
                id: id,
                client: client,
                act: a,
                archetype: archetype,
                difficulty: difficulty,
                fingerprint: fingerprint,
                codename: codename,
                brief: briefLines,
                evidence: evidenceLines
            ))
        }

        return results
    }

    private var defaultClients: [ClientInfo] {
        [
            ClientInfo(slug: "escribania", name: "ESCRIBANÍA CERO", district: "Microcentro, La City", kind: "private forensic bureau"),
            ClientInfo(slug: "martillero", name: "MARTILLERO", district: "Recoleta", kind: "grey fund, auction house"),
            ClientInfo(slug: "bajofondo", name: "BAJOFONDO", district: "Dársena Sur", kind: "subsea data havens"),
            ClientInfo(slug: "cruz", name: "CRUZ DEL SUR", district: "Paseo Colón", kind: "orbital key custody"),
            ClientInfo(slug: "sanatorio", name: "SANATORIO NORTE", district: "Barrio Norte", kind: "biotech and body-lease clinics"),
            ClientInfo(slug: "mesa", name: "MESA DE ENTRADAS", district: "Balvanera", kind: "residual state agency"),
            ClientInfo(slug: "salar", name: "SALAR", district: "Catalinas Norte", kind: "mineral and energy conglomerate"),
            ClientInfo(slug: "aleph", name: "ALEPH", district: "San Telmo", kind: "archivist collective")
        ]
    }
}
