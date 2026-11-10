import Foundation
import JavaScriptCore

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
            // Direct path check during development / tests
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
}
