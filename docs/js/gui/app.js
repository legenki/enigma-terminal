// The GUI front-end. Retro chrome, modern layout — over the same game core the
// command line drives, so progress, journal and rules are shared.
//
// Panels are built once and cached: switching tabs hides a node instead of
// re-rendering it, so a half-typed phrase, a query and its results all survive
// the trip to another tool and back.

import { el, replace, win, section, notice, badge, kv, table, empty } from './dom.js';
import {
  CAMPAIGN_CASES, CLIENTS, LANGS, LANG_NAMES, META, ProgressStore, allCases, caseById, caseForMnemonic,
  caseState, caseload, casesForClient, clientBySlug, completeMnemonic, contractsLoaded,
  isUnlocked, loadContracts, missingRequirements, pick, randomMnemonic,
  searchCases, searchWordlist, MnemonicError,
} from '../core.js';
import { Journal, TOOLS, maskMnemonic } from '../journal.js';
import { deriveWallet } from '../crypto/wallet.js';
import { entropyToMnemonic, mnemonicToEntropy, wordAt, indexOf } from '../crypto/bip39.js';
import { fromHex, toHex } from '../crypto/hash.js';
import { ChainClient, formatBtc, PROVIDERS } from '../chain.js';
import { addressSigil, caseSigil, mnemonicSigil, sigil } from '../identicon.js';
import { icon } from '../vendor/feather.js';

//: `key` still works as a shortcut — it moved off the row and into the row's
//: title, so the sidebar reads as a list of places rather than a numbered menu.
const PANELS = [
  { id: 'terminal', glyph: 'terminal', label: { en: 'Terminal', ru: 'Терминал', es: 'Terminal', pt: 'Terminal' }, key: '1' },
  { id: 'cases', glyph: 'folder', label: { en: 'Case files', ru: 'Дела', es: 'Casos', pt: 'Casos' }, key: '2' },
  { id: 'board', glyph: 'grid', label: { en: 'Contracts', ru: 'Контракты', es: 'Contratos', pt: 'Contratos' }, key: '3' },
  { id: 'decrypt', glyph: 'key', label: { en: 'Decrypt', ru: 'Дешифровка', es: 'Descifrado', pt: 'Decifração' }, key: '4' },
  { id: 'ledger', glyph: 'database', label: { en: 'Ledger', ru: 'Реестр', es: 'Registro', pt: 'Registro' }, key: '5' },
  { id: 'search', glyph: 'search', label: { en: 'Archive', ru: 'Архив дел', es: 'Archivo', pt: 'Arquivo' }, key: '6' },
  { id: 'random', glyph: 'shuffle', label: { en: 'Randomizer', ru: 'Рандомайзер', es: 'Aleatorio', pt: 'Aleatório' }, key: '7' },
  { id: 'journal', glyph: 'bookOpen', label: { en: 'Journal', ru: 'Журнал', es: 'Diario', pt: 'Diário' }, key: '8' },
  { id: 'about', glyph: 'info', label: { en: 'About', ru: 'О программе', es: 'Acerca de', pt: 'Sobre' }, key: '9' },
];

