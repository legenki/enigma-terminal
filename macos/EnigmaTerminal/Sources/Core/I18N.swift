import Foundation

public enum I18N {
    public static func t(_ key: String, lang: String) -> String {
        let code = lang.lowercased()
        if let dict = strings[key], let val = dict[code] ?? dict["en"] {
            return val
        }
        return key
    }

    private static let strings: [String: [String: String]] = [
        // Sections
        "projects": [
            "en": "PROJECTS / WORKSPACE",
            "ru": "ПРОЕКТЫ / РАБОЧИЙ СТОЛ",
            "es": "PROYECTOS / ESPACIO",
            "pt": "PROJETOS / ESPAÇO"
        ],
        "crypto": [
            "en": "CRYPTOGRAPHY",
            "ru": "КРИПТОГРАФИЯ",
            "es": "CRIPTOGRAFÍA",
            "pt": "CRIPTOGRAFIA"
        ],
        "investigation": [
            "en": "INVESTIGATION",
            "ru": "РАССЛЕДОВАНИЕ",
            "es": "INVESTIGACIÓN",
            "pt": "INVESTIGAÇÃO"
        ],

        // Sidebar panel titles & subtitles
        "terminal": [
            "en": "enigma-terminal",
            "ru": "enigma-терминал",
            "es": "enigma-terminal",
            "pt": "enigma-terminal"
        ],
        "terminalSub": [
            "en": "main ★ · live feed",
            "ru": "main ★ · поток команд",
            "es": "main ★ · consola en vivo",
            "pt": "main ★ · console ao vivo"
        ],
        "cases": [
            "en": "Case Files",
            "ru": "Дела расследований",
            "es": "Casos",
            "pt": "Casos"
        ],
        "casesSub": [
            "en": "Act 1 & 2 · 8 cases",
            "ru": "Акт 1 и 2 · 8 дел",
            "es": "Acto 1 y 2 · 8 casos",
            "pt": "Ato 1 e 2 · 8 casos"
        ],
        "contracts": [
            "en": "Contracts Board",
            "ru": "Доска контрактов",
            "es": "Tablero de contratos",
            "pt": "Quadro de contratos"
        ],
        "contractsSub": [
            "en": "8 employers · 256 jobs",
            "ru": "8 нанимателей · 256 задач",
            "es": "8 clientes · 256 tareas",
            "pt": "8 clientes · 256 tarefas"
        ],
        "acta": [
            "en": "Acta Records",
            "ru": "Записи Акта",
            "es": "Registros del Acta",
            "pt": "Registros da Ata"
        ],
        "actaSub": [
            "en": "Caja book · wet papers",
            "ru": "Книга Кахи · бумаги",
            "es": "Libro de la Caja · actas",
            "pt": "Livro da Caixa · atas"
        ],
        "decrypt": [
            "en": "Decrypt & Derive",
            "ru": "Дешифровка и вывод",
            "es": "Descifrado y derivación",
            "pt": "Decifração e derivação"
        ],
        "decryptSub": [
            "en": "BIP-39 / BIP-32 / secp",
            "ru": "BIP-39 / BIP-32 / secp",
            "es": "BIP-39 / BIP-32 / secp",
            "pt": "BIP-39 / BIP-32 / secp"
        ],
        "ledger": [
            "en": "Ledger Sync",
            "ru": "Леджер и баланс",
            "es": "Sincronizar libro mayor",
            "pt": "Sincronizar livro-razão"
        ],
        "ledgerSub": [
            "en": "UTXO & balance probes",
            "ru": "Балансы и адреса UTXO",
            "es": "Saldos y UTXO",
            "pt": "Saldos e UTXO"
        ],
        "explorer": [
            "en": "Live Explorer",
            "ru": "Обозреватель цепи",
            "es": "Explorador de la cadena",
            "pt": "Explorador da cadeia"
        ],
        "explorerSub": [
            "en": "blockchain · mempool",
            "ru": "блокчейн · мемпул",
            "es": "cadena · mempool",
            "pt": "cadeia · mempool"
        ],
        "randomizer": [
            "en": "Randomizer",
            "ru": "Рандомайзер",
            "es": "Aleatorio",
            "pt": "Aleatório"
        ],
        "randomizerSub": [
            "en": "CSPRNG entropy rolls",
            "ru": "Криптостойкая энтропия",
            "es": "Entropía CSPRNG",
            "pt": "Entropia CSPRNG"
        ],
        "nameforge": [
            "en": "Nameforge",
            "ru": "Неймфордж",
            "es": "Nameforge",
            "pt": "Nameforge"
        ],
        "nameforgeSub": [
            "en": "1<Name> vanity stamps",
            "ru": "Штампы адресов 1<Имя>",
            "es": "Estampas 1<Nombre>",
            "pt": "Estampas 1<Nome>"
        ],
        "journal": [
            "en": "Audit Journal",
            "ru": "Журнал аудита",
            "es": "Diario de auditoría",
            "pt": "Diário de auditoria"
        ],
        "journalSub": [
            "en": "recorded actions",
            "ru": "записи расследования",
            "es": "acciones registradas",
            "pt": "ações registradas"
        ],
        "about": [
            "en": "System & About",
            "ru": "О программе",
            "es": "Acerca de",
            "pt": "Sobre"
        ],
        "aboutSub": [
            "en": "macOS 26 Native HIG",
            "ru": "Нативный интерфейс macOS",
            "es": "Nativo macOS",
            "pt": "Nativo macOS"
        ],

        // Toolbar
        "engineActive": [
            "en": "1 engine active",
            "ru": "1 движок активен",
            "es": "1 motor activo",
            "pt": "1 motor ativo"
        ],

        // Contracts
        "phase": [
            "en": "PHASE:",
            "ru": "ФАЗА:",
            "es": "FASE:",
            "pt": "FASE:"
        ],
        "openDossier": [
            "en": "Open Dossier",
            "ru": "Открыть досье",
            "es": "Abrir expediente",
            "pt": "Abrir dossiê"
        ],
        "available": [
            "en": "AVAILABLE",
            "ru": "ДОСТУПЕН",
            "es": "DISPONIBLE",
            "pt": "DISPONÍVEL"
        ],
        "solved": [
            "en": "SOLVED",
            "ru": "РЕШЕНО",
            "es": "RESUELTO",
            "pt": "RESOLVIDO"
        ],
        "briefing": [
            "en": "BRIEFING & BACKGROUND",
            "ru": "БРИФИНГ И КОНТЕКСТ",
            "es": "INFORME Y CONTEXTO",
            "pt": "BRIEFING E CONTEXTO"
        ],
        "evidence": [
            "en": "FORENSIC EVIDENCE & CLUES",
            "ru": "УЛИКИ И ПОДСКАЗКИ",
            "es": "EVIDENCIAS Y PISTAS",
            "pt": "EVIDÊNCIAS E PISTAS"
        ],
        "decryptFile": [
            "en": "DECRYPT & FILE CONTRACT",
            "ru": "РАСШИФРОВАТЬ И СДАТЬ",
            "es": "DESCIFRAR Y ENTREGAR",
            "pt": "DECIFRAR E ENTREGAR"
        ],
        "contractClosed": [
            "en": "CONTRACT SOLVED & CLOSED",
            "ru": "КОНТРАКТ УСПЕШНО ЗАКРЫТ",
            "es": "CONTRATO RESUELTO Y CERRADO",
            "pt": "CONTRATO RESOLVIDO E FECHADO"
        ],
        "enterSolution": [
            "en": "Enter 12-word recovery seed phrase or hex solution...",
            "ru": "Введите 12 слов мнемоники или hex решение...",
            "es": "Introduce la frase semilla o solución hex...",
            "pt": "Insira a frase semente ou solução hex..."
        ],
        "verifySolve": [
            "en": "Verify & Solve",
            "ru": "Проверить решение",
            "es": "Verificar y resolver",
            "pt": "Verificar e resolver"
        ],

        // Cases
        "campaignActs": [
            "en": "CAMPAIGN ACTS",
            "ru": "ДЕЛА КАМПАНИИ",
            "es": "ACTOS DE CAMPAÑA",
            "pt": "ATOS DE CAMPANHA"
        ],
        "closed": [
            "en": "Closed",
            "ru": "Закрыто",
            "es": "Cerrados",
            "pt": "Fechados"
        ],
        "active": [
            "en": "ACTIVE",
            "ru": "В РАБОТЕ",
            "es": "ACTIVO",
            "pt": "ATIVO"
        ],
        "difficulty": [
            "en": "Difficulty",
            "ru": "Сложность",
            "es": "Dificultad",
            "pt": "Dificuldade"
        ],
        "verifyClose": [
            "en": "Verify & Close Wallet",
            "ru": "Проверить и закрыть кошелёк",
            "es": "Verificar y cerrar cartera",
            "pt": "Verificar e fechar carteira"
        ],
        "fillTestVector": [
            "en": "Fill Test Vector",
            "ru": "Тестовый вектор",
            "es": "Vector de prueba",
            "pt": "Vetor de teste"
        ],
        "walletDrained": [
            "en": "WALLET DRAINED & CLOSED",
            "ru": "КОШЕЛЁК ОПУСТОШЁН И ЗАКРЫТ",
            "es": "CARTERA VACIADA Y CERRADA",
            "pt": "CARTEIRA ESVAZIADA E FECHADA"
        ],

        // Inspector tabs
        "tabWordlist": [
            "en": "Wordlist",
            "ru": "Словарь",
            "es": "Palabras",
            "pt": "Palavras"
        ],
        "tabRecovery": [
            "en": "Recovery",
            "ru": "Поиск (?)",
            "es": "Recuperar",
            "pt": "Recuperar"
        ],
        "tabChain": [
            "en": "Chain",
            "ru": "Сеть",
            "es": "Cadena",
            "pt": "Cadeia"
        ],
        "tabJournal": [
            "en": "Journal",
            "ru": "Журнал",
            "es": "Diario",
            "pt": "Diário"
        ],
        "filterPlaceholder": [
            "en": "Filter BIP-39 words or indices...",
            "ru": "Поиск слов или номеров BIP-39...",
            "es": "Filtrar palabras o índices...",
            "pt": "Filtrar palavras ou índices..."
        ],

        // Terminal
        "questTab": [
            "en": "Enigma Terminal Quest",
            "ru": "Терминал расследования",
            "es": "Terminal de investigación",
            "pt": "Terminal de investigação"
        ],
        "chainTab": [
            "en": "Live Bitcoin Chain",
            "ru": "Живая сеть Bitcoin",
            "es": "Red Bitcoin en vivo",
            "pt": "Rede Bitcoin ao vivo"
        ],
        "cmdPlaceholder": [
            "en": "Type command (HELP, DECRYPT, WORD, FIND, STATUS)...",
            "ru": "Введите команду (HELP, DECRYPT, WORD, FIND, STATUS)...",
            "es": "Escribe un comando...",
            "pt": "Digite um comando..."
        ],
        "mainnetLive": [
            "en": "Mainnet Live",
            "ru": "Сеть активна",
            "es": "Red en vivo",
            "pt": "Rede ativa"
        ],

        // Card Titles in ContentView
        "cardTerminal": [
            "en": "Terminal Console",
            "ru": "Консоль терминала",
            "es": "Consola de terminal",
            "pt": "Console do terminal"
        ],
        "cardCases": [
            "en": "Case Files & Briefings",
            "ru": "Материалы расследований",
            "es": "Archivos de casos",
            "pt": "Arquivos de casos"
        ],
        "cardContracts": [
            "en": "Contracts Matrix (256 Tasks)",
            "ru": "Матрица контрактов (256 задач)",
            "es": "Matriz de contratos (256 tareas)",
            "pt": "Matriz de contratos (256 tarefas)"
        ],
        "cardDecrypt": [
            "en": "Cryptographic Key Derivation",
            "ru": "Деривация криптографических ключей",
            "es": "Derivación de claves criptográficas",
            "pt": "Derivação de chaves criptográficas"
        ],
        "cardExplorer": [
            "en": "Bitcoin Blockchain Explorer",
            "ru": "Обозреватель блокчейна Bitcoin",
            "es": "Explorador de la cadena Bitcoin",
            "pt": "Explorador da cadeia Bitcoin"
        ],
        "cardRandomizer": [
            "en": "CSPRNG Entropy Generator",
            "ru": "Генератор криптостойкой энтропии",
            "es": "Generador de entropía CSPRNG",
            "pt": "Gerador de entropia CSPRNG"
        ],
        "cardNameforge": [
            "en": "Nameforge Vanity Generator",
            "ru": "Генератор красивых адресов Nameforge",
            "es": "Generador de direcciones Nameforge",
            "pt": "Gerador de endereços Nameforge"
        ],
        "cardJournal": [
            "en": "Investigation Audit Journal",
            "ru": "Журнал аудита расследования",
            "es": "Diario de auditoría de la investigación",
            "pt": "Diário de auditoria da investigação"
        ],
        "cardAbout": [
            "en": "About Enigma Terminal",
            "ru": "О программе Enigma Terminal",
            "es": "Acerca de Enigma Terminal",
            "pt": "Sobre o Enigma Terminal"
        ]
    ]
}