// Every fixed string the GUI shows. Keys carrying {braces} are filled by `tf`.
const T = {
  solved: { en: 'Closed', ru: 'Закрыто', es: 'Cerrado', pt: 'Fechado' },
  open: { en: 'Open', ru: 'Открыто', es: 'Abierto', pt: 'Aberto' },
  locked: { en: 'Locked', ru: 'Заперто', es: 'Bloqueado', pt: 'Bloqueado' },
  closedCount: { en: 'closed', ru: 'закрыто', es: 'cerrados', pt: 'fechados' },
  evidence: { en: 'Evidence', ru: 'Улики', es: 'Pruebas', pt: 'Provas' },
  clues: { en: 'Decoding table', ru: 'Таблица дешифровки', es: 'Tabla de descifrado', pt: 'Tabela de decifração' },
  hints: { en: 'Hints', ru: 'Подсказки', es: 'Pistas', pt: 'Dicas' },
  spendHint: { en: 'Spend a hint', ru: 'Взять подсказку', es: 'Gastar una pista', pt: 'Gastar uma dica' },
  noHints: {
    en: 'No hints left on this case.', ru: 'Подсказки по этому делу закончились.',
    es: 'No quedan pistas en este caso.', pt: 'Não há mais dicas neste caso.',
  },
  submit: { en: 'Submit seed phrase', ru: 'Проверить сид-фразу', es: 'Enviar frase semilla', pt: 'Enviar frase semente' },
  derive: { en: 'Derive', ru: 'Вывести адреса', es: 'Derivar', pt: 'Derivar' },
  epilogue: { en: 'Epilogue', ru: 'Эпилог', es: 'Epílogo', pt: 'Epílogo' },
  lockedMsg: { en: 'Close these cases first:', ru: 'Сначала закрой дела:', es: 'Cierra primero estos casos:', pt: 'Feche estes casos primeiro:' },
  seedLabel: { en: 'Seed phrase (12 words)', ru: 'Сид-фраза (12 слов)', es: 'Frase semilla (12 palabras)', pt: 'Frase semente (12 palavras)' },
  checksumOk: { en: 'Mnemonic checksum valid', ru: 'Контрольная сумма верна', es: 'Suma de comprobación válida', pt: 'Soma de verificação válida' },
  derivation: { en: 'Derivation grid', ru: 'Сетка деривации', es: 'Cuadrícula de derivación', pt: 'Grade de derivação' },
  noWallet: {
    en: 'No seed loaded yet. Derive one in the Decrypt panel first.',
    ru: 'Сид не загружен. Сначала выведи адреса на вкладке «Дешифровка».',
    es: 'Aún no hay semilla cargada. Deriva una en el panel Descifrado.',
    pt: 'Nenhuma semente carregada ainda. Derive uma no painel Decifração.',
  },
  syncOne: { en: 'Query balance', ru: 'Запросить баланс', es: 'Consultar saldo', pt: 'Consultar saldo' },
  sweep: { en: 'Sweep all paths', ru: 'Проверить все пути', es: 'Recorrer todas las rutas', pt: 'Percorrer todas as rotas' },
  txlog: { en: 'Transactions', ru: 'Транзакции', es: 'Transacciones', pt: 'Transações' },
  working: { en: 'Querying the live chain…', ru: 'Запрос к живой сети…', es: 'Consultando la cadena en vivo…', pt: 'Consultando a cadeia ao vivo…' },
  deriving: { en: 'Deriving keys…', ru: 'Вывожу ключи…', es: 'Derivando claves…', pt: 'Derivando chaves…' },
  searching: { en: 'Searching…', ru: 'Ищу…', es: 'Buscando…', pt: 'Buscando…' },
  generate: { en: 'Generate', ru: 'Сгенерировать', es: 'Generar', pt: 'Gerar' },
  words: { en: 'Words', ru: 'Слов', es: 'Palabras', pt: 'Palavras' },
  copy: { en: 'Copy', ru: 'Копировать', es: 'Copiar', pt: 'Copiar' },
  copied: { en: 'Copied', ru: 'Скопировано', es: 'Copiado', pt: 'Copiado' },
  journal: { en: 'Journal', ru: 'Журнал', es: 'Diario', pt: 'Diário' },
  recent: { en: 'Recent', ru: 'Последнее', es: 'Reciente', pt: 'Recente' },
  railTitle: { en: 'Tools', ru: 'Инструменты', es: 'Herramientas', pt: 'Ferramentas' },
  navTitle: { en: 'Desk', ru: 'Стол', es: 'Escritorio', pt: 'Mesa' },
  openJournal: { en: 'Open journal', ru: 'Открыть журнал', es: 'Abrir el diario', pt: 'Abrir o diário' },
  recall: { en: 'Recall', ru: 'Вернуться', es: 'Retomar', pt: 'Retomar' },
  pin: { en: 'Pin', ru: 'Закрепить', es: 'Fijar', pt: 'Fixar' },
  emptyJournal: {
    en: 'Nothing recorded yet. Every derivation, query and search lands here.',
    ru: 'Пока пусто. Сюда попадает каждая деривация, запрос и поиск.',
    es: 'Nada registrado aún. Cada derivación, consulta y búsqueda llega aquí.',
    pt: 'Nada registrado ainda. Cada derivação, consulta e busca chega aqui.',
  },
  maskedNote: {
    en: 'Phrase not stored — the game does not keep unknown seed phrases.',
    ru: 'Фраза не сохранена — игра не хранит незнакомые сид-фразы.',
    es: 'Frase no guardada: el juego no conserva frases semilla desconocidas.',
    pt: 'Frase não guardada: o jogo não conserva frases semente desconhecidas.',
  },
  exportTxt: { en: 'Export', ru: 'Выгрузить', es: 'Exportar', pt: 'Exportar' },
  purge: { en: 'Purge', ru: 'Очистить', es: 'Purgar', pt: 'Purgar' },
  keepPinned: { en: 'Keep pinned', ru: 'Кроме закреплённых', es: 'Salvo las fijadas', pt: 'Exceto as fixadas' },
  all: { en: 'All', ru: 'Все', es: 'Todo', pt: 'Tudo' },
  board: { en: 'Contract board', ru: 'Доска контрактов', es: 'Tablero de contratos', pt: 'Quadro de contratos' },
  clients: { en: 'Clients', ru: 'Заказчики', es: 'Clientes', pt: 'Clientes' },
  dossier: { en: 'Dossier', ru: 'Досье', es: 'Expediente', pt: 'Dossiê' },
  dialect: { en: 'Puzzle dialect', ru: 'Почерк заказчика', es: 'Estilo del cliente', pt: 'Estilo do cliente' },
  loadingBoard: { en: 'Pulling the contract board…', ru: 'Тяну доску контрактов…', es: 'Cargando el tablero de contratos…', pt: 'Carregando o quadro de contratos…' },
  boardOffline: {
    en: 'The contract board did not load. The eight campaign cases still work.',
    ru: 'Доска контрактов не загрузилась. Восемь дел кампании работают.',
    es: 'El tablero de contratos no se cargó. Los ocho casos de la campaña siguen funcionando.',
    pt: 'O quadro de contratos não carregou. Os oito casos da campanha continuam funcionando.',
  },
  acts: { en: 'Acts', ru: 'Фазы', es: 'Fases', pt: 'Fases' },
  backToClients: { en: 'All clients', ru: 'К заказчикам', es: 'A los clientes', pt: 'Aos clientes' },
  campaign: { en: 'ORACLE archive', ru: 'Архив ORACLE', es: 'Archivo ORACLE', pt: 'Arquivo ORACLE' },
  taken: { en: 'Taken contracts', ru: 'Взятые контракты', es: 'Contratos tomados', pt: 'Contratos assumidos' },
  takenNone: {
    en: 'No contracts taken yet. Open one on the board and it lands here.',
    ru: 'Контрактов пока нет. Открой любой на доске — он ляжет сюда.',
    es: 'Aún no hay contratos. Abre uno en el tablero y aparecerá aquí.',
    pt: 'Ainda não há contratos. Abra um no quadro e ele aparecerá aqui.',
  },
  tookIt: { en: 'Taken into work', ru: 'Взято в работу', es: 'Tomado en trabajo', pt: 'Assumido' },
  drop: { en: 'Return to board', ru: 'Вернуть на доску', es: 'Devolver al tablero', pt: 'Devolver ao quadro' },
  openBoard: { en: 'Open the board', ru: 'Открыть доску', es: 'Abrir el tablero', pt: 'Abrir o quadro' },

  // ---- strings the panels used to inline as ru/en ternaries ---------------
  filedWith: {
    en: 'Filed with {client}.', ru: 'Сдано заказчику: {client}.',
    es: 'Entregado al cliente: {client}.', pt: 'Entregue ao cliente: {client}.',
  },
  journalHelp: {
    ru: 'Каждый шаг записывается сюда и переживает перезагрузку страницы. Нажми «Вернуться», чтобы повторить запрос в том же инструменте. Незнакомые сид-фразы записываются в замаскированном виде и на диск не попадают.',
    en: 'Every move lands here and survives a reload. Press Recall to re-run it in the tool that made it. Seed phrases the game does not recognise are recorded masked and never written to disk.',
    es: 'Cada paso se registra aquí y sobrevive a una recarga. Pulsa Retomar para repetirlo en la herramienta que lo hizo. Las frases semilla que el juego no reconoce se registran enmascaradas y nunca llegan al disco.',
    pt: 'Cada passo é registrado aqui e sobrevive a um recarregamento. Toque em Retomar para repeti-lo na ferramenta que o fez. Frases semente que o jogo não reconhece são registradas mascaradas e nunca chegam ao disco.',
  },
  clientsHelp: {
    ru: 'У каждого заказчика свой почерк: он определяет не только тон брифа, но и способ, которым в деле спрятаны слова. Научиться читать заказчика — половина работы.',
    en: 'Every client has a hand of their own: it sets the tone of the brief and, more to the point, the way the words are hidden. Learning to read a client is half the job.',
    es: 'Cada cliente tiene su propia mano: marca el tono del informe y, sobre todo, la manera en que se ocultan las palabras. Aprender a leer a un cliente es la mitad del trabajo.',
    pt: 'Cada cliente tem a sua própria mão: define o tom do informe e, sobretudo, a maneira como as palavras ficam escondidas. Aprender a ler um cliente é metade do trabalho.',
  },
  takenLog: { en: 'Taken', ru: 'Взято', es: 'Tomado', pt: 'Assumido' },
  backToCases: { en: 'All cases', ru: 'К списку', es: 'A los casos', pt: 'Aos casos' },
  seedPlaceholder: {
    en: 'twelve words separated by spaces', ru: 'двенадцать слов через пробел',
    es: 'doce palabras separadas por espacios', pt: 'doze palavras separadas por espaços',
  },
  caseWord: { en: 'Case', ru: 'Дело', es: 'Caso', pt: 'Caso' },
  caseClosed: {
    en: 'Case {id} closed', ru: 'Дело {id} закрыто',
    es: 'Caso {id} cerrado', pt: 'Caso {id} fechado',
  },
  allEightClosed: {
    en: 'All eight cases closed.', ru: 'Все восемь дел закрыты.',
    es: 'Los ocho casos están cerrados.', pt: 'Os oito casos estão fechados.',
  },
  keyToOtherCase: {
    en: 'This is the key to case {id}, not this one.',
    ru: 'Это ключ к делу {id}, а не к этому.',
    es: 'Esta es la clave del caso {id}, no de este.',
    pt: 'Esta é a chave do caso {id}, não deste.',
  },
  validNotThisCase: {
    en: 'Valid phrase, but not the key to this case.',
    ru: 'Фраза валидна, но это не ключ к этому делу.',
    es: 'Frase válida, pero no es la clave de este caso.',
    pt: 'Frase válida, mas não é a chave deste caso.',
  },
  sigilOfPhrase: { en: 'Sigil of this phrase', ru: 'Знак этой фразы', es: 'Sello de esta frase', pt: 'Selo desta frase' },
  keysAndSeed: { en: 'Keys and seed', ru: 'Ключи и сид', es: 'Claves y semilla', pt: 'Chaves e semente' },
  seedOfCase: { en: 'Seed of case {id}', ru: 'Сид дела {id}', es: 'Semilla del caso {id}', pt: 'Semente do caso {id}' },
  fromEntropy: { en: 'From entropy (hex)', ru: 'Из энтропии (hex)', es: 'Desde entropía (hex)', pt: 'A partir da entropia (hex)' },
  entropyPrompt: {
    en: 'Entropy, 32 hex characters:', ru: 'Энтропия, 32 hex-символа:',
    es: 'Entropía, 32 caracteres hex:', pt: 'Entropia, 32 caracteres hex:',
  },
  decryptHelp: {
    ru: 'Проверка идёт по официальному словарю BIP-39 вместе с контрольной суммой. Всё считается здесь, в браузере, и незнакомые фразы в журнал целиком не попадают.',
    en: 'Validated against the official BIP-39 wordlist, checksum included. Everything runs in your browser, and unknown phrases are never written to the journal in full.',
    es: 'Se valida contra la lista oficial BIP-39, suma de comprobación incluida. Todo se calcula en tu navegador, y las frases desconocidas nunca llegan enteras al diario.',
    pt: 'Validado contra a lista oficial BIP-39, soma de verificação incluída. Tudo roda no seu navegador, e frases desconhecidas nunca chegam inteiras ao diário.',
  },
  walletDrained: {
    en: 'Wallet drained. History intact.', ru: 'Кошелёк пуст, но история на месте.',
    es: 'Cartera vaciada. El historial sigue intacto.', pt: 'Carteira esvaziada. O histórico continua intacto.',
  },
  neverUsed: {
    en: 'Address never used on mainnet.', ru: 'Адрес никогда не использовался в основной сети.',
    es: 'La dirección nunca se usó en la red principal.', pt: 'O endereço nunca foi usado na rede principal.',
  },
  openExplorer: {
    en: 'Open in explorer ↗', ru: 'Открыть в эксплорере ↗',
    es: 'Abrir en el explorador ↗', pt: 'Abrir no explorador ↗',
  },
  pathsCarryHistory: {
    en: 'paths carry history', ru: 'путей с историей',
    es: 'rutas con historial', pt: 'rotas com histórico',
  },
  transactionsCount: { en: 'transactions', ru: 'транзакций', es: 'transacciones', pt: 'transações' },
  noTransactions: { en: 'No transactions.', ru: 'Транзакций нет.', es: 'Sin transacciones.', pt: 'Sem transações.' },
  tabWords: { en: 'Wordlist', ru: 'Словарь', es: 'Lista de palabras', pt: 'Lista de palavras' },
  tabArchive: { en: 'Case archive', ru: 'Архив дел', es: 'Archivo de casos', pt: 'Arquivo de casos' },
  tabComplete: { en: 'Missing word', ru: 'Недостающее слово', es: 'Palabra faltante', pt: 'Palavra faltante' },
  wordPlaceholder: {
    en: 'prefix, substring, or an index 1–2048',
    ru: 'начало или часть слова, либо номер 1–2048',
    es: 'prefijo, fragmento o un índice 1–2048',
    pt: 'prefixo, fragmento ou um índice 1–2048',
  },
  typeQuery: { en: 'Type a query.', ru: 'Введи запрос.', es: 'Escribe una consulta.', pt: 'Digite uma consulta.' },
  matches: { en: 'matches', ru: 'совпадений', es: 'coincidencias', pt: 'correspondências' },
  nothingFound: { en: 'Nothing found.', ru: 'Ничего не найдено.', es: 'No se encontró nada.', pt: 'Nada encontrado.' },
  wordlistTitle: { en: 'BIP-39 wordlist', ru: 'Словарь BIP-39', es: 'Lista de palabras BIP-39', pt: 'Lista de palavras BIP-39' },
  wordlistHelp: {
    en: 'Matches by prefix and by substring; a number opens that index.',
    ru: 'Ищет по началу и по вхождению; число открывает слово по индексу.',
    es: 'Busca por prefijo y por fragmento; un número abre esa posición.',
    pt: 'Busca por prefixo e por fragmento; um número abre essa posição.',
  },
  archivePlaceholder: {
    en: 'a word from the briefs, evidence or riddles',
    ru: 'слово из улик, загадок или вводной',
    es: 'una palabra de los informes, pruebas o acertijos',
    pt: 'uma palavra dos informes, provas ou enigmas',
  },
  nothingInArchive: { en: 'Nothing in the archive.', ru: 'В архиве ничего.', es: 'Nada en el archivo.', pt: 'Nada no arquivo.' },
  casesCount: { en: 'case(s)', ru: 'дел', es: 'caso(s)', pt: 'caso(s)' },
  archiveTitle: {
    en: 'Full-text case search', ru: 'Полнотекстовый поиск по делам',
    es: 'Búsqueda de texto completo en los casos', pt: 'Busca de texto completo nos casos',
  },
  archiveHelp: {
    en: 'Epilogues join the index only once a case is closed — otherwise it would spoil them.',
    ru: 'Эпилоги попадают в поиск только после того, как дело закрыто — иначе это спойлер.',
    es: 'Los epílogos entran en el índice sólo cuando el caso está cerrado: de otro modo serían un spoiler.',
    pt: 'Os epílogos entram no índice só quando o caso está fechado: de outro modo seriam um spoiler.',
  },
  candidates: { en: 'candidates', ru: 'кандидатов', es: 'candidatas', pt: 'candidatas' },
  positionCandidates: {
    en: 'Position {position}: {count} words give a valid checksum',
    ru: 'Позиция {position}: {count} слов дают верную контрольную сумму',
    es: 'Posición {position}: {count} palabras dan una suma de comprobación válida',
    pt: 'Posição {position}: {count} palavras dão uma soma de verificação válida',
  },
  checksumCuts: {
    ru: 'Контрольная сумма отсекает примерно пятнадцать шестнадцатых словаря.',
    en: 'The checksum rules out about fifteen sixteenths of the wordlist.',
    es: 'La suma de comprobación descarta cerca de quince dieciseisavos de la lista.',
    pt: 'A soma de verificação descarta cerca de quinze dezesseis avos da lista.',
  },
  oneOpensCase: {
    en: 'One of them opens case {id}', ru: 'Одно из них — ключ к делу {id}',
    es: 'Una de ellas abre el caso {id}', pt: 'Uma delas abre o caso {id}',
  },
  completeTitle: {
    en: 'Missing-word recovery', ru: 'Восстановление недостающего слова',
    es: 'Recuperación de la palabra faltante', pt: 'Recuperação da palavra faltante',
  },
  completeHelp: {
    ru: 'Вставь фразу и поставь ? на месте забытого слова. Инструмент решает ровно одну неизвестную позицию: при двух неизвестных валидных вариантов остаются сотни тысяч, и смысла в списке уже нет.',
    en: 'Paste the phrase and put ? where the word is missing. The tool resolves exactly one unknown position: with two, hundreds of thousands of phrases stay valid and the list stops meaning anything.',
    es: 'Pega la frase y pon ? donde falte la palabra. La herramienta resuelve exactamente una posición desconocida: con dos, cientos de miles de frases siguen siendo válidas y la lista deja de significar nada.',
    pt: 'Cole a frase e ponha ? onde falta a palavra. A ferramenta resolve exatamente uma posição desconhecida: com duas, centenas de milhares de frases continuam válidas e a lista deixa de significar nada.',
  },
  findCandidates: { en: 'Find candidates', ru: 'Найти кандидатов', es: 'Buscar candidatas', pt: 'Buscar candidatas' },
  realWalletTitle: {
    en: 'This is a real wallet', ru: 'Это настоящий кошелёк',
    es: 'Esta es una cartera real', pt: 'Esta é uma carteira real',
  },
  realWalletBody: {
    ru: 'Фраза собрана из криптостойкой случайности браузера и управляет настоящими адресами Bitcoin. Она записана в журнал этого браузера, чтобы к ней можно было вернуться, — и стирается кнопкой «Очистить» в журнале. Не клади на эти адреса деньги.',
    en: 'The phrase comes from your browser’s cryptographic randomness and controls real Bitcoin addresses. It is written to this browser’s journal so you can come back to it, and Purge in the journal erases it. Do not fund these addresses.',
    es: 'La frase proviene de la aleatoriedad criptográfica de tu navegador y controla direcciones Bitcoin reales. Queda escrita en el diario de este navegador para que puedas volver a ella, y Purgar en el diario la borra. No pongas fondos en estas direcciones.',
    pt: 'A frase vem da aleatoriedade criptográfica do seu navegador e controla endereços Bitcoin reais. Fica escrita no diário deste navegador para que você possa voltar a ela, e Purgar no diário a apaga. Não coloque fundos nestes endereços.',
  },
  randomTitle: {
    en: 'Seed phrase generator', ru: 'Генератор сид-фраз',
    es: 'Generador de frases semilla', pt: 'Gerador de frases semente',
  },
  randomHelp: {
    ru: 'Энтропия берётся из crypto.getRandomValues — той же функции, которой пользуются настоящие кошельки. Ничего не отправляется наружу.',
    en: 'Entropy comes from crypto.getRandomValues — the same source real wallets use. Nothing leaves the page.',
    es: 'La entropía viene de crypto.getRandomValues, la misma fuente que usan las carteras reales. Nada sale de la página.',
    pt: 'A entropia vem de crypto.getRandomValues, a mesma fonte que as carteiras reais usam. Nada sai da página.',
  },
};

const ABOUT = {
  ru: [
    'Детективный квест, играющий против настоящей сети Bitcoin.',
    'Мнемоники проверяются по официальному словарю BIP-39 вместе с контрольной суммой, сид получается через PBKDF2-HMAC-SHA512 (2048 раундов), ключи выводятся на кривой secp256k1 по BIP-32, а балансы приходят живыми запросами к публичным эксплорерам.',
    'Вся криптография работает в браузере. Наружу уходит только запрос адреса — в нём нет ничего, кроме самого адреса.',
    'Журнал расследования хранится в этом браузере. Сид-фразы, которых игра не знает, записываются в него замаскированными и на диск не попадают.',
    'Ответы восьми дел — опубликованные тестовые векторы BIP-39. Их ключи известны всему миру, красть там нечего, зато история в блокчейне настоящая.',
    'Программа не умеет подбирать чужие кошельки. Никогда не вводи в программы — включая эту — сид-фразу от кошелька с реальными деньгами.',
  ],
  en: [
    'A detective quest played against the real Bitcoin network.',
    'Mnemonics are checked against the official BIP-39 wordlist including the checksum, seeds come from PBKDF2-HMAC-SHA512 over 2048 rounds, keys are derived over secp256k1 through BIP-32, and balances arrive from live calls to public explorers.',
    'All the cryptography runs in your browser. The only thing that leaves the page is an address lookup, which carries nothing but the address.',
    'The investigation journal lives in this browser. Seed phrases the game does not recognise are recorded masked and never written to disk.',
    'The eight case answers are published BIP-39 test vectors. Their keys are known worldwide, so there is nothing to steal — but the on-chain history is genuine.',
    'This program cannot crack anyone’s wallet. Never type a seed phrase that controls real funds into any program, including this one.',
  ],
  es: [
    'Una aventura detectivesca jugada contra la red Bitcoin real.',
    'Las mnemónicas se verifican contra la lista oficial BIP-39, suma de comprobación incluida; la semilla sale de PBKDF2-HMAC-SHA512 con 2048 rondas, las claves se derivan sobre secp256k1 mediante BIP-32, y los saldos llegan por consultas en vivo a exploradores públicos.',
    'Toda la criptografía corre en tu navegador. Lo único que sale de la página es una consulta de dirección, que no lleva nada más que la dirección.',
    'El diario de investigación vive en este navegador. Las frases semilla que el juego no reconoce se registran enmascaradas y nunca llegan al disco.',
    'Las respuestas de los ocho casos son vectores de prueba BIP-39 publicados. Sus claves son conocidas en todo el mundo, así que no hay nada que robar, pero el historial en la cadena es auténtico.',
    'Este programa no puede forzar la cartera de nadie. Nunca escribas en un programa —tampoco en este— una frase semilla que controle fondos reales.',
  ],
  pt: [
    'Uma aventura de detetive jogada contra a rede Bitcoin real.',
    'As mnemônicas são verificadas contra a lista oficial BIP-39, soma de verificação incluída; a semente sai de PBKDF2-HMAC-SHA512 com 2048 rodadas, as chaves são derivadas sobre secp256k1 por BIP-32, e os saldos chegam por consultas ao vivo a exploradores públicos.',
    'Toda a criptografia roda no seu navegador. A única coisa que sai da página é uma consulta de endereço, que não carrega nada além do endereço.',
    'O diário de investigação vive neste navegador. Frases semente que o jogo não reconhece são registradas mascaradas e nunca chegam ao disco.',
    'As respostas dos oito casos são vetores de teste BIP-39 publicados. Suas chaves são conhecidas no mundo todo, então não há nada a roubar, mas o histórico na cadeia é autêntico.',
    'Este programa não consegue quebrar a carteira de ninguém. Nunca digite em um programa — nem neste — uma frase semente que controle fundos reais.',
  ],
};

const t = (key, lang) => T[key][lang] || T[key].en;

/** Same as `t`, with {placeholders} filled in. */
const tf = (key, lang, fields = {}) => Object.entries(fields)
  .reduce((line, [name, value]) => line.split(`{${name}}`).join(value), t(key, lang));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clock = (at) => new Date(at).toTimeString().slice(0, 8);

export class GuiApp {
  constructor(root, {
    lang = 'ru', onLangChange = null, terminalHost = null, onTerminalShown = null,
  } = {}) {
    this.root = root;
    this.lang = lang;
    this.onLangChange = onLangChange;
    //: The terminal's canvas is built once, outside the GUI, and adopted by
    //: its panel. Rebuilding it would throw away the scrollback.
    this.terminalHost = terminalHost;
    this.onTerminalShown = onTerminalShown;
    this.progress = new ProgressStore();
    this.journal = new Journal();
    this.chain = new ChainClient();
    this.panel = 'cases';
    this.activeCaseId = null;
    this.activeClient = null;
    this.wallet = null;
    this.railOpen = true;
    this.panels = new Map();     // key -> { node, api }
    this.mounted = false;
  }

  setLang(lang) {
    this.lang = lang;
    this.panels.clear();          // every label changes, so rebuild on demand
    this.paintChrome();
    if (this.mounted) this.render();
  }

  /** Window titles live outside the panels, so `render` alone cannot reach them. */
  paintChrome() {
    if (!this.navWindow) return;
    const titles = [
      [this.navWindow, t('navTitle', this.lang)],
      [this.railWindow, t('railTitle', this.lang)],
    ];
    for (const [frame, title] of titles) {
      const node = frame && frame.querySelector('.win__title');
      if (node) node.textContent = title;
    }
    if (this.railTab) this.railTab.title = t('railTitle', this.lang);
  }

  /** The other mode may have written progress or journal entries. */
  syncFromStorage() {
    this.progress.refresh();
    this.journal.refresh();
    this.panels.delete('cases');
    this.panels.delete('journal');
    if (this.mounted) this.render();
  }

  // ---- shell ------------------------------------------------------------

  mount() {
    this.nav = el('nav', { class: 'win__body' });
    this.content = el('div', { class: 'win__body' });
    this.railBody = el('div', { class: 'win__body rail__body' });

    this.navWindow = win(t('navTitle', this.lang), this.nav);
    this.contentWindow = win('—', this.content);
    this.railWindow = win(t('railTitle', this.lang), this.railBody,
      el('button', {
        class: 'win__collapse', type: 'button', title: 'Collapse',
        text: '–',
        onClick: () => this.toggleRail(),
      }));
    this.railWindow.classList.add('rail');

    this.railTab = el('button', {
      class: 'rail-tab', type: 'button', text: '⌕',
      title: t('railTitle', this.lang),
      onClick: () => this.toggleRail(),
    });

    replace(this.root, this.navWindow, this.contentWindow, this.railWindow, this.railTab);
    this.journal.subscribe(() => {
      this.paintRail();
      this.panels.delete('journal');
      if (this.panel === 'journal') this.render();
    });
    this.mounted = true;
    this.applyRail();
    this.render();
  }

  toggleRail() {
    this.railOpen = !this.railOpen;
    this.applyRail();
  }

  applyRail() {
    this.root.classList.toggle('rail-closed', !this.railOpen);
    this.railWindow.classList.toggle('is-hidden', !this.railOpen);
    this.railTab.classList.toggle('is-hidden', this.railOpen);
    if (this.railOpen) this.paintRail();
  }

  go(panel, caseId = null) {
    this.panel = panel;
    if (caseId !== null) this.activeCaseId = caseId;
    this.render();
    this.content.scrollTop = 0;
  }

  /**
   * What a sidebar click means: show me that section, from the top.
   * Without clearing the drill-down, clicking Case files after reading a
   * contract re-opened that contract instead of listing the desk.
   */
  openSection(panel) {
    if (panel === 'cases') this.activeCaseId = null;
    if (panel === 'board') this.activeClient = null;
    this.go(panel);
  }

  /**
   * Open the panel a digit names. The sidebar printed 1-8 beside every row
   * from the day it was built and nothing ever listened for them; the number
   * has moved into the row's title, so the promise is kept now rather than
   * merely displayed.
   */
  openByKey(digit) {
    const panel = PANELS.find((entry) => entry.key === digit);
    if (!panel) return false;
    this.openSection(panel.id);
    return true;
  }

  panelKey() {
    if (this.panel === 'cases' && this.activeCaseId !== null) {
      return `cases:${this.activeCaseId}`;
    }
    if (this.panel === 'board' && this.activeClient) {
      return `client:${this.activeClient}`;
    }
    return this.panel;
  }

  ensurePanel(key) {
    if (!this.panels.has(key)) this.panels.set(key, this.buildPanel(key));
    return this.panels.get(key);
  }

  buildPanel(key) {
    if (key.startsWith('cases:')) {
      return this.buildCaseDetail(caseById(key.slice(6)));
    }
    if (key.startsWith('client:')) {
      return this.buildClientBoard(key.slice(7));
    }
    return {
      cases: () => this.buildCaseList(),
      board: () => this.buildBoard(),
      decrypt: () => this.buildDecrypt(),
      ledger: () => this.buildLedger(),
      terminal: () => this.buildTerminal(),
      search: () => this.buildSearch(),
      random: () => this.buildRandom(),
      journal: () => this.buildJournal(),
      about: () => this.buildAbout(),
    }[key]();
  }

  render() {
    this.paintNav();
    const panel = PANELS.find((p) => p.id === this.panel);
    this.contentWindow.querySelector('.win__title').textContent =
      pick(panel.label, this.lang);
    const { node } = this.ensurePanel(this.panelKey());
    replace(this.content, node);
    // The canvas had no box while it was off screen, so it can only measure
    // itself once it has been put back into the flow.
    if (this.panel === 'terminal' && this.onTerminalShown) this.onTerminalShown();
    else if (this.terminalHost) this.terminalHost.classList.add('is-hidden');
    if (this.railOpen) this.paintRail();
  }

  // ---- sidebar ----------------------------------------------------------

  paintNav() {
    // The meter tracks the desk — campaign plus taken contracts — not the
    // whole board, which would sit at 8/264 forever and tell the player nothing.
    const desk = caseload(this.progress);
    const solved = desk.filter((entry) => this.progress.isSolved(entry.id)).length;
    const percent = desk.length ? Math.round((solved / desk.length) * 100) : 0;
    replace(this.nav,
      el('ul', { class: 'nav__list' },
        ...PANELS.map((panel) =>
          el('li', {},
            el('button', {
              class: 'nav__item',
              type: 'button',
              title: `${pick(panel.label, this.lang)} · ${panel.key}`,
              'aria-current': this.panel === panel.id ? 'true' : 'false',
              onClick: () => this.openSection(panel.id),
            },
            icon(panel.glyph),
            el('span', { text: pick(panel.label, this.lang) }))))),
      el('div', { class: 'nav__sep' }),
      el('div', { class: 'nav__meter' },
        el('div', { text: `${solved}/${desk.length} ${t('closedCount', this.lang)}` }),
        el('div', { class: 'nav__bar' }, el('span', { style: `width:${percent}%` }))),
      el('div', { class: 'nav__sep' }),
      el('div', { class: 'nav__meter' },
        el('div', { text: `OPERATOR ${META.operator}` }),
        el('div', { text: `NODE ${this.chain.nodeName}` }),
        el('div', { text: `LOG ${this.journal.all().length}` })),
      el('div', { class: 'row row--tight', style: 'margin-top:10px;padding:0 9px' },
        ...LANGS.map((code) =>
          el('button', {
            class: 'btn btn--lang',
            type: 'button',
            'aria-pressed': this.lang === code ? 'true' : 'false',
            onClick: () => {
              this.setLang(code);
              if (this.onLangChange) this.onLangChange(code);
            },
            text: LANG_NAMES[code],
          }))));
  }

  // ---- journal ----------------------------------------------------------

  /** Record one move. Callers decide whether a phrase may be stored. */
  log(tool, title, { detail = '', status = 'info', payload = {} } = {}) {
    return this.journal.push({ tool, title, detail, status, payload });
  }

  /**
   * The rail holds the two lookups a detective reaches for mid-thought:
   * the BIP-39 wordlist, and recovering a word the checksum can name.
   *
   * Both are on screen at once and stay there whatever panel is open —
   * they were tabs inside a panel before, which meant leaving whatever you
   * were reading to look a word up, and losing the other tool to see one.
   */
  paintRail() {
    if (!this.railPanes) {
      this.railPanes = {
        words: this.searchWordsPane(),
        complete: this.searchCompletePane(),
      };
    }
    replace(this.railBody,
      el('div', { class: 'rail__tool' },
        el('h3', { class: 'rail__tool-title', text: t('tabWords', this.lang) }),
        this.railPanes.words.node),
      el('div', { class: 'rail__tool' },
        el('h3', { class: 'rail__tool-title', text: t('tabComplete', this.lang) }),
        this.railPanes.complete.node));
  }


  /** The sigil that identifies whatever a journal entry is about. */
  entrySigil(entry, size) {
    const payload = entry.payload || {};
    if (payload.mnemonic) return mnemonicSigil(payload.mnemonic, { size });
    if (payload.address) return addressSigil(payload.address, { size });
    if (payload.caseId) {
      const caseFile = caseById(payload.caseId);
      if (caseFile) return caseSigil(caseFile, { size });
    }
    // Searches and masked phrases still deserve a stable mark of their own.
    return sigil(`enigma-${entry.tool}-${entry.title}`, { size });
  }

  railEntry(entry) {
    const tool = TOOLS[entry.tool] || { glyph: '·', label: { en: entry.tool } };
    return el('li', { class: `rail__item rail__item--${entry.status}` },
      el('button', {
        class: 'rail__btn', type: 'button',
        title: `${entry.title}${entry.detail ? '\n' + entry.detail : ''}`,
        onClick: () => this.recall(entry),
      },
      this.entrySigil(entry, 16),
      el('span', { class: 'rail__text' },
        el('span', { class: 'rail__title', text: entry.title }),
        el('span', { class: 'rail__meta', text: `${clock(entry.at)} · ${pick(tool.label, this.lang)}` })),
      entry.pinned ? el('span', { class: 'rail__pin', text: '★' }) : null));
  }

  /** Take the player back to the tool that produced an entry, re-armed. */
  recall(entry) {
    const { tool, payload = {} } = entry;
    if (tool === 'case' || tool === 'hint') {
      if (payload.caseId) this.go('cases', payload.caseId);
      return;
    }
    if (tool === 'decrypt' || tool === 'random') {
      if (!payload.mnemonic) {
        this.go('decrypt');
        this.ensurePanel('decrypt').api.warn(t('maskedNote', this.lang));
        return;
      }
      this.go('decrypt');
      this.ensurePanel('decrypt').api.run(payload.mnemonic);
      return;
    }
    if (tool === 'ledger' || tool === 'sweep' || tool === 'txlog') {
      this.go('ledger');
      this.ensurePanel('ledger').api.run(payload.address, tool);
      return;
    }
    if (tool === 'archive') {
      this.go('search');
      this.ensurePanel('search').api.run(payload.query || '');
      return;
    }
    if (tool === 'search' || tool === 'complete') {
      // These live in the rail, so open it rather than changing panel.
      if (!this.railOpen) this.toggleRail();
      this.paintRail();
      const pane = this.railPanes[tool === 'search' ? 'words' : 'complete'];
      pane.run(payload.query || payload.pattern || '');
    }
  }

  buildJournal() {
    const lang = this.lang;
    let filter = '';
    const body = el('div', {});
    const node = el('div', { class: 'stack' });

    const paint = () => {
      const entries = this.journal.byTool(filter);
      replace(body, entries.length
        ? el('div', {}, ...entries.map((entry, index) => {
          const tool = TOOLS[entry.tool] || { glyph: '·', label: { en: entry.tool } };
          return el('div', { class: `card log log--${entry.status}` },
            el('div', { class: 'log__row' },
              el('span', { class: 'log__n', text: String(index + 1) }),
              this.entrySigil(entry, 22),
              el('span', { class: 'log__glyph', text: tool.glyph }),
              el('div', { class: 'log__body' },
                el('div', { class: 'log__title', text: entry.title }),
                entry.detail ? el('div', { class: 'log__detail', text: entry.detail }) : null,
                el('div', { class: 'log__meta',
                  text: `${clock(entry.at)} · ${pick(tool.label, lang)}` })),
              el('div', { class: 'row row--tight' },
                el('button', {
                  class: 'btn', style: 'padding:2px 8px;font-size:10px',
                  type: 'button', text: t('recall', lang),
                  onClick: () => this.recall(entry),
                }),
                el('button', {
                  class: 'btn', style: 'padding:2px 8px;font-size:10px',
                  type: 'button', 'aria-pressed': entry.pinned ? 'true' : 'false',
                  text: entry.pinned ? '★' : '☆', title: t('pin', lang),
                  onClick: () => { this.journal.togglePin(entry.id); paint(); },
                }),
                el('button', {
                  class: 'btn', style: 'padding:2px 8px;font-size:10px',
                  type: 'button', text: '✕',
                  onClick: () => { this.journal.remove(entry.id); paint(); },
                }))));
        }))
        : empty(t('emptyJournal', lang)));
    };

    const counts = this.journal.counts();
    const filterRow = el('div', { class: 'row row--tight' },
      el('button', {
        class: 'btn', type: 'button', 'aria-pressed': 'true', text: t('all', lang),
        onClick: (event) => {
          filter = '';
          filterRow.querySelectorAll('.btn').forEach((b) => b.setAttribute('aria-pressed', 'false'));
          event.currentTarget.setAttribute('aria-pressed', 'true');
          paint();
        },
      }),
      ...Object.keys(TOOLS).filter((key) => counts[key]).map((key) =>
        el('button', {
          class: 'btn', type: 'button', 'aria-pressed': 'false',
          text: `${TOOLS[key].glyph} ${pick(TOOLS[key].label, lang)} ${counts[key]}`,
          onClick: (event) => {
            filter = key;
            filterRow.querySelectorAll('.btn').forEach((b) => b.setAttribute('aria-pressed', 'false'));
            event.currentTarget.setAttribute('aria-pressed', 'true');
            paint();
          },
        })));

    paint();
    replace(node,
      section(t('journal', lang), `${this.journal.all().length}`),
      el('p', { class: 'hint-text', text: t('journalHelp', lang) }),
      filterRow,
      el('div', { class: 'row' },
        el('button', {
          class: 'btn', type: 'button', text: t('exportTxt', lang),
          onClick: async () => {
            const text = this.journal.toText(lang);
            try {
              await navigator.clipboard.writeText(text);
            } catch { /* clipboard blocked; the download below still works */ }
            const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = el('a', { href: url, download: 'enigma-terminal-journal.txt' });
            document.body.append(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
          },
        }),
        el('button', {
          class: 'btn', type: 'button', text: `${t('purge', lang)} · ${t('keepPinned', lang)}`,
          onClick: () => { this.journal.clear({ keepPinned: true }); paint(); },
        }),
        el('button', {
          class: 'btn', type: 'button', text: `${t('purge', lang)} · ${t('all', lang)}`,
          onClick: () => { this.journal.clear(); paint(); },
        })),
      body);
    return { node, api: { paint } };
  }

  // ---- cases ------------------------------------------------------------

  caseRow(caseFile, { droppable = false, onDropped = null } = {}) {
    const lang = this.lang;
    const state = caseState(caseFile, this.progress);
    const client = caseFile.client ? clientBySlug(caseFile.client) : null;
    const row = el('button', {
      class: 'card__row',
      type: 'button',
      disabled: state === 'locked',
      onClick: () => state !== 'locked' && this.go('cases', caseFile.id),
    },
    caseSigil(caseFile, { size: 26 }),
    el('span', { class: 'card__id', text: String(caseFile.id).padStart(2, '0') }),
    el('div', { class: 'client__head' },
      el('div', { class: 'card__name', text: pick(caseFile.codename, lang) }),
      client ? el('div', { class: 'client__kind', text: pick(client.name, lang) }) : null),
    el('span', { class: 'card__spacer' }),
    el('span', { class: 'stars', text: '★'.repeat(caseFile.difficulty) }),
    badge(state === 'solved' ? 'solved' : state === 'locked' ? 'locked' : 'open',
      t(state, lang)));

    if (!droppable || state === 'solved') return el('div', { class: 'card' }, row);
    return el('div', { class: 'card case-row' }, row,
      el('button', {
        class: 'btn case-row__drop', type: 'button', title: t('drop', lang), text: '✕',
        onClick: () => {
          this.progress.drop(caseFile.id);
          this.panels.delete('cases');
          this.paintNav();
          if (onDropped) onDropped();
        },
      }));
  }

  buildCaseList() {
    const lang = this.lang;
    const node = el('div', {});

    const paint = () => {
      const desk = caseload(this.progress).filter((entry) => entry.client);
      const campaignSolved = CAMPAIGN_CASES
        .filter((entry) => this.progress.isSolved(entry.id)).length;
      const deskSolved = desk.filter((entry) => this.progress.isSolved(entry.id)).length;

      replace(node,
        section(t('campaign', lang), `${campaignSolved}/${CAMPAIGN_CASES.length}`),
        ...CAMPAIGN_CASES.map((caseFile) => this.caseRow(caseFile)),
        el('div', { style: 'height:16px' }),
        section(t('taken', lang), desk.length ? `${deskSolved}/${desk.length}` : ''),
        ...(desk.length
          ? desk.map((caseFile) => this.caseRow(caseFile, { droppable: true, onDropped: paint }))
          : [
            empty(t('takenNone', lang)),
            el('div', { class: 'row', style: 'justify-content:center' },
              el('button', {
                class: 'btn', type: 'button', text: t('openBoard', lang),
                onClick: () => this.go('board'),
              })),
          ]));
    };

    paint();
    return { node, api: { paint } };
  }

  /** The roster: eight employers, thirty-two contracts each. */
  buildBoard() {
    const lang = this.lang;
    const node = el('div', {});
    const body = el('div', {});

    const paint = () => {
      if (!contractsLoaded()) {
        replace(body, el('p', { class: 'spinner-line', text: t('loadingBoard', lang) }));
        return;
      }
      replace(body, ...CLIENTS.map((client) => {
        const cases = casesForClient(client.slug);
        const solved = cases.filter((entry) => this.progress.isSolved(entry.id)).length;
        const percent = cases.length ? Math.round((solved / cases.length) * 100) : 0;
        return el('div', { class: 'card client' },
          el('button', {
            class: 'card__row', type: 'button',
            onClick: () => { this.activeClient = client.slug; this.go('board'); },
          },
          sigil(`enigma-client-${client.slug}`, { size: 30 }),
          el('div', { class: 'client__head' },
            el('div', { class: 'card__name', text: pick(client.name, lang) }),
            el('div', { class: 'client__kind', text: pick(client.kind, lang) })),
          el('span', { class: 'card__spacer' }),
          el('span', { class: 'section__meta', text: pick(client.district, lang) }),
          badge(solved === cases.length && cases.length ? 'solved' : 'open',
            `${solved}/${cases.length}`)),
          el('div', { class: 'client__bar' }, el('span', { style: `width:${percent}%` })));
      }));
    };

    replace(node,
      section(t('board', lang), `${CLIENTS.length} × 32 = 256`),
      el('p', { class: 'hint-text', text: t('clientsHelp', lang) }),
      body);

    if (!contractsLoaded()) {
      loadContracts().then(() => {
        this.panels.delete('board');
        if (this.panel === 'board' && !this.activeClient) this.render();
      });
    }
    paint();
    return { node, api: { paint } };
  }

  /** One employer's thirty-two contracts, grouped into four acts. */
  buildClientBoard(slug) {
    const lang = this.lang;
    const client = clientBySlug(slug);
    const cases = casesForClient(slug);
    const node = el('div', {});

    const acts = [1, 2, 3, 4].map((act) => {
      const inAct = cases.filter((entry) => entry.act === act);
      return el('div', { class: 'stack' },
        section(`${act}. ${client.acts[lang][act - 1]}`,
          `${inAct.filter((e) => this.progress.isSolved(e.id)).length}/${inAct.length}`),
        ...inAct.map((caseFile) => {
          const state = caseState(caseFile, this.progress);
          return el('div', { class: 'card' },
            el('button', {
              class: 'card__row', type: 'button',
              disabled: state === 'locked',
              onClick: () => state !== 'locked' && this.go('cases', caseFile.id),
            },
            caseSigil(caseFile, { size: 24 }),
            el('span', { class: 'card__id', text: String(caseFile.id).padStart(3, '0') }),
            el('span', { class: 'card__name', text: pick(caseFile.codename, lang) }),
            el('span', { class: 'card__spacer' }),
            el('span', { class: 'section__meta', text: caseFile.archetype.replace('_', ' ') }),
            el('span', { class: 'stars', text: '★'.repeat(caseFile.difficulty) }),
            badge(state === 'solved' ? 'solved' : state === 'locked' ? 'locked' : 'open',
              t(state, lang))));
        }));
    });

    replace(node,
      el('div', { class: 'row', style: 'margin-bottom:12px' },
        el('button', {
          class: 'btn', type: 'button', text: '← ' + t('backToClients', lang),
          onClick: () => { this.activeClient = null; this.go('board'); },
        }),
        sigil(`enigma-client-${slug}`, { size: 30 }),
        el('span', { class: 'card__spacer' }),
        el('span', { class: 'section__meta', text: pick(client.district, lang) })),
      section(pick(client.name, lang), pick(client.kind, lang)),
      el('div', { class: 'prose' },
        ...pick(client.creed, lang).map((line) => el('p', { text: line }))),
      notice('info', t('dialect', lang), pick(client.dialect, lang)),
      el('div', { class: 'stack', style: 'margin-top:14px' }, ...acts));
    return { node, api: {} };
  }

  buildCaseDetail(caseFile) {
    const lang = this.lang;
    const state = caseState(caseFile, this.progress);

    // Reading a contract is taking it: the board is where work is offered, the
    // Case files tab is the desk it lands on.
    if (caseFile.client && state !== 'locked' && this.progress.take(caseFile.id)) {
      this.panels.delete('cases');
      this.log('case', `${t('takenLog', lang)}: ${pick(caseFile.codename, lang)}`, {
        detail: pick(clientBySlug(caseFile.client).name, lang),
        payload: { caseId: caseFile.id },
      });
      this.paintNav();
    }
    const hints = pick(caseFile.hints, lang);
    const node = el('div', {});

    const head = [
      el('div', { class: 'row', style: 'margin-bottom:12px' },
        el('button', {
          class: 'btn', type: 'button',
          text: `← ${t('backToCases', lang)}`,
          onClick: () => { this.activeCaseId = null; this.go('cases'); },
        }),
        caseSigil(caseFile, { size: 30 }),
        el('span', { class: 'card__spacer' }),
        el('span', { class: 'stars', text: '★'.repeat(caseFile.difficulty) }),
        badge(state === 'solved' ? 'solved' : state === 'locked' ? 'locked' : 'open',
          t(state, lang))),
      section(`${String(caseFile.id).padStart(2, '0')} · ${pick(caseFile.codename, lang)}`),
    ];

    if (state === 'locked') {
      replace(node, ...head, notice('warn', t('lockedMsg', lang),
        missingRequirements(caseFile, this.progress).join(', ')));
      return { node, api: {} };
    }

    const hintBox = el('div', { class: 'stack' });
    const paintHints = () => {
      const shown = this.progress.hintsUsed(caseFile.id);
      replace(hintBox,
        ...hints.slice(0, shown).map((hint, i) =>
          notice('info', `${i + 1}/${hints.length}`, hint)),
        shown < hints.length
          ? el('button', {
            class: 'btn', type: 'button', text: t('spendHint', lang),
            onClick: () => {
              const used = this.progress.useHint(caseFile.id);
              this.log('hint', `${pick(caseFile.codename, lang)} — hint ${used}/${hints.length}`,
                { detail: hints[used - 1], payload: { caseId: caseFile.id } });
              paintHints();
              this.paintNav();
            },
          })
          : el('p', { class: 'hint-text', text: t('noHints', lang) }));
    };
    paintHints();

    const input = el('textarea', {
      class: 'field', rows: '3', spellcheck: 'false',
      placeholder: t('seedPlaceholder', lang),
    });
    const result = el('div', {});
    const submit = el('button', {
      class: 'btn btn--primary', type: 'button', text: t('derive', lang),
      onClick: async () => {
        submit.disabled = true;
        replace(result, el('p', { class: 'spinner-line', text: t('deriving', lang) }));
        await sleep(16);
        try {
          const wallet = deriveWallet(input.value);
          this.wallet = wallet;
          const owner = caseForMnemonic(wallet.mnemonic);
          const out = [notice('ok', t('checksumOk', lang), wallet.primary.address)];
          if (owner && owner.id === caseFile.id) {
            const first = this.progress.markSolved(caseFile.id);
            this.panels.delete('cases');
            this.paintNav();
            if (first) {
              this.log('case', `${t('caseWord', lang)} ${caseFile.id} — ${pick(caseFile.codename, lang)}`,
                { detail: wallet.primary.address, status: 'ok',
                  payload: { caseId: caseFile.id, mnemonic: wallet.mnemonic } });
            }
            const employer = caseFile.client ? clientBySlug(caseFile.client) : null;
            out.push(notice('ok',
              tf('caseClosed', lang, { id: caseFile.id }),
              ...(employer
                ? [tf('filedWith', lang, { client: pick(employer.name, lang) })]
                : []),
              ...pick(caseFile.epilogue, lang)));
            const campaignDone = CAMPAIGN_CASES
              .every((entry) => this.progress.isSolved(entry.id));
            if (first && campaignDone) {
              out.push(notice('ok', t('allEightClosed', lang)));
            }
          } else if (owner) {
            out.push(notice('warn', tf('keyToOtherCase', lang, { id: owner.id })));
          } else {
            out.push(notice('warn', t('validNotThisCase', lang)));
          }
          this.recordDecrypt(wallet, owner);
          out.push(this.derivationTable(wallet));
          replace(result, ...out);
        } catch (error) {
          this.log('decrypt', error.message, { status: 'danger' });
          replace(result, notice('danger',
            error instanceof MnemonicError ? 'DECRYPTION FAILED' : 'ERROR', error.message));
        } finally {
          submit.disabled = false;
        }
      },
    });

    replace(node, ...head,
      el('div', { class: 'prose' },
        ...pick(caseFile.brief, lang).map((line) => el('p', { text: line }))),
      section(t('evidence', lang)),
      el('div', { class: 'evidence', text: pick(caseFile.evidence, lang).join('\n') }),
      section(t('clues', lang)),
      el('div', { class: 'clues', text: pick(caseFile.clues, lang).join('\n') }),
      section(t('hints', lang)),
      hintBox,
      section(t('submit', lang)),
      el('div', { class: 'stack' }, input, el('div', { class: 'row' }, submit), result));
    return { node, api: {} };
  }

  // ---- shared bits ------------------------------------------------------

  /**
   * Journal a derivation. A phrase is stored in full only when the game already
   * knows it (a case answer — all published test vectors) or when this page
   * generated it. Anything else the player typed stays masked.
   */
  recordDecrypt(wallet, owner, { generated = false } = {}) {
    const storable = Boolean(owner) || generated;
    this.log(generated ? 'random' : 'decrypt', wallet.primary.address, {
      status: owner ? 'ok' : 'info',
      detail: storable
        ? wallet.mnemonic
        : `${maskMnemonic(wallet.mnemonic)} — ${t('maskedNote', this.lang)}`,
      payload: storable ? { mnemonic: wallet.mnemonic } : { masked: true },
    });
  }

  derivationTable(wallet) {
    return el('div', { class: 'stack' },
      el('div', { class: 'row' },
        mnemonicSigil(wallet.mnemonic, { size: 44 }),
        el('span', { class: 'section__meta', text: t('sigilOfPhrase', this.lang) })),
      section(t('derivation', this.lang)),
      table(['', 'PATH', 'TYPE', 'ADDRESS'],
        wallet.addresses.map((entry) => [
          { node: addressSigil(entry.address, { size: 30 }) },
          { text: entry.path },
          { text: entry.label },
          { class: 'addr', node: el('span', {}, entry.address, ' ',
            this.copyButton(entry.address), ' ',
            el('button', {
              class: 'btn', style: 'padding:1px 7px;font-size:10px',
              type: 'button', text: '₿',
              title: t('syncOne', this.lang),
              onClick: () => {
                this.go('ledger');
                this.ensurePanel('ledger').api.run(entry.address, 'ledger');
              },
            })) },
        ])),
      el('details', {},
        el('summary', { class: 'hint-text', style: 'cursor:pointer;margin:8px 0',
          text: t('keysAndSeed', this.lang) }),
        kv([
          ['BIP39 SEED', wallet.seed],
          ['MASTER XPRV', wallet.masterXprv],
          ...wallet.addresses.map((e) => [`PUBKEY m/${e.purpose}'`, e.publicKey]),
        ])));
  }

  copyButton(value) {
    const button = el('button', {
      class: 'btn', type: 'button', style: 'padding:1px 7px;font-size:10px',
      text: t('copy', this.lang),
      onClick: async () => {
        try {
          await navigator.clipboard.writeText(value);
          button.textContent = t('copied', this.lang);
          setTimeout(() => { button.textContent = t('copy', this.lang); }, 1200);
        } catch {
          button.textContent = '—';
        }
      },
    });
    return button;
  }

  // ---- decrypt ----------------------------------------------------------

  buildDecrypt() {
    const lang = this.lang;
    const input = el('textarea', {
      class: 'field', rows: '3', spellcheck: 'false',
      placeholder: t('seedPlaceholder', lang),
    });
    const output = el('div', {});

    const run = async (phrase = null) => {
      if (phrase !== null) input.value = phrase;
      replace(output, el('p', { class: 'spinner-line', text: t('deriving', lang) }));
      await sleep(16);
      try {
        const wallet = deriveWallet(input.value);
        this.wallet = wallet;
        const owner = caseForMnemonic(wallet.mnemonic);
        this.recordDecrypt(wallet, owner);
        replace(output,
          notice('ok', t('checksumOk', lang)),
          owner
            ? notice('info', tf('seedOfCase', lang, { id: owner.id }),
              pick(owner.codename, lang))
            : null,
          kv([['ENTROPY', toHex(mnemonicToEntropy(wallet.mnemonic))]]),
          this.derivationTable(wallet));
      } catch (error) {
        this.log('decrypt', error.message, { status: 'danger' });
        replace(output, notice('danger', 'DECRYPTION FAILED', error.message));
      }
    };

    const node = el('div', {},
      section(t('seedLabel', lang)),
      el('div', { class: 'stack' },
        input,
        el('div', { class: 'row' },
          el('button', { class: 'btn btn--primary', type: 'button', text: t('derive', lang),
            onClick: () => run() }),
          el('button', {
            class: 'btn', type: 'button',
            text: t('fromEntropy', lang),
            onClick: () => {
              const hex = prompt(t('entropyPrompt', lang));
              if (!hex) return;
              try {
                run(entropyToMnemonic(fromHex(hex.trim())));
              } catch (error) {
                replace(output, notice('danger', 'ENTROPY REJECTED', error.message));
              }
            },
          })),
        el('p', { class: 'hint-text', text: t('decryptHelp', lang) }),
        output));

    return {
      node,
      api: {
        run,
        warn: (message) => replace(output, notice('warn', message)),
      },
    };
  }

  // ---- ledger -----------------------------------------------------------

  buildLedger() {
    const lang = this.lang;
    const address = el('input', {
      class: 'field', type: 'text', spellcheck: 'false',
      placeholder: '1... / 3... / bc1...',
      value: this.wallet ? this.wallet.primary.address : '',
    });
    const output = el('div', {});

    const sync = async () => {
      const target = address.value.trim();
      if (!target) return replace(output, notice('warn', t('noWallet', lang)));
      replace(output, el('p', { class: 'spinner-line', text: t('working', lang) }));
      try {
        const stats = await this.chain.addressStats(target);
        const used = stats.txCount > 0 || stats.totalReceivedSats > 0n;
        this.log('ledger', target, {
          status: stats.confirmedSats > 0n ? 'warn' : used ? 'info' : 'info',
          detail: `${formatBtc(stats.confirmedSats)} BTC · ${stats.txCount} tx · ${stats.provider}`,
          payload: { address: target },
        });
        replace(output,
          kv([
            ['CONFIRMED', `${formatBtc(stats.confirmedSats)} BTC`],
            ['UNCONFIRMED', `${formatBtc(stats.unconfirmedSats)} BTC`],
            ['TOTAL RECEIVED', `${formatBtc(stats.totalReceivedSats)} BTC`],
            ['TOTAL SENT', `${formatBtc(stats.totalSentSats)} BTC`],
            ['TX COUNT', stats.txCount],
            ['UTXO COUNT', stats.utxoCount],
            ['SOURCE', stats.provider],
          ]),
          stats.confirmedSats > 0n
            ? notice('warn', 'ACCESS KEY REQUIRED FOR WITHDRAWAL.')
            : used
              ? notice('info', t('walletDrained', lang))
              : notice('info', t('neverUsed', lang)),
          el('a', {
            class: 'hint-text', target: '_blank', rel: 'noopener',
            href: this.chain.explorerUrl(target),
            text: t('openExplorer', lang),
          }));
      } catch (error) {
        this.log('ledger', target, { status: 'danger', detail: error.message,
          payload: { address: target } });
        replace(output, notice('danger', 'NETWORK LINK DOWN', error.message));
      }
    };

    const sweep = async () => {
      if (!this.wallet) return replace(output, notice('warn', t('noWallet', lang)));
      replace(output, el('p', { class: 'spinner-line', text: t('working', lang) }));
      const rows = [];
      let touched = 0;
      for (const entry of this.wallet.addresses) {
        try {
          const stats = await this.chain.addressStats(entry.address);
          const used = stats.txCount > 0 || stats.totalReceivedSats > 0n;
          if (used) touched += 1;
          rows.push([
            { text: `m/${entry.purpose}'` },
            { class: 'addr', text: entry.address },
            { class: 'num', text: String(stats.txCount) },
            { class: 'num', text: formatBtc(stats.totalReceivedSats) },
            { node: badge(used ? 'solved' : 'locked', used ? 'USED' : 'UNUSED') },
          ]);
        } catch {
          rows.push([
            { text: `m/${entry.purpose}'` },
            { class: 'addr', text: entry.address },
            { text: '—' }, { text: '—' },
            { node: badge('danger', 'UNREACHABLE') },
          ]);
        }
      }
      this.log('sweep', this.wallet.primary.address, {
        status: touched ? 'ok' : 'info',
        detail: `${touched}/3 ${t('pathsCarryHistory', lang)}`,
        payload: { address: this.wallet.primary.address },
      });
      replace(output, table(['PATH', 'ADDRESS', 'TX', 'RECEIVED', ''], rows));
    };

    const txlog = async () => {
      const target = address.value.trim();
      if (!target) return replace(output, notice('warn', t('noWallet', lang)));
      replace(output, el('p', { class: 'spinner-line', text: t('working', lang) }));
      try {
        const txs = await this.chain.transactions(target, 10);
        this.log('txlog', target, {
          detail: `${txs.length} ${t('transactionsCount', lang)}`,
          payload: { address: target },
        });
        replace(output, txs.length
          ? table(['STATE', 'BLOCK', 'TXID'], txs.map((tx) => [
            { node: badge(tx.confirmed ? 'solved' : 'warn', tx.confirmed ? 'CONFIRMED' : 'PENDING') },
            { class: 'num', text: tx.blockHeight ? String(tx.blockHeight) : 'mempool' },
            { class: 'addr', text: tx.txid },
          ]))
          : empty(t('noTransactions', lang)));
      } catch (error) {
        replace(output, notice('danger', 'TX HISTORY UNAVAILABLE', error.message));
      }
    };

    const providerRow = el('div', { class: 'row row--tight' },
      ...Object.entries(PROVIDERS).map(([key, provider]) =>
        el('button', {
          class: 'btn', type: 'button',
          'aria-pressed': this.chain.order[0] === key ? 'true' : 'false',
          text: provider.name,
          onClick: (event) => {
            this.chain.preferred = key;
            providerRow.querySelectorAll('.btn').forEach((b) => b.setAttribute('aria-pressed', 'false'));
            event.currentTarget.setAttribute('aria-pressed', 'true');
            this.paintNav();
          },
        })));

    const node = el('div', {},
      section('LIVE BITCOIN NETWORK', this.chain.nodeName),
      el('div', { class: 'stack' },
        address,
        el('div', { class: 'row' },
          el('button', { class: 'btn btn--primary', type: 'button', text: t('syncOne', lang), onClick: sync }),
          el('button', { class: 'btn', type: 'button', text: t('sweep', lang), onClick: sweep }),
          el('button', { class: 'btn', type: 'button', text: t('txlog', lang), onClick: txlog })),
        providerRow,
        output));

    return {
      node,
      api: {
        run: (target, kind = 'ledger') => {
          if (target) address.value = target;
          if (kind === 'sweep') return sweep();
          if (kind === 'txlog') return txlog();
          return sync();
        },
      },
    };
  }

  // ---- terminal ---------------------------------------------------------

  /**
   * The terminal, adopted rather than built.
   *
   * `terminalHost` is the frame main.js created at startup, carrying the
   * canvas, its scrollback and the hidden input that feeds it. Putting that
   * element into the content pane keeps every one of those alive across
   * panel switches; a rebuilt canvas would come back blank each time.
   */
  buildTerminal() {
    const node = this.terminalHost || el('div', { class: 'hint-text', text: 'â€”' });
    return { node, api: {} };
  }

  // ---- archive: full-text search across the case files -------------------

  buildSearch() {
    // One tool, no tabs. The wordlist and the missing-word recovery moved to
    // the rail, where they stay reachable from whatever panel is open.
    const pane = this.searchArchivePane();
    return {
      node: pane.node,
      api: { run: (value) => pane.run(value) },
    };
  }

  searchWordsPane() {
    const lang = this.lang;
    const input = el('input', {
      class: 'field', type: 'search', spellcheck: 'false',
      placeholder: t('wordPlaceholder', lang),
    });
    const output = el('div', {});
    let logged = '';

    const run = (value = null) => {
      if (value !== null) input.value = value;
      const query = input.value.trim();
      if (!query) return replace(output, empty(t('typeQuery', lang)));
      const asNumber = Number(query);
      if (Number.isInteger(asNumber) && asNumber >= 1 && asNumber <= 2048) {
        replace(output, el('div', { class: 'word-grid' },
          el('div', { class: 'word' },
            el('span', { class: 'word__n', text: String(asNumber) }),
            el('span', { text: wordAt(asNumber) }))));
      } else {
        const hits = searchWordlist(query);
        replace(output, hits.length
          ? el('div', { class: 'stack' },
            el('p', { class: 'hint-text', text: `${hits.length} ${t('matches', lang)}` }),
            el('div', { class: 'word-grid' },
              ...hits.map((hit) => el('div', { class: 'word' },
                el('span', { class: 'word__n', text: String(hit.index) }),
                el('span', { text: hit.word })))))
          : empty(t('nothingFound', lang)));
      }
      // Log once the player stops typing, not on every keystroke.
      clearTimeout(this._wordTimer);
      this._wordTimer = setTimeout(() => {
        if (query === logged) return;
        logged = query;
        const hits = searchWordlist(query);
        this.log('search', query, {
          detail: `${hits.length} ${t('matches', lang)}`,
          payload: { query },
        });
      }, 900);
    };

    input.addEventListener('input', () => run());
    const node = el('div', {},
      section(t('wordlistTitle', lang), '2048'),
      el('div', { class: 'stack' }, input,
        el('p', { class: 'hint-text', text: t('wordlistHelp', lang) }),
        output));
    return { node, run };
  }

  searchArchivePane() {
    const lang = this.lang;
    const input = el('input', {
      class: 'field', type: 'search', spellcheck: 'false',
      placeholder: t('archivePlaceholder', lang),
    });
    const output = el('div', {});
    let logged = '';

    const run = (value = null) => {
      if (value !== null) input.value = value;
      const query = input.value.trim();
      if (!query) return replace(output, empty(t('typeQuery', lang)));
      const results = searchCases(query, lang, this.progress);
      replace(output, results.length
        ? el('div', { class: 'stack' },
          ...results.map((result) => el('div', { class: 'card' },
            el('button', {
              class: 'card__row', type: 'button',
              onClick: () => this.go('cases', result.case.id),
            },
            el('span', { class: 'card__id', text: String(result.case.id).padStart(2, '0') }),
            el('span', { class: 'card__name', text: pick(result.case.codename, lang) }),
            el('span', { class: 'card__spacer' }),
            badge('open', `${result.hits.length}`)),
            el('div', { style: 'padding:0 11px 10px' },
              ...result.hits.slice(0, 4).map((hit) =>
                el('div', { class: 'evidence', style: 'margin-top:6px', text: hit.line }))))))
        : empty(t('nothingInArchive', lang)));

      clearTimeout(this._archiveTimer);
      this._archiveTimer = setTimeout(() => {
        if (query === logged) return;
        logged = query;
        this.log('archive', query, {
          detail: `${results.length} ${t('casesCount', lang)}`,
          payload: { query },
        });
      }, 900);
    };

    input.addEventListener('input', () => run());
    const node = el('div', {},
      section(t('archiveTitle', lang)),
      el('div', { class: 'stack' }, input,
        el('p', { class: 'hint-text', text: t('archiveHelp', lang) }),
        output));
    return { node, run };
  }

  searchCompletePane() {
    const lang = this.lang;
    const input = el('textarea', {
      class: 'field', rows: '3', spellcheck: 'false',
      placeholder: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon ?',
    });
    const output = el('div', {});

    const run = async (value = null) => {
      if (value !== null) input.value = value;
      if (!input.value.trim()) return;
      replace(output, el('p', { class: 'spinner-line', text: t('searching', lang) }));
      await sleep(16);
      try {
        const pattern = input.value.trim();
        const { position, candidates } = completeMnemonic(pattern);
        const hit = candidates.find((candidate) => candidate.case);
        this.log('complete', `? @ ${position + 1}`, {
          status: hit ? 'ok' : 'info',
          detail: hit
            ? `${candidates.length} ${t('candidates', lang)} · ${hit.word} → case ${hit.case.id}`
            : `${candidates.length} ${t('candidates', lang)}`,
          payload: { pattern },
        });
        replace(output,
          notice('info',
            tf('positionCandidates', lang, { position: position + 1, count: candidates.length }),
            t('checksumCuts', lang)),
          hit
            ? notice('ok',
              tf('oneOpensCase', lang, { id: hit.case.id }),
              hit.word)
            : null,
          el('div', { class: 'chip-grid' },
            ...candidates.map((candidate) =>
              el('button', {
                class: `chip ${candidate.case ? 'chip--hit' : ''}`,
                type: 'button',
                title: candidate.mnemonic,
                onClick: () => { input.value = candidate.mnemonic; },
              },
              el('span', { class: 'chip__i', text: String(indexOf(candidate.word)) }),
              el('span', { text: candidate.word })))));
      } catch (error) {
        this.log('complete', error.message, { status: 'danger' });
        replace(output, notice('danger', 'SEARCH REFUSED', error.message));
      }
    };

    const node = el('div', {},
      section(t('completeTitle', lang)),
      el('div', { class: 'stack' },
        el('p', { class: 'hint-text', text: t('completeHelp', lang) }),
        input,
        el('div', { class: 'row' },
          el('button', { class: 'btn btn--primary', type: 'button',
            text: t('findCandidates', lang),
            onClick: () => run() })),
        output));
    return { node, run };
  }

  // ---- randomizer -------------------------------------------------------

  buildRandom() {
    const lang = this.lang;
    const output = el('div', {});
    let count = 12;

    const countRow = el('div', { class: 'row row--tight' },
      ...[12, 15, 18, 21, 24].map((value) =>
        el('button', {
          class: 'btn', type: 'button',
          'aria-pressed': value === count ? 'true' : 'false',
          text: String(value),
          onClick: (event) => {
            count = value;
            countRow.querySelectorAll('.btn').forEach((b) => b.setAttribute('aria-pressed', 'false'));
            event.currentTarget.setAttribute('aria-pressed', 'true');
          },
        })));

    const generate = async () => {
      replace(output, el('p', { class: 'spinner-line', text: t('deriving', lang) }));
      await sleep(16);
      const { mnemonic, entropy } = randomMnemonic(count);
      const words = mnemonic.split(' ');
      const wallet = deriveWallet(mnemonic);
      this.wallet = wallet;
      this.recordDecrypt(wallet, null, { generated: true });
      replace(output,
        el('div', { class: 'row', style: 'margin-bottom:10px' },
          this.copyButton(mnemonic),
          el('span', { class: 'section__meta', text: `${words.length} words · ${entropy.length * 8} bits` })),
        el('div', { class: 'word-grid' },
          ...words.map((word, index) => el('div', { class: 'word' },
            el('span', { class: 'word__n', text: String(index + 1) }),
            el('span', { text: word })))),
        kv([['ENTROPY', toHex(entropy)]]),
        this.derivationTable(wallet),
        notice('warn', t('realWalletTitle', lang), t('realWalletBody', lang)));
    };

    const node = el('div', {},
      section(t('randomTitle', lang)),
      el('div', { class: 'stack' },
        el('div', { class: 'row' },
          el('span', { class: 'section__meta', text: t('words', lang) }), countRow),
        el('div', { class: 'row' },
          el('button', { class: 'btn btn--primary', type: 'button', text: t('generate', lang), onClick: generate })),
        el('p', { class: 'hint-text', text: t('randomHelp', lang) }),
        output));
    return { node, api: { run: generate } };
  }

  // ---- about ------------------------------------------------------------

  buildAbout() {
    const lang = this.lang;
    const lines = ABOUT[lang] || ABOUT.en;
    const node = el('div', {},
      section('BIP-39: ENIGMA TERMINAL', META.version),
      el('div', { class: 'prose' }, ...lines.map((line) => el('p', { text: line }))),
      el('div', { class: 'row' },
        el('a', { class: 'btn', href: 'https://github.com/legenki/neon-terminal',
          target: '_blank', rel: 'noopener', text: 'Source on GitHub ↗' })));
    return { node, api: {} };
  }
}
