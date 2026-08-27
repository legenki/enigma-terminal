// The GUI front-end. Retro chrome, modern layout — over the same game core the
// command line drives, so progress, journal and rules are shared.
//
// Panels are built once and cached: switching tabs hides a node instead of
// re-rendering it, so a half-typed phrase, a query and its results all survive
// the trip to another tool and back.

import { ChainClient, formatBtc, PROVIDERS } from '../chain.js';
import {
  CAMPAIGN_CASES,
  CLIENTS,
  caseById,
  caseForMnemonic,
  caseload,
  caseState,
  casesForClient,
  clientBySlug,
  completeMnemonic,
  contractsLoaded,
  loadContracts,
  META,
  MnemonicError,
  missingRequirements,
  ProgressStore,
  pick,
  randomMnemonic,
  searchCases,
  searchWordlist,
} from '../core.js';
import {
  entropyToMnemonic,
  indexOf,
  mnemonicToEntropy,
  wordAt,
} from '../crypto/bip39.js';
import { fromHex, toHex } from '../crypto/hash.js';
import { readHeader } from '../crypto/header.js';
import { deriveWallet } from '../crypto/wallet.js';
import { pad2, splitAge } from '../heartbeat.js';
import { addressSigil, caseSigil, mnemonicSigil, sigil } from '../identicon.js';
import { Journal, maskMnemonic, TOOLS } from '../journal.js';
import { btc, classify, ExplorerClient } from '../mempool.js';
import {
  blockReward,
  formatHashrate,
  formatSpan,
  hashrate,
  untilHalving,
  untilRetarget,
} from '../pow.js';
import { icon } from '../vendor/feather.js';
import {
  badge,
  el,
  empty,
  kv,
  notice,
  replace,
  section,
  table,
  win,
} from './dom.js';

//: `key` still works as a shortcut — it moved off the row and into the row's
//: title, so the sidebar reads as a list of places rather than a numbered menu.
export const PANELS = [
  {
    id: 'terminal',
    glyph: 'terminal',
    label: { en: 'Terminal', ru: 'Терминал', es: 'Terminal', pt: 'Terminal' },
    key: '1',
  },
  {
    id: 'cases',
    glyph: 'folder',
    label: { en: 'Case files', ru: 'Дела', es: 'Casos', pt: 'Casos' },
    key: '2',
  },
  {
    id: 'board',
    glyph: 'grid',
    label: {
      en: 'Contracts',
      ru: 'Контракты',
      es: 'Contratos',
      pt: 'Contratos',
    },
    key: '3',
  },
  {
    id: 'decrypt',
    glyph: 'key',
    label: {
      en: 'Decrypt',
      ru: 'Дешифровка',
      es: 'Descifrado',
      pt: 'Decifração',
    },
    key: '4',
  },
  {
    id: 'ledger',
    glyph: 'database',
    label: { en: 'Ledger', ru: 'Реестр', es: 'Registro', pt: 'Registro' },
    key: '5',
  },
  {
    id: 'explorer',
    glyph: 'globe',
    label: {
      en: 'Explorer',
      ru: 'Эксплорер',
      es: 'Explorador',
      pt: 'Explorador',
    },
    key: '6',
  },
  {
    id: 'archive',
    glyph: 'search',
    label: { en: 'Archive', ru: 'Архив дел', es: 'Archivo', pt: 'Arquivo' },
    key: '7',
  },
  {
    id: 'random',
    glyph: 'shuffle',
    label: {
      en: 'Randomizer',
      ru: 'Рандомайзер',
      es: 'Aleatorio',
      pt: 'Aleatório',
    },
    key: '8',
  },
  {
    id: 'journal',
    glyph: 'bookOpen',
    label: { en: 'Journal', ru: 'Журнал', es: 'Diario', pt: 'Diário' },
    key: '9',
  },
  {
    id: 'about',
    glyph: 'info',
    label: { en: 'About', ru: 'О программе', es: 'Acerca de', pt: 'Sobre' },
    key: '0',
  },
];

// Every fixed string the GUI shows. Keys carrying {braces} are filled by `tf`.
const T = {
  minedBy: {
    en: 'Mined by',
    ru: 'Смайнил',
    es: 'Minado por',
    pt: 'Minerado por',
  },
  minerPools: {
    en: 'Miner pools',
    ru: 'Майнинг-пулы',
    es: 'Pools de minería',
    pt: 'Pools de mineração',
  },
  blocksWord: {
    en: 'blocks',
    ru: 'блоков',
    es: 'bloques',
    pt: 'blocos',
  },
  lastDay: {
    en: 'Last 24 hours',
    ru: 'За последние 24 часа',
    es: 'Últimas 24 horas',
    pt: 'Últimas 24 horas',
  },
  fastest: {
    en: 'fastest',
    ru: 'быстро',
    es: 'rápido',
    pt: 'rápido',
  },
  economy: {
    en: 'economy',
    ru: 'эконом',
    es: 'económico',
    pt: 'econômico',
  },
  lastBlock: {
    en: 'Last block',
    ru: 'Последний блок',
    es: 'Último bloque',
    pt: 'Último bloco',
  },
  sinceLastBlock: {
    en: 'Time from last block',
    ru: 'С последнего блока',
    es: 'Desde el último bloque',
    pt: 'Desde o último bloco',
  },
  hours: {
    en: 'hours',
    ru: 'часов',
    es: 'horas',
    pt: 'horas',
  },
  minutes: {
    en: 'minutes',
    ru: 'минут',
    es: 'minutos',
    pt: 'minutos',
  },
  secondsUnit: {
    en: 'seconds',
    ru: 'секунд',
    es: 'segundos',
    pt: 'segundos',
  },
  years: {
    en: 'years',
    ru: 'лет',
    es: 'años',
    pt: 'anos',
  },
  days: {
    en: 'days',
    ru: 'дней',
    es: 'días',
    pt: 'dias',
  },
  poolTransactions: {
    en: 'Pool transactions',
    ru: 'Транзакций в пуле',
    es: 'Transacciones en el pool',
    pt: 'Transações no pool',
  },
  bestFee: {
    en: 'Best fee',
    ru: 'Лучшая ставка',
    es: 'Mejor tasa',
    pt: 'Melhor taxa',
  },
  poolStats: {
    en: 'Pool statistics',
    ru: 'Статистика пула',
    es: 'Estadísticas del pool',
    pt: 'Estatísticas do pool',
  },
  powTitle: {
    en: 'Proof of work',
    ru: 'Proof of work',
    es: 'Prueba de trabajo',
    pt: 'Prova de trabalho',
  },
  hashrateLabel: {
    en: 'Hashrate',
    ru: 'Хешрейт',
    es: 'Hashrate',
    pt: 'Hashrate',
  },
  nextDifficultyLabel: {
    en: 'Next difficulty',
    ru: 'Следующая сложность',
    es: 'Próxima dificultad',
    pt: 'Próxima dificuldade',
  },
  retargetIn: {
    en: 'Adjusts in',
    ru: 'Пересчёт через',
    es: 'Se ajusta en',
    pt: 'Ajusta em',
  },
  averageBlockTime: {
    en: 'Average block time',
    ru: 'Среднее время блока',
    es: 'Tiempo medio de bloque',
    pt: 'Tempo médio do bloco',
  },
  blockRewardLabel: {
    en: 'Block reward',
    ru: 'Награда за блок',
    es: 'Recompensa por bloque',
    pt: 'Recompensa por bloco',
  },
  halvingIn: {
    en: 'Halving in',
    ru: 'Халвинг через',
    es: 'Halving en',
    pt: 'Halving em',
  },
  derivedHere: {
    en: 'Worked out here from the height and the header — the source publishes none of it.',
    ru: 'Посчитано здесь по высоте и заголовку — сервис этого не отдаёт.',
    es: 'Calculado aquí a partir de la altura y el encabezado — el servicio no lo publica.',
    pt: 'Calculado aqui a partir da altura e do cabeçalho — o serviço não publica nada disso.',
  },
  transactionsLabel: {
    en: 'Transactions',
    ru: 'Транзакций',
    es: 'Transacciones',
    pt: 'Transações',
  },
  sizeLabel: {
    en: 'Size',
    ru: 'Размер',
    es: 'Tamaño',
    pt: 'Tamanho',
  },
  amountLabel: {
    en: 'Amount',
    ru: 'Сумма',
    es: 'Monto',
    pt: 'Montante',
  },
  doublespendLabel: {
    en: 'Doublespend',
    ru: 'Двойные траты',
    es: 'Doble gasto',
    pt: 'Gasto duplo',
  },
  inputsOutputs: {
    en: 'Inputs / outputs',
    ru: 'Входы / выходы',
    es: 'Entradas / salidas',
    pt: 'Entradas / saídas',
  },
  explorer: {
    en: 'Explorer',
    ru: 'Эксплорер',
    es: 'Explorador',
    pt: 'Explorador',
  },
  lookUp: {
    en: 'Look up',
    ru: 'Найти',
    es: 'Buscar',
    pt: 'Buscar',
  },
  explorerTitle: {
    en: 'Chain explorer',
    ru: 'Обозреватель цепи',
    es: 'Explorador de la cadena',
    pt: 'Explorador da cadeia',
  },
  explorerPlaceholder: {
    en: 'block height, block hash, transaction id, or address',
    ru: 'высота блока, хеш блока, id транзакции или адрес',
    es: 'altura de bloque, hash, id de transacción o dirección',
    pt: 'altura do bloco, hash, id de transação ou endereço',
  },
  explorerHelp: {
    en: 'Everything here is read from the live chain. A number is a height, sixty-four hex characters are a block or a transaction, anything else is an address.',
    ru: 'Всё здесь читается из живой цепи. Число — это высота, шестьдесят четыре hex-символа — блок или транзакция, остальное — адрес.',
    es: 'Todo aquí se lee de la cadena en vivo. Un número es una altura, sesenta y cuatro caracteres hex son un bloque o una transacción, lo demás es una dirección.',
    pt: 'Tudo aqui é lido da cadeia ao vivo. Um número é uma altura, sessenta e quatro caracteres hex são um bloco ou uma transação, o resto é um endereço.',
  },
  chainTip: {
    en: 'Chain tip',
    ru: 'Вершина цепи',
    es: 'Punta de la cadena',
    pt: 'Topo da cadeia',
  },
  mempoolTitle: {
    en: 'Mempool',
    ru: 'Мемпул',
    es: 'Mempool',
    pt: 'Mempool',
  },
  blockTitle: {
    en: 'Block',
    ru: 'Блок',
    es: 'Bloque',
    pt: 'Bloco',
  },
  txTitle: {
    en: 'Transaction',
    ru: 'Транзакция',
    es: 'Transacción',
    pt: 'Transação',
  },
  addressTitle: {
    en: 'Address',
    ru: 'Адрес',
    es: 'Dirección',
    pt: 'Endereço',
  },
  height: {
    en: 'Height',
    ru: 'Высота',
    es: 'Altura',
    pt: 'Altura',
  },
  mined: {
    en: 'Mined',
    ru: 'Смайнен',
    es: 'Minado',
    pt: 'Minerado',
  },
  difficulty: {
    en: 'Difficulty',
    ru: 'Сложность',
    es: 'Dificultad',
    pt: 'Dificuldade',
  },
  nonce: {
    en: 'Nonce',
    ru: 'Nonce',
    es: 'Nonce',
    pt: 'Nonce',
  },
  merkleRoot: {
    en: 'Merkle root',
    ru: 'Корень Меркла',
    es: 'Raíz de Merkle',
    pt: 'Raiz de Merkle',
  },
  previousBlock: {
    en: 'Previous block',
    ru: 'Предыдущий блок',
    es: 'Bloque anterior',
    pt: 'Bloco anterior',
  },
  target: {
    en: 'Target',
    ru: 'Цель',
    es: 'Objetivo',
    pt: 'Alvo',
  },
  hashVerified: {
    en: 'Header hashes to the reported hash',
    ru: 'Хеш заголовка совпал с заявленным',
    es: 'El encabezado coincide con el hash informado',
    pt: 'O cabeçalho confere com o hash informado',
  },
  hashMismatch: {
    en: 'Header does NOT hash to the reported hash',
    ru: 'Хеш заголовка НЕ совпал с заявленным',
    es: 'El encabezado NO coincide con el hash informado',
    pt: 'O cabeçalho NÃO confere com o hash informado',
  },
  transactionsIn: {
    en: 'transactions',
    ru: 'транзакций',
    es: 'transacciones',
    pt: 'transações',
  },
  confirmations: {
    en: 'Confirmations',
    ru: 'Подтверждений',
    es: 'Confirmaciones',
    pt: 'Confirmações',
  },
  unconfirmed: {
    en: 'Unconfirmed',
    ru: 'Не подтверждена',
    es: 'Sin confirmar',
    pt: 'Não confirmada',
  },
  feePaid: {
    en: 'Fee',
    ru: 'Комиссия',
    es: 'Comisión',
    pt: 'Taxa',
  },
  feeRate: {
    en: 'Fee rate',
    ru: 'Ставка',
    es: 'Tasa',
    pt: 'Taxa por vByte',
  },
  sizeWeight: {
    en: 'Size / weight',
    ru: 'Размер / вес',
    es: 'Tamaño / peso',
    pt: 'Tamanho / peso',
  },
  inputs: {
    en: 'Inputs',
    ru: 'Входы',
    es: 'Entradas',
    pt: 'Entradas',
  },
  outputs: {
    en: 'Outputs',
    ru: 'Выходы',
    es: 'Saídas',
    pt: 'Saídas',
  },
  coinbaseTx: {
    en: 'Coinbase — newly issued coin',
    ru: 'Coinbase — вновь выпущенная монета',
    es: 'Coinbase — moneda recién emitida',
    pt: 'Coinbase — moeda recém-emitida',
  },
  balance: {
    en: 'Balance',
    ru: 'Баланс',
    es: 'Saldo',
    pt: 'Saldo',
  },
  received: {
    en: 'Received',
    ru: 'Получено',
    es: 'Recibido',
    pt: 'Recebido',
  },
  sent: {
    en: 'Sent',
    ru: 'Отправлено',
    es: 'Enviado',
    pt: 'Enviado',
  },
  largestReceived: {
    en: 'Largest received',
    ru: 'Крупнейшее поступление',
    es: 'Mayor recibido',
    pt: 'Maior recebido',
  },
  unspentOutputs: {
    en: 'Unspent outputs',
    ru: 'Непотраченные выходы',
    es: 'Salidas sin gastar',
    pt: 'Saídas não gastas',
  },
  inMempool: {
    en: 'in the mempool',
    ru: 'в мемпуле',
    es: 'en el mempool',
    pt: 'no mempool',
  },
  feeRateSpread: {
    en: 'Fee rate spread',
    ru: 'Распределение ставок',
    es: 'Distribución de tasas',
    pt: 'Distribuição de taxas',
  },
  recommended: {
    en: 'Recommended',
    ru: 'Рекомендуется',
    es: 'Recomendado',
    pt: 'Recomendado',
  },
  pending: {
    en: 'pending',
    ru: 'в ожидании',
    es: 'pendientes',
    pt: 'pendentes',
  },
  rbfSegwit: {
    en: 'RBF / SegWit',
    ru: 'RBF / SegWit',
    es: 'RBF / SegWit',
    pt: 'RBF / SegWit',
  },
  lookingUp: {
    en: 'Reading the chain…',
    ru: 'Читаю цепь…',
    es: 'Leyendo la cadena…',
    pt: 'Lendo a cadeia…',
  },
  nothingLikeIt: {
    en: 'That is not a height, a hash, or an address.',
    ru: 'Это не высота, не хеш и не адрес.',
    es: 'Eso no es una altura, un hash ni una dirección.',
    pt: 'Isso não é uma altura, um hash nem um endereço.',
  },
  openInExplorer: {
    en: 'Open at mempool.space',
    ru: 'Открыть на mempool.space',
    es: 'Abrir en mempool.space',
    pt: 'Abrir no mempool.space',
  },
  sourceIsLive: {
    en: 'Live from mempool.space',
    ru: 'Живые данные mempool.space',
    es: 'En vivo desde mempool.space',
    pt: 'Ao vivo de mempool.space',
  },
  solved: { en: 'Closed', ru: 'Закрыто', es: 'Cerrado', pt: 'Fechado' },
  open: { en: 'Open', ru: 'Открыто', es: 'Abierto', pt: 'Aberto' },
  locked: { en: 'Locked', ru: 'Заперто', es: 'Bloqueado', pt: 'Bloqueado' },
  closedCount: { en: 'closed', ru: 'закрыто', es: 'cerrados', pt: 'fechados' },
  evidence: { en: 'Evidence', ru: 'Улики', es: 'Pruebas', pt: 'Provas' },
  clues: {
    en: 'Decoding table',
    ru: 'Таблица дешифровки',
    es: 'Tabla de descifrado',
    pt: 'Tabela de decifração',
  },
  hints: { en: 'Hints', ru: 'Подсказки', es: 'Pistas', pt: 'Dicas' },
  spendHint: {
    en: 'Spend a hint',
    ru: 'Взять подсказку',
    es: 'Gastar una pista',
    pt: 'Gastar uma dica',
  },
  noHints: {
    en: 'No hints left on this case.',
    ru: 'Подсказки по этому делу закончились.',
    es: 'No quedan pistas en este caso.',
    pt: 'Não há mais dicas neste caso.',
  },
  submit: {
    en: 'Submit seed phrase',
    ru: 'Проверить сид-фразу',
    es: 'Enviar frase semilla',
    pt: 'Enviar frase semente',
  },
  derive: { en: 'Derive', ru: 'Вывести адреса', es: 'Derivar', pt: 'Derivar' },
  lockedMsg: {
    en: 'Close these cases first:',
    ru: 'Сначала закрой дела:',
    es: 'Cierra primero estos casos:',
    pt: 'Feche estes casos primeiro:',
  },
  seedLabel: {
    en: 'Seed phrase (12 words)',
    ru: 'Сид-фраза (12 слов)',
    es: 'Frase semilla (12 palabras)',
    pt: 'Frase semente (12 palavras)',
  },
  checksumOk: {
    en: 'Mnemonic checksum valid',
    ru: 'Контрольная сумма верна',
    es: 'Suma de comprobación válida',
    pt: 'Soma de verificação válida',
  },
  derivation: {
    en: 'Derivation grid',
    ru: 'Сетка деривации',
    es: 'Cuadrícula de derivación',
    pt: 'Grade de derivação',
  },
  noWallet: {
    en: 'No seed loaded yet. Derive one in the Decrypt panel first.',
    ru: 'Сид не загружен. Сначала выведи адреса на вкладке «Дешифровка».',
    es: 'Aún no hay semilla cargada. Deriva una en el panel Descifrado.',
    pt: 'Nenhuma semente carregada ainda. Derive uma no painel Decifração.',
  },
  syncOne: {
    en: 'Query balance',
    ru: 'Запросить баланс',
    es: 'Consultar saldo',
    pt: 'Consultar saldo',
  },
  sweep: {
    en: 'Sweep all paths',
    ru: 'Проверить все пути',
    es: 'Recorrer todas las rutas',
    pt: 'Percorrer todas as rotas',
  },
  txlog: {
    en: 'Transactions',
    ru: 'Транзакции',
    es: 'Transacciones',
    pt: 'Transações',
  },
  working: {
    en: 'Querying the live chain…',
    ru: 'Запрос к живой сети…',
    es: 'Consultando la cadena en vivo…',
    pt: 'Consultando a cadeia ao vivo…',
  },
  deriving: {
    en: 'Deriving keys…',
    ru: 'Вывожу ключи…',
    es: 'Derivando claves…',
    pt: 'Derivando chaves…',
  },
  searching: { en: 'Searching…', ru: 'Ищу…', es: 'Buscando…', pt: 'Buscando…' },
  generate: { en: 'Generate', ru: 'Сгенерировать', es: 'Generar', pt: 'Gerar' },
  words: { en: 'Words', ru: 'Слов', es: 'Palabras', pt: 'Palavras' },
  copy: { en: 'Copy', ru: 'Копировать', es: 'Copiar', pt: 'Copiar' },
  copied: { en: 'Copied', ru: 'Скопировано', es: 'Copiado', pt: 'Copiado' },
  journal: { en: 'Journal', ru: 'Журнал', es: 'Diario', pt: 'Diário' },
  railTitle: {
    en: 'Tools',
    ru: 'Инструменты',
    es: 'Herramientas',
    pt: 'Ferramentas',
  },
  navTitle: { en: 'Desk', ru: 'Стол', es: 'Escritorio', pt: 'Mesa' },
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
  keepPinned: {
    en: 'Keep pinned',
    ru: 'Кроме закреплённых',
    es: 'Salvo las fijadas',
    pt: 'Exceto as fixadas',
  },
  all: { en: 'All', ru: 'Все', es: 'Todo', pt: 'Tudo' },
  board: {
    en: 'Contract board',
    ru: 'Доска контрактов',
    es: 'Tablero de contratos',
    pt: 'Quadro de contratos',
  },
  dialect: {
    en: 'Puzzle dialect',
    ru: 'Почерк заказчика',
    es: 'Estilo del cliente',
    pt: 'Estilo do cliente',
  },
  loadingBoard: {
    en: 'Pulling the contract board…',
    ru: 'Тяну доску контрактов…',
    es: 'Cargando el tablero de contratos…',
    pt: 'Carregando o quadro de contratos…',
  },
  backToClients: {
    en: 'All clients',
    ru: 'К заказчикам',
    es: 'A los clientes',
    pt: 'Aos clientes',
  },
  campaign: {
    en: 'ORACLE archive',
    ru: 'Архив ORACLE',
    es: 'Archivo ORACLE',
    pt: 'Arquivo ORACLE',
  },
  taken: {
    en: 'Taken contracts',
    ru: 'Взятые контракты',
    es: 'Contratos tomados',
    pt: 'Contratos assumidos',
  },
  takenNone: {
    en: 'No contracts taken yet. Open one on the board and it lands here.',
    ru: 'Контрактов пока нет. Открой любой на доске — он ляжет сюда.',
    es: 'Aún no hay contratos. Abre uno en el tablero y aparecerá aquí.',
    pt: 'Ainda não há contratos. Abra um no quadro e ele aparecerá aqui.',
  },
  drop: {
    en: 'Return to board',
    ru: 'Вернуть на доску',
    es: 'Devolver al tablero',
    pt: 'Devolver ao quadro',
  },
  openBoard: {
    en: 'Open the board',
    ru: 'Открыть доску',
    es: 'Abrir el tablero',
    pt: 'Abrir o quadro',
  },

  // ---- strings the panels used to inline as ru/en ternaries ---------------
  filedWith: {
    en: 'Filed with {client}.',
    ru: 'Сдано заказчику: {client}.',
    es: 'Entregado al cliente: {client}.',
    pt: 'Entregue ao cliente: {client}.',
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
  backToCases: {
    en: 'All cases',
    ru: 'К списку',
    es: 'A los casos',
    pt: 'Aos casos',
  },
  seedPlaceholder: {
    en: 'twelve words separated by spaces',
    ru: 'двенадцать слов через пробел',
    es: 'doce palabras separadas por espacios',
    pt: 'doze palavras separadas por espaços',
  },
  caseWord: { en: 'Case', ru: 'Дело', es: 'Caso', pt: 'Caso' },
  caseClosed: {
    en: 'Case {id} closed',
    ru: 'Дело {id} закрыто',
    es: 'Caso {id} cerrado',
    pt: 'Caso {id} fechado',
  },
  allEightClosed: {
    en: 'All eight cases closed.',
    ru: 'Все восемь дел закрыты.',
    es: 'Los ocho casos están cerrados.',
    pt: 'Os oito casos estão fechados.',
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
  sigilOfPhrase: {
    en: 'Sigil of this phrase',
    ru: 'Знак этой фразы',
    es: 'Sello de esta frase',
    pt: 'Selo desta frase',
  },
  keysAndSeed: {
    en: 'Keys and seed',
    ru: 'Ключи и сид',
    es: 'Claves y semilla',
    pt: 'Chaves e semente',
  },
  seedOfCase: {
    en: 'Seed of case {id}',
    ru: 'Сид дела {id}',
    es: 'Semilla del caso {id}',
    pt: 'Semente do caso {id}',
  },
  fromEntropy: {
    en: 'From entropy (hex)',
    ru: 'Из энтропии (hex)',
    es: 'Desde entropía (hex)',
    pt: 'A partir da entropia (hex)',
  },
  entropyPrompt: {
    en: 'Entropy, 32 hex characters:',
    ru: 'Энтропия, 32 hex-символа:',
    es: 'Entropía, 32 caracteres hex:',
    pt: 'Entropia, 32 caracteres hex:',
  },
  decryptHelp: {
    ru: 'Проверка идёт по официальному словарю BIP-39 вместе с контрольной суммой. Всё считается здесь, в браузере, и незнакомые фразы в журнал целиком не попадают.',
    en: 'Validated against the official BIP-39 wordlist, checksum included. Everything runs in your browser, and unknown phrases are never written to the journal in full.',
    es: 'Se valida contra la lista oficial BIP-39, suma de comprobación incluida. Todo se calcula en tu navegador, y las frases desconocidas nunca llegan enteras al diario.',
    pt: 'Validado contra a lista oficial BIP-39, soma de verificação incluída. Tudo roda no seu navegador, e frases desconhecidas nunca chegam inteiras ao diário.',
  },
  walletDrained: {
    en: 'Wallet drained. History intact.',
    ru: 'Кошелёк пуст, но история на месте.',
    es: 'Cartera vaciada. El historial sigue intacto.',
    pt: 'Carteira esvaziada. O histórico continua intacto.',
  },
  neverUsed: {
    en: 'Address never used on mainnet.',
    ru: 'Адрес никогда не использовался в основной сети.',
    es: 'La dirección nunca se usó en la red principal.',
    pt: 'O endereço nunca foi usado na rede principal.',
  },
  openExplorer: {
    en: 'Open in explorer ↗',
    ru: 'Открыть в эксплорере ↗',
    es: 'Abrir en el explorador ↗',
    pt: 'Abrir no explorador ↗',
  },
  pathsCarryHistory: {
    en: 'paths carry history',
    ru: 'путей с историей',
    es: 'rutas con historial',
    pt: 'rotas com histórico',
  },
  transactionsCount: {
    en: 'transactions',
    ru: 'транзакций',
    es: 'transacciones',
    pt: 'transações',
  },
  noTransactions: {
    en: 'No transactions.',
    ru: 'Транзакций нет.',
    es: 'Sin transacciones.',
    pt: 'Sem transações.',
  },
  tabWords: {
    en: 'Wordlist',
    ru: 'Словарь',
    es: 'Lista de palabras',
    pt: 'Lista de palavras',
  },
  tabComplete: {
    en: 'Missing word',
    ru: 'Недостающее слово',
    es: 'Palabra faltante',
    pt: 'Palavra faltante',
  },
  wordPlaceholder: {
    en: 'prefix, substring, or an index 1–2048',
    ru: 'начало или часть слова, либо номер 1–2048',
    es: 'prefijo, fragmento o un índice 1–2048',
    pt: 'prefixo, fragmento ou um índice 1–2048',
  },
  typeQuery: {
    en: 'Type a query.',
    ru: 'Введи запрос.',
    es: 'Escribe una consulta.',
    pt: 'Digite uma consulta.',
  },
  matches: {
    en: 'matches',
    ru: 'совпадений',
    es: 'coincidencias',
    pt: 'correspondências',
  },
  nothingFound: {
    en: 'Nothing found.',
    ru: 'Ничего не найдено.',
    es: 'No se encontró nada.',
    pt: 'Nada encontrado.',
  },
  wordlistTitle: {
    en: 'BIP-39 wordlist',
    ru: 'Словарь BIP-39',
    es: 'Lista de palabras BIP-39',
    pt: 'Lista de palavras BIP-39',
  },
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
  nothingInArchive: {
    en: 'Nothing in the archive.',
    ru: 'В архиве ничего.',
    es: 'Nada en el archivo.',
    pt: 'Nada no arquivo.',
  },
  casesCount: { en: 'case(s)', ru: 'дел', es: 'caso(s)', pt: 'caso(s)' },
  archiveTitle: {
    en: 'Full-text case search',
    ru: 'Полнотекстовый поиск по делам',
    es: 'Búsqueda de texto completo en los casos',
    pt: 'Busca de texto completo nos casos',
  },
  archiveHelp: {
    en: 'Epilogues join the index only once a case is closed — otherwise it would spoil them.',
    ru: 'Эпилоги попадают в поиск только после того, как дело закрыто — иначе это спойлер.',
    es: 'Los epílogos entran en el índice sólo cuando el caso está cerrado: de otro modo serían un spoiler.',
    pt: 'Os epílogos entram no índice só quando o caso está fechado: de outro modo seriam um spoiler.',
  },
  candidates: {
    en: 'candidates',
    ru: 'кандидатов',
    es: 'candidatas',
    pt: 'candidatas',
  },
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
    en: 'One of them opens case {id}',
    ru: 'Одно из них — ключ к делу {id}',
    es: 'Una de ellas abre el caso {id}',
    pt: 'Uma delas abre o caso {id}',
  },
  completeTitle: {
    en: 'Missing-word recovery',
    ru: 'Восстановление недостающего слова',
    es: 'Recuperación de la palabra faltante',
    pt: 'Recuperação da palavra faltante',
  },
  completeHelp: {
    ru: 'Вставь фразу и поставь ? на месте забытого слова. Инструмент решает ровно одну неизвестную позицию: при двух неизвестных валидных вариантов остаются сотни тысяч, и смысла в списке уже нет.',
    en: 'Paste the phrase and put ? where the word is missing. The tool resolves exactly one unknown position: with two, hundreds of thousands of phrases stay valid and the list stops meaning anything.',
    es: 'Pega la frase y pon ? donde falte la palabra. La herramienta resuelve exactamente una posición desconocida: con dos, cientos de miles de frases siguen siendo válidas y la lista deja de significar nada.',
    pt: 'Cole a frase e ponha ? onde falta a palavra. A ferramenta resolve exatamente uma posição desconhecida: com duas, centenas de milhares de frases continuam válidas e a lista deixa de significar nada.',
  },
  findCandidates: {
    en: 'Find candidates',
    ru: 'Найти кандидатов',
    es: 'Buscar candidatas',
    pt: 'Buscar candidatas',
  },
  realWalletTitle: {
    en: 'This is a real wallet',
    ru: 'Это настоящий кошелёк',
    es: 'Esta es una cartera real',
    pt: 'Esta é uma carteira real',
  },
  realWalletBody: {
    ru: 'Фраза собрана из криптостойкой случайности браузера и управляет настоящими адресами Bitcoin. Она записана в журнал этого браузера, чтобы к ней можно было вернуться, — и стирается кнопкой «Очистить» в журнале. Не клади на эти адреса деньги.',
    en: 'The phrase comes from your browser’s cryptographic randomness and controls real Bitcoin addresses. It is written to this browser’s journal so you can come back to it, and Purge in the journal erases it. Do not fund these addresses.',
    es: 'La frase proviene de la aleatoriedad criptográfica de tu navegador y controla direcciones Bitcoin reales. Queda escrita en el diario de este navegador para que puedas volver a ella, y Purgar en el diario la borra. No pongas fondos en estas direcciones.',
    pt: 'A frase vem da aleatoriedade criptográfica do seu navegador e controla endereços Bitcoin reais. Fica escrita no diário deste navegador para que você possa voltar a ela, e Purgar no diário a apaga. Não coloque fundos nestes endereços.',
  },
  randomTitle: {
    en: 'Seed phrase generator',
    ru: 'Генератор сид-фраз',
    es: 'Generador de frases semilla',
    pt: 'Gerador de frases semente',
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
const tf = (key, lang, fields = {}) =>
  Object.entries(fields).reduce(
    (line, [name, value]) => line.split(`{${name}}`).join(value),
    t(key, lang),
  );
//: A fee rate as people quote it: whole numbers over ten, one decimal under.
const fmtRate = (rate) => {
  const value = Number(rate);
  if (!Number.isFinite(value)) return '—';
  return value >= 10 ? value.toFixed(0) : value.toFixed(1);
};

//: Whether each rail window is folded, one key apiece.
const RAIL_FOLD_KEY = 'enigma-terminal/rail';

const stored = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const store = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode: the fold just will not persist */
  }
};

//: UTC, to the second, the way a chain writes its times.
const stamp = (seconds) =>
  `${new Date(Number(seconds) * 1000).toISOString().replace('T', ' ').slice(0, 19)} UTC`;

//: 964 238 rather than 964,238 — the way a chain height is usually set.
const group = (value) =>
  Number(value).toLocaleString('en-US').replace(/,/g, ' ');

const AGO = {
  en: ['just now', 'm ago', 'h ago', 'd ago'],
  ru: ['только что', ' мин назад', ' ч назад', ' дн назад'],
  es: ['ahora', ' min', ' h', ' d'],
  pt: ['agora', ' min', ' h', ' d'],
};

/** How long ago, in the coarsest unit that still says something. */
const ago = (seconds, lang) => {
  const words = AGO[lang] || AGO.en;
  const delta = Math.max(0, Math.floor(Date.now() / 1000) - Number(seconds));
  if (delta < 60) return words[0];
  if (delta < 3600) return `${Math.floor(delta / 60)}${words[1]}`;
  if (delta < 86400) return `${Math.floor(delta / 3600)}${words[2]}`;
  return `${Math.floor(delta / 86400)}${words[3]}`;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clock = (at) => new Date(at).toTimeString().slice(0, 8);

export class GuiApp {
  constructor(
    root,
    {
      lang = 'ru',
      onLangChange = null,
      terminalHost = null,
      onTerminalShown = null,
    } = {},
  ) {
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
    //: Its own client, because its rate limit is its own: three calls every
    //: five seconds, shared across every lookup the panel makes.
    this.chainExplorer = new ExplorerClient();
    this.pulseAge = null;
    this.pulseBlock = null;
    this.explorerPulseCard = null;
    //: The terminal is the first row in the sidebar and the first thing on
    //: screen: the game is a command line with an interface around it, not the
    //: other way round.
    this.panel = 'terminal';
    this.activeCaseId = null;
    this.activeClient = null;
    this.wallet = null;
    this.railOpen = true;
    this.panels = new Map(); // key -> { node, api }
    this.mounted = false;
  }

  setLang(lang) {
    this.lang = lang;
    this.panels.clear(); // every label changes, so rebuild on demand
    // The rail is cached separately and was not being dropped, so the two
    // lookups kept the language the player had just left.
    this.railPanes = null;
    this.paintChrome();
    if (this.mounted) this.render();
    if (this.railOpen) this.paintRail();
  }

  /**
   * The line the strip above the interface shows: node, closed cases, journal
   * size. Same numbers as the sidebar meter, from the same desk.
   */
  deskStatus() {
    const desk = caseload(this.progress);
    return {
      node: this.chain.nodeName,
      closed: desk.filter((entry) => this.progress.isSolved(entry.id)).length,
      total: desk.length,
      log: this.journal.all().length,
    };
  }

  /**
   * The heartbeat's reading, from wherever it is driven.
   *
   * Held on the app rather than in the panel because the panel is rebuilt on
   * every visit and the pulse is not: the clock has to be right the instant it
   * comes back on screen, not one poll later.
   */
  setPulse(age, block) {
    this.pulseAge = age;
    this.pulseBlock = block || this.pulseBlock;
    if (this.explorerPulseCard)
      this.explorerPulseCard.paint(age, this.pulseBlock);
  }

  /** Window titles live outside the panels, so `render` alone cannot reach them. */
  paintChrome() {
    if (!this.navWindow) return;
    // The rail's two windows are titled by paintRail, which owns them.
    const node = this.navWindow.querySelector('.win__title');
    if (node) node.textContent = t('navTitle', this.lang);
    if (this.railOpen) this.paintRail();
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
    this.navWindow = win(t('navTitle', this.lang), this.nav);
    this.contentWindow = win('—', this.content);

    // Two windows, not one pane with two headings inside it. Each is the same
    // furniture as every other window on the page, and each folds on its own:
    // the wordlist is a glance, the recovery tool is a paragraph of chips, and
    // wanting one without the other is the normal case.
    this.railTools = [
      this.buildRailTool('words', 'tabWords'),
      this.buildRailTool('complete', 'tabComplete'),
    ];
    this.railWindow = el(
      'div',
      { class: 'rail' },
      ...this.railTools.map((tool) => tool.window),
    );

    this.railTab = el('button', {
      class: 'rail-tab',
      type: 'button',
      text: '⌕',
      title: t('railTitle', this.lang),
      onClick: () => this.toggleRail(),
    });

    replace(
      this.root,
      this.navWindow,
      this.contentWindow,
      this.railWindow,
      this.railTab,
    );
    this.journal.subscribe(() => {
      this.paintRail();
      this.panels.delete('journal');
      if (this.panel === 'journal') this.render();
    });
    this.mounted = true;
    this.applyRail();
    this.render();
  }

  /**
   * One folding window in the rail.
   *
   * The fold is remembered: a panel that springs back open on every visit is a
   * setting the player is not allowed to keep.
   */
  buildRailTool(id, titleKey) {
    const body = el('div', { class: 'win__body rail__body' });
    const collapse = el('button', {
      class: 'win__collapse',
      type: 'button',
      'aria-expanded': 'true',
      title: t(titleKey, this.lang),
      text: '–',
    });
    const node = win(t(titleKey, this.lang), body, collapse);
    node.classList.add('rail__win');
    const tool = {
      id,
      titleKey,
      node,
      window: node,
      body,
      collapse,
      folded: false,
    };
    collapse.addEventListener('click', () =>
      this.foldRailTool(tool, !tool.folded),
    );
    this.foldRailTool(tool, stored(`${RAIL_FOLD_KEY}/${id}`) === 'folded', {
      save: false,
    });
    return tool;
  }

  foldRailTool(tool, folded, { save = true } = {}) {
    tool.folded = Boolean(folded);
    tool.node.classList.toggle('is-folded', tool.folded);
    tool.collapse.textContent = tool.folded ? '+' : '–';
    tool.collapse.setAttribute('aria-expanded', String(!tool.folded));
    if (save)
      store(`${RAIL_FOLD_KEY}/${tool.id}`, tool.folded ? 'folded' : 'open');
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
    const build = {
      cases: () => this.buildCaseList(),
      board: () => this.buildBoard(),
      decrypt: () => this.buildDecrypt(),
      ledger: () => this.buildLedger(),
      terminal: () => this.buildTerminal(),
      explorer: () => this.buildExplorer(),
      archive: () => this.buildArchive(),
      random: () => this.buildRandom(),
      journal: () => this.buildJournal(),
      about: () => this.buildAbout(),
    }[key];
    // A panel id with no builder used to call undefined() and take the whole
    // interface down. Say what is missing instead of dying.
    if (!build) throw new Error(`no builder for panel "${key}"`);
    return build();
  }

  render() {
    this.paintNav();
    const panel = PANELS.find((p) => p.id === this.panel);
    this.contentWindow.querySelector('.win__title').textContent = pick(
      panel.label,
      this.lang,
    );
    const { node } = this.ensurePanel(this.panelKey());
    replace(this.content, node);
    // The canvas had no box while it was off screen, so it can only measure
    // itself once it has been put back into the flow.
    if (this.panel === 'terminal' && this.onTerminalShown)
      this.onTerminalShown();
    else if (this.terminalHost) this.terminalHost.classList.add('is-hidden');
    if (this.railOpen) this.paintRail();
  }

  // ---- sidebar ----------------------------------------------------------

  paintNav() {
    // The meter tracks the desk — campaign plus taken contracts — not the
    // whole board, which would sit at 8/264 forever and tell the player nothing.
    const desk = caseload(this.progress);
    const solved = desk.filter((entry) =>
      this.progress.isSolved(entry.id),
    ).length;
    const percent = desk.length ? Math.round((solved / desk.length) * 100) : 0;
    replace(
      this.nav,
      el(
        'ul',
        { class: 'nav__list' },
        ...PANELS.map((panel) =>
          el(
            'li',
            {},
            el(
              'button',
              {
                class: 'nav__item',
                type: 'button',
                title: `${pick(panel.label, this.lang)} · ${panel.key}`,
                'aria-current': this.panel === panel.id ? 'true' : 'false',
                onClick: () => this.openSection(panel.id),
              },
              icon(panel.glyph),
              el('span', { text: pick(panel.label, this.lang) }),
            ),
          ),
        ),
      ),
      el('div', { class: 'nav__sep' }),
      el(
        'div',
        { class: 'nav__meter' },
        el('div', {
          text: `${solved}/${desk.length} ${t('closedCount', this.lang)}`,
        }),
        el(
          'div',
          { class: 'nav__bar' },
          el('span', { style: `width:${percent}%` }),
        ),
      ),
      el('div', { class: 'nav__sep' }),
      el(
        'div',
        { class: 'nav__meter' },
        el('div', { text: `OPERATOR ${META.operator}` }),
      ),
    );
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
    for (const tool of this.railTools || []) {
      replace(tool.body, this.railPanes[tool.id].node);
      tool.node.querySelector('.win__title').textContent = t(
        tool.titleKey,
        this.lang,
      );
    }
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
      this.go('archive');
      this.ensurePanel('archive').api.run(payload.query || '');
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
      replace(
        body,
        entries.length
          ? el(
              'div',
              {},
              ...entries.map((entry, index) => {
                const tool = TOOLS[entry.tool] || {
                  glyph: '·',
                  label: { en: entry.tool },
                };
                return el(
                  'div',
                  { class: `card log log--${entry.status}` },
                  el(
                    'div',
                    { class: 'log__row' },
                    el('span', { class: 'log__n', text: String(index + 1) }),
                    this.entrySigil(entry, 22),
                    el('span', { class: 'log__glyph', text: tool.glyph }),
                    el(
                      'div',
                      { class: 'log__body' },
                      el('div', { class: 'log__title', text: entry.title }),
                      entry.detail
                        ? el('div', {
                            class: 'log__detail',
                            text: entry.detail,
                          })
                        : null,
                      el('div', {
                        class: 'log__meta',
                        text: `${clock(entry.at)} · ${pick(tool.label, lang)}`,
                      }),
                    ),
                    el(
                      'div',
                      { class: 'row row--tight' },
                      el('button', {
                        class: 'btn',
                        style: 'padding:2px 8px;font-size:10px',
                        type: 'button',
                        text: t('recall', lang),
                        onClick: () => this.recall(entry),
                      }),
                      el('button', {
                        class: 'btn',
                        style: 'padding:2px 8px;font-size:10px',
                        type: 'button',
                        'aria-pressed': entry.pinned ? 'true' : 'false',
                        text: entry.pinned ? '★' : '☆',
                        title: t('pin', lang),
                        onClick: () => {
                          this.journal.togglePin(entry.id);
                          paint();
                        },
                      }),
                      el('button', {
                        class: 'btn',
                        style: 'padding:2px 8px;font-size:10px',
                        type: 'button',
                        text: '✕',
                        onClick: () => {
                          this.journal.remove(entry.id);
                          paint();
                        },
                      }),
                    ),
                  ),
                );
              }),
            )
          : empty(t('emptyJournal', lang)),
      );
    };

    const counts = this.journal.counts();
    const filterRow = el(
      'div',
      { class: 'row row--tight' },
      el('button', {
        class: 'btn',
        type: 'button',
        'aria-pressed': 'true',
        text: t('all', lang),
        onClick: (event) => {
          filter = '';
          filterRow
            .querySelectorAll('.btn')
            .forEach((b) => b.setAttribute('aria-pressed', 'false'));
          event.currentTarget.setAttribute('aria-pressed', 'true');
          paint();
        },
      }),
      ...Object.keys(TOOLS)
        .filter((key) => counts[key])
        .map((key) =>
          el('button', {
            class: 'btn',
            type: 'button',
            'aria-pressed': 'false',
            text: `${TOOLS[key].glyph} ${pick(TOOLS[key].label, lang)} ${counts[key]}`,
            onClick: (event) => {
              filter = key;
              filterRow
                .querySelectorAll('.btn')
                .forEach((b) => b.setAttribute('aria-pressed', 'false'));
              event.currentTarget.setAttribute('aria-pressed', 'true');
              paint();
            },
          }),
        ),
    );

    paint();
    replace(
      node,
      section(t('journal', lang), `${this.journal.all().length}`),
      el('p', { class: 'hint-text', text: t('journalHelp', lang) }),
      filterRow,
      el(
        'div',
        { class: 'row' },
        el('button', {
          class: 'btn',
          type: 'button',
          text: t('exportTxt', lang),
          onClick: async () => {
            const text = this.journal.toText(lang);
            try {
              await navigator.clipboard.writeText(text);
            } catch {
              /* clipboard blocked; the download below still works */
            }
            const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = el('a', {
              href: url,
              download: 'enigma-terminal-journal.txt',
            });
            document.body.append(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
          },
        }),
        el('button', {
          class: 'btn',
          type: 'button',
          text: `${t('purge', lang)} · ${t('keepPinned', lang)}`,
          onClick: () => {
            this.journal.clear({ keepPinned: true });
            paint();
          },
        }),
        el('button', {
          class: 'btn',
          type: 'button',
          text: `${t('purge', lang)} · ${t('all', lang)}`,
          onClick: () => {
            this.journal.clear();
            paint();
          },
        }),
      ),
      body,
    );
    return { node, api: { paint } };
  }

  // ---- cases ------------------------------------------------------------

  caseRow(caseFile, { droppable = false, onDropped = null } = {}) {
    const lang = this.lang;
    const state = caseState(caseFile, this.progress);
    const client = caseFile.client ? clientBySlug(caseFile.client) : null;
    const row = el(
      'button',
      {
        class: 'card__row',
        type: 'button',
        disabled: state === 'locked',
        onClick: () => state !== 'locked' && this.go('cases', caseFile.id),
      },
      caseSigil(caseFile, { size: 26 }),
      el('span', {
        class: 'card__id',
        text: String(caseFile.id).padStart(2, '0'),
      }),
      el(
        'div',
        { class: 'client__head' },
        el('div', { class: 'card__name', text: pick(caseFile.codename, lang) }),
        client
          ? el('div', { class: 'client__kind', text: pick(client.name, lang) })
          : null,
      ),
      el('span', { class: 'card__spacer' }),
      el('span', { class: 'stars', text: '★'.repeat(caseFile.difficulty) }),
      badge(
        state === 'solved' ? 'solved' : state === 'locked' ? 'locked' : 'open',
        t(state, lang),
      ),
    );

    if (!droppable || state === 'solved')
      return el('div', { class: 'card' }, row);
    return el(
      'div',
      { class: 'card case-row' },
      row,
      el('button', {
        class: 'btn case-row__drop',
        type: 'button',
        title: t('drop', lang),
        text: '✕',
        onClick: () => {
          this.progress.drop(caseFile.id);
          this.panels.delete('cases');
          this.paintNav();
          if (onDropped) onDropped();
        },
      }),
    );
  }

  buildCaseList() {
    const lang = this.lang;
    const node = el('div', {});

    const paint = () => {
      const desk = caseload(this.progress).filter((entry) => entry.client);
      const campaignSolved = CAMPAIGN_CASES.filter((entry) =>
        this.progress.isSolved(entry.id),
      ).length;
      const deskSolved = desk.filter((entry) =>
        this.progress.isSolved(entry.id),
      ).length;

      replace(
        node,
        section(
          t('campaign', lang),
          `${campaignSolved}/${CAMPAIGN_CASES.length}`,
        ),
        ...CAMPAIGN_CASES.map((caseFile) => this.caseRow(caseFile)),
        el('div', { style: 'height:16px' }),
        section(
          t('taken', lang),
          desk.length ? `${deskSolved}/${desk.length}` : '',
        ),
        ...(desk.length
          ? desk.map((caseFile) =>
              this.caseRow(caseFile, { droppable: true, onDropped: paint }),
            )
          : [
              empty(t('takenNone', lang)),
              el(
                'div',
                { class: 'row', style: 'justify-content:center' },
                el('button', {
                  class: 'btn',
                  type: 'button',
                  text: t('openBoard', lang),
                  onClick: () => this.go('board'),
                }),
              ),
            ]),
      );
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
        replace(
          body,
          el('p', { class: 'spinner-line', text: t('loadingBoard', lang) }),
        );
        return;
      }
      replace(
        body,
        ...CLIENTS.map((client) => {
          const cases = casesForClient(client.slug);
          const solved = cases.filter((entry) =>
            this.progress.isSolved(entry.id),
          ).length;
          const percent = cases.length
            ? Math.round((solved / cases.length) * 100)
            : 0;
          return el(
            'div',
            { class: 'card client' },
            el(
              'button',
              {
                class: 'card__row',
                type: 'button',
                onClick: () => {
                  this.activeClient = client.slug;
                  this.go('board');
                },
              },
              sigil(`enigma-client-${client.slug}`, { size: 30 }),
              el(
                'div',
                { class: 'client__head' },
                el('div', {
                  class: 'card__name',
                  text: pick(client.name, lang),
                }),
                el('div', {
                  class: 'client__kind',
                  text: pick(client.kind, lang),
                }),
              ),
              el('span', { class: 'card__spacer' }),
              el('span', {
                class: 'section__meta',
                text: pick(client.district, lang),
              }),
              badge(
                solved === cases.length && cases.length ? 'solved' : 'open',
                `${solved}/${cases.length}`,
              ),
            ),
            el(
              'div',
              { class: 'client__bar' },
              el('span', { style: `width:${percent}%` }),
            ),
          );
        }),
      );
    };

    replace(
      node,
      section(t('board', lang), `${CLIENTS.length} × 32 = 256`),
      el('p', { class: 'hint-text', text: t('clientsHelp', lang) }),
      body,
    );

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
      return el(
        'div',
        { class: 'stack' },
        section(
          `${act}. ${client.acts[lang][act - 1]}`,
          `${inAct.filter((e) => this.progress.isSolved(e.id)).length}/${inAct.length}`,
        ),
        ...inAct.map((caseFile) => {
          const state = caseState(caseFile, this.progress);
          return el(
            'div',
            { class: 'card' },
            el(
              'button',
              {
                class: 'card__row',
                type: 'button',
                disabled: state === 'locked',
                onClick: () =>
                  state !== 'locked' && this.go('cases', caseFile.id),
              },
              caseSigil(caseFile, { size: 24 }),
              el('span', {
                class: 'card__id',
                text: String(caseFile.id).padStart(3, '0'),
              }),
              el('span', {
                class: 'card__name',
                text: pick(caseFile.codename, lang),
              }),
              el('span', { class: 'card__spacer' }),
              el('span', {
                class: 'section__meta',
                text: caseFile.archetype.replace('_', ' '),
              }),
              el('span', {
                class: 'stars',
                text: '★'.repeat(caseFile.difficulty),
              }),
              badge(
                state === 'solved'
                  ? 'solved'
                  : state === 'locked'
                    ? 'locked'
                    : 'open',
                t(state, lang),
              ),
            ),
          );
        }),
      );
    });

    replace(
      node,
      el(
        'div',
        { class: 'row', style: 'margin-bottom:12px' },
        el('button', {
          class: 'btn',
          type: 'button',
          text: '← ' + t('backToClients', lang),
          onClick: () => {
            this.activeClient = null;
            this.go('board');
          },
        }),
        sigil(`enigma-client-${slug}`, { size: 30 }),
        el('span', { class: 'card__spacer' }),
        el('span', {
          class: 'section__meta',
          text: pick(client.district, lang),
        }),
      ),
      section(pick(client.name, lang), pick(client.kind, lang)),
      el(
        'div',
        { class: 'prose' },
        ...pick(client.creed, lang).map((line) => el('p', { text: line })),
      ),
      notice('info', t('dialect', lang), pick(client.dialect, lang)),
      el('div', { class: 'stack', style: 'margin-top:14px' }, ...acts),
    );
    return { node, api: {} };
  }

  buildCaseDetail(caseFile) {
    const lang = this.lang;
    const state = caseState(caseFile, this.progress);

    // Reading a contract is taking it: the board is where work is offered, the
    // Case files tab is the desk it lands on.
    if (
      caseFile.client &&
      state !== 'locked' &&
      this.progress.take(caseFile.id)
    ) {
      this.panels.delete('cases');
      this.log(
        'case',
        `${t('takenLog', lang)}: ${pick(caseFile.codename, lang)}`,
        {
          detail: pick(clientBySlug(caseFile.client).name, lang),
          payload: { caseId: caseFile.id },
        },
      );
      this.paintNav();
    }
    const hints = pick(caseFile.hints, lang);
    const node = el('div', {});

    const head = [
      el(
        'div',
        { class: 'row', style: 'margin-bottom:12px' },
        el('button', {
          class: 'btn',
          type: 'button',
          text: `← ${t('backToCases', lang)}`,
          onClick: () => {
            this.activeCaseId = null;
            this.go('cases');
          },
        }),
        caseSigil(caseFile, { size: 30 }),
        el('span', { class: 'card__spacer' }),
        el('span', { class: 'stars', text: '★'.repeat(caseFile.difficulty) }),
        badge(
          state === 'solved'
            ? 'solved'
            : state === 'locked'
              ? 'locked'
              : 'open',
          t(state, lang),
        ),
      ),
      section(
        `${String(caseFile.id).padStart(2, '0')} · ${pick(caseFile.codename, lang)}`,
      ),
    ];

    if (state === 'locked') {
      replace(
        node,
        ...head,
        notice(
          'warn',
          t('lockedMsg', lang),
          missingRequirements(caseFile, this.progress).join(', '),
        ),
      );
      return { node, api: {} };
    }

    const hintBox = el('div', { class: 'stack' });
    const paintHints = () => {
      const shown = this.progress.hintsUsed(caseFile.id);
      replace(
        hintBox,
        ...hints
          .slice(0, shown)
          .map((hint, i) => notice('info', `${i + 1}/${hints.length}`, hint)),
        shown < hints.length
          ? el('button', {
              class: 'btn',
              type: 'button',
              text: t('spendHint', lang),
              onClick: () => {
                const used = this.progress.useHint(caseFile.id);
                this.log(
                  'hint',
                  `${pick(caseFile.codename, lang)} — hint ${used}/${hints.length}`,
                  { detail: hints[used - 1], payload: { caseId: caseFile.id } },
                );
                paintHints();
                this.paintNav();
              },
            })
          : el('p', { class: 'hint-text', text: t('noHints', lang) }),
      );
    };
    paintHints();

    const input = el('textarea', {
      class: 'field',
      rows: '3',
      spellcheck: 'false',
      placeholder: t('seedPlaceholder', lang),
    });
    const result = el('div', {});
    const submit = el('button', {
      class: 'btn btn--primary',
      type: 'button',
      text: t('derive', lang),
      onClick: async () => {
        submit.disabled = true;
        replace(
          result,
          el('p', { class: 'spinner-line', text: t('deriving', lang) }),
        );
        await sleep(16);
        try {
          const wallet = deriveWallet(input.value);
          this.wallet = wallet;
          const owner = caseForMnemonic(wallet.mnemonic);
          const out = [
            notice('ok', t('checksumOk', lang), wallet.primary.address),
          ];
          if (owner && owner.id === caseFile.id) {
            const first = this.progress.markSolved(caseFile.id);
            this.panels.delete('cases');
            this.paintNav();
            if (first) {
              this.log(
                'case',
                `${t('caseWord', lang)} ${caseFile.id} — ${pick(caseFile.codename, lang)}`,
                {
                  detail: wallet.primary.address,
                  status: 'ok',
                  payload: { caseId: caseFile.id, mnemonic: wallet.mnemonic },
                },
              );
            }
            const employer = caseFile.client
              ? clientBySlug(caseFile.client)
              : null;
            out.push(
              notice(
                'ok',
                tf('caseClosed', lang, { id: caseFile.id }),
                ...(employer
                  ? [
                      tf('filedWith', lang, {
                        client: pick(employer.name, lang),
                      }),
                    ]
                  : []),
                ...pick(caseFile.epilogue, lang),
              ),
            );
            const campaignDone = CAMPAIGN_CASES.every((entry) =>
              this.progress.isSolved(entry.id),
            );
            if (first && campaignDone) {
              out.push(notice('ok', t('allEightClosed', lang)));
            }
          } else if (owner) {
            out.push(
              notice('warn', tf('keyToOtherCase', lang, { id: owner.id })),
            );
          } else {
            out.push(notice('warn', t('validNotThisCase', lang)));
          }
          this.recordDecrypt(wallet, owner);
          out.push(this.derivationTable(wallet));
          replace(result, ...out);
        } catch (error) {
          this.log('decrypt', error.message, { status: 'danger' });
          replace(
            result,
            notice(
              'danger',
              error instanceof MnemonicError ? 'DECRYPTION FAILED' : 'ERROR',
              error.message,
            ),
          );
        } finally {
          submit.disabled = false;
        }
      },
    });

    replace(
      node,
      ...head,
      el(
        'div',
        { class: 'prose' },
        ...pick(caseFile.brief, lang).map((line) => el('p', { text: line })),
      ),
      section(t('evidence', lang)),
      el('div', {
        class: 'evidence',
        text: pick(caseFile.evidence, lang).join('\n'),
      }),
      section(t('clues', lang)),
      el('div', {
        class: 'clues',
        text: pick(caseFile.clues, lang).join('\n'),
      }),
      section(t('hints', lang)),
      hintBox,
      section(t('submit', lang)),
      el(
        'div',
        { class: 'stack' },
        input,
        el('div', { class: 'row' }, submit),
        result,
      ),
    );
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
    return el(
      'div',
      { class: 'stack' },
      el(
        'div',
        { class: 'row' },
        mnemonicSigil(wallet.mnemonic, { size: 44 }),
        el('span', {
          class: 'section__meta',
          text: t('sigilOfPhrase', this.lang),
        }),
      ),
      section(t('derivation', this.lang)),
      table(
        ['', 'PATH', 'TYPE', 'ADDRESS'],
        wallet.addresses.map((entry) => [
          { node: addressSigil(entry.address, { size: 30 }) },
          { text: entry.path },
          { text: entry.label },
          {
            class: 'addr',
            node: el(
              'span',
              {},
              entry.address,
              ' ',
              this.copyButton(entry.address),
              ' ',
              el('button', {
                class: 'btn',
                style: 'padding:1px 7px;font-size:10px',
                type: 'button',
                text: '₿',
                title: t('syncOne', this.lang),
                onClick: () => {
                  this.go('ledger');
                  this.ensurePanel('ledger').api.run(entry.address, 'ledger');
                },
              }),
            ),
          },
        ]),
      ),
      el(
        'details',
        {},
        el('summary', {
          class: 'hint-text',
          style: 'cursor:pointer;margin:8px 0',
          text: t('keysAndSeed', this.lang),
        }),
        kv([
          ['BIP39 SEED', wallet.seed],
          ['MASTER XPRV', wallet.masterXprv],
          ...wallet.addresses.map((e) => [
            `PUBKEY m/${e.purpose}'`,
            e.publicKey,
          ]),
        ]),
      ),
    );
  }

  copyButton(value) {
    const button = el('button', {
      class: 'btn',
      type: 'button',
      style: 'padding:1px 7px;font-size:10px',
      text: t('copy', this.lang),
      onClick: async () => {
        try {
          await navigator.clipboard.writeText(value);
          button.textContent = t('copied', this.lang);
          setTimeout(() => {
            button.textContent = t('copy', this.lang);
          }, 1200);
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
      class: 'field',
      rows: '3',
      spellcheck: 'false',
      placeholder: t('seedPlaceholder', lang),
    });
    const output = el('div', {});

    const run = async (phrase = null) => {
      if (phrase !== null) input.value = phrase;
      replace(
        output,
        el('p', { class: 'spinner-line', text: t('deriving', lang) }),
      );
      await sleep(16);
      try {
        const wallet = deriveWallet(input.value);
        this.wallet = wallet;
        const owner = caseForMnemonic(wallet.mnemonic);
        this.recordDecrypt(wallet, owner);
        replace(
          output,
          notice('ok', t('checksumOk', lang)),
          owner
            ? notice(
                'info',
                tf('seedOfCase', lang, { id: owner.id }),
                pick(owner.codename, lang),
              )
            : null,
          kv([['ENTROPY', toHex(mnemonicToEntropy(wallet.mnemonic))]]),
          this.derivationTable(wallet),
        );
      } catch (error) {
        this.log('decrypt', error.message, { status: 'danger' });
        replace(output, notice('danger', 'DECRYPTION FAILED', error.message));
      }
    };

    const node = el(
      'div',
      {},
      section(t('seedLabel', lang)),
      el(
        'div',
        { class: 'stack' },
        input,
        el(
          'div',
          { class: 'row' },
          el('button', {
            class: 'btn btn--primary',
            type: 'button',
            text: t('derive', lang),
            onClick: () => run(),
          }),
          el('button', {
            class: 'btn',
            type: 'button',
            text: t('fromEntropy', lang),
            onClick: () => {
              const hex = prompt(t('entropyPrompt', lang));
              if (!hex) return;
              try {
                run(entropyToMnemonic(fromHex(hex.trim())));
              } catch (error) {
                replace(
                  output,
                  notice('danger', 'ENTROPY REJECTED', error.message),
                );
              }
            },
          }),
        ),
        el('p', { class: 'hint-text', text: t('decryptHelp', lang) }),
        output,
      ),
    );

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
      class: 'field',
      type: 'text',
      spellcheck: 'false',
      placeholder: '1... / 3... / bc1...',
      value: this.wallet ? this.wallet.primary.address : '',
    });
    const output = el('div', {});

    const sync = async () => {
      const target = address.value.trim();
      if (!target) return replace(output, notice('warn', t('noWallet', lang)));
      replace(
        output,
        el('p', { class: 'spinner-line', text: t('working', lang) }),
      );
      try {
        const stats = await this.chain.addressStats(target);
        const used = stats.txCount > 0 || stats.totalReceivedSats > 0n;
        this.log('ledger', target, {
          status: stats.confirmedSats > 0n ? 'warn' : used ? 'info' : 'info',
          detail: `${formatBtc(stats.confirmedSats)} BTC · ${stats.txCount} tx · ${stats.provider}`,
          payload: { address: target },
        });
        replace(
          output,
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
            class: 'hint-text',
            target: '_blank',
            rel: 'noopener',
            href: this.chain.explorerUrl(target),
            text: t('openExplorer', lang),
          }),
        );
      } catch (error) {
        this.log('ledger', target, {
          status: 'danger',
          detail: error.message,
          payload: { address: target },
        });
        replace(output, notice('danger', 'NETWORK LINK DOWN', error.message));
      }
    };

    const sweep = async () => {
      if (!this.wallet)
        return replace(output, notice('warn', t('noWallet', lang)));
      replace(
        output,
        el('p', { class: 'spinner-line', text: t('working', lang) }),
      );
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
            {
              node: badge(used ? 'solved' : 'locked', used ? 'USED' : 'UNUSED'),
            },
          ]);
        } catch {
          rows.push([
            { text: `m/${entry.purpose}'` },
            { class: 'addr', text: entry.address },
            { text: '—' },
            { text: '—' },
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
      replace(
        output,
        el('p', { class: 'spinner-line', text: t('working', lang) }),
      );
      try {
        const txs = await this.chain.transactions(target, 10);
        this.log('txlog', target, {
          detail: `${txs.length} ${t('transactionsCount', lang)}`,
          payload: { address: target },
        });
        replace(
          output,
          txs.length
            ? table(
                ['STATE', 'BLOCK', 'TXID'],
                txs.map((tx) => [
                  {
                    node: badge(
                      tx.confirmed ? 'solved' : 'warn',
                      tx.confirmed ? 'CONFIRMED' : 'PENDING',
                    ),
                  },
                  {
                    class: 'num',
                    text: tx.blockHeight ? String(tx.blockHeight) : 'mempool',
                  },
                  { class: 'addr', text: tx.txid },
                ]),
              )
            : empty(t('noTransactions', lang)),
        );
      } catch (error) {
        replace(
          output,
          notice('danger', 'TX HISTORY UNAVAILABLE', error.message),
        );
      }
    };

    const providerRow = el(
      'div',
      { class: 'row row--tight' },
      ...Object.entries(PROVIDERS).map(([key, provider]) =>
        el('button', {
          class: 'btn',
          type: 'button',
          'aria-pressed': this.chain.order[0] === key ? 'true' : 'false',
          text: provider.name,
          onClick: (event) => {
            this.chain.preferred = key;
            providerRow
              .querySelectorAll('.btn')
              .forEach((b) => b.setAttribute('aria-pressed', 'false'));
            event.currentTarget.setAttribute('aria-pressed', 'true');
            this.paintNav();
          },
        }),
      ),
    );

    const node = el(
      'div',
      {},
      section('LIVE BITCOIN NETWORK', this.chain.nodeName),
      el(
        'div',
        { class: 'stack' },
        address,
        el(
          'div',
          { class: 'row' },
          el('button', {
            class: 'btn btn--primary',
            type: 'button',
            text: t('syncOne', lang),
            onClick: sync,
          }),
          el('button', {
            class: 'btn',
            type: 'button',
            text: t('sweep', lang),
            onClick: sweep,
          }),
          el('button', {
            class: 'btn',
            type: 'button',
            text: t('txlog', lang),
            onClick: txlog,
          }),
        ),
        providerRow,
        output,
      ),
    );

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
    const node =
      this.terminalHost || el('div', { class: 'hint-text', text: '—' });
    return { node, api: {} };
  }

  // ---- explorer: the live chain, read from mempool.space ------------------

  /**
   * One box, four kinds of answer.
   *
   * The chain is one namespace as far as a person is concerned — you have a
   * string and you want to know what it is — so the panel takes any of the
   * four and works out which by shape. A sixty-four character hash is the one
   * ambiguous case: it tries the block index first, because blocks are five
   * orders of magnitude fewer than transactions, and falls back.
   */
  buildExplorer() {
    const lang = this.lang;
    const input = el('input', {
      class: 'field',
      type: 'search',
      spellcheck: 'false',
      placeholder: t('explorerPlaceholder', lang),
    });
    const output = el('div', {});
    let showing = null;

    const fail = (error) =>
      replace(
        output,
        notice('danger', t('explorerTitle', lang), error.message),
      );

    const overview = async () => {
      showing = null;
      // The clock is up before the network is asked anything: the heartbeat
      // already knows the height and the age, so the panel opens with them
      // rather than with a spinner.
      const pulse = this.explorerPulse();
      this.explorerPulseCard = pulse;
      pulse.paint(this.pulseAge, this.pulseBlock);
      replace(
        output,
        pulse.node,
        el('p', { class: 'spinner-line', text: t('lookingUp', lang) }),
      );
      try {
        const tip = await this.chainExplorer.tip();
        if (showing !== null) return;
        pulse.paint(this.pulseAge, this.pulseBlock);
        replace(output, pulse.node, this.explorerTip(tip));
        // Each of these costs one more call, so they land in turn and never
        // hold back what is already on screen.
        const [pool, fees] = await Promise.all([
          this.chainExplorer.mempool(),
          this.chainExplorer.fees().catch(() => null),
        ]);
        if (showing !== null) return;
        pulse.paintPool(pool, fees);
        output.append(this.explorerPool(pool, fees));
        const pow = await this.explorerPow(tip);
        if (showing === null) output.append(pow);
      } catch (error) {
        fail(error);
      }
    };

    const run = async (value = null) => {
      if (value !== null) input.value = value;
      const { kind, value: query } = classify(input.value);
      if (!query) return overview();
      if (!kind) {
        return replace(
          output,
          notice('warn', t('explorerTitle', lang), t('nothingLikeIt', lang)),
        );
      }
      showing = query;
      this.explorerPulseCard = null;
      replace(
        output,
        el('p', { class: 'spinner-line', text: t('lookingUp', lang) }),
      );
      try {
        if (kind === 'height') {
          replace(
            output,
            this.explorerTip(await this.chainExplorer.block(query), {
              seek: true,
            }),
          );
        } else if (kind === 'address') {
          replace(output, await this.explorerAddress(query));
        } else {
          // Hash: a block or a transaction, and only the chain knows which.
          let block = null;
          try {
            block = await this.chainExplorer.block(query);
          } catch (error) {
            if (error.status !== 404) throw error;
          }
          replace(
            output,
            block
              ? this.explorerTip(block, { seek: true })
              : this.explorerTransaction(
                  await this.chainExplorer.transaction(query),
                ),
          );
        }
        // Only the address lookup is journalled, and under the tool that
        // already means exactly that, so RECALL lands somewhere real. Blocks
        // and transactions get their own entry once the terminal has the
        // commands to replay them in.
        if (kind === 'address') {
          this.log('ledger', query, {
            detail: t('explorerTitle', lang),
            payload: { address: query },
          });
        }
      } catch (error) {
        fail(error);
      }
    };

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') run();
    });

    const node = el(
      'div',
      {},
      section(t('explorerTitle', lang), t('sourceIsLive', lang)),
      el(
        'div',
        { class: 'stack' },
        el(
          'div',
          { class: 'row' },
          input,
          el('button', {
            class: 'btn btn--primary',
            type: 'button',
            text: t('lookUp', lang),
            onClick: () => run(),
          }),
        ),
        el('p', { class: 'hint-text', text: t('explorerHelp', lang) }),
        output,
      ),
    );
    overview();
    return { node, api: { run: (value) => run(value) } };
  }

  /**
   * The pulse, as a clock.
   *
   * Height, then how long the chain has been quiet, then what is waiting. It is
   * driven by the shared heartbeat rather than by its own polling, so opening
   * the panel costs nothing and the seconds it shows are the same seconds the
   * strip above is showing.
   */
  explorerPulse() {
    const lang = this.lang;
    const height = el('div', { class: 'pulse__height', text: '—' });
    const digits = ['hours', 'minutes', 'secondsUnit'].map((unit) => {
      const value = el('span', { class: 'pulse__n', text: '00' });
      return {
        value,
        node: el(
          'div',
          { class: 'pulse__field' },
          value,
          el('span', { class: 'pulse__unit', text: t(unit, lang) }),
        ),
      };
    });
    const pool = el('span', { class: 'pulse__pool', text: '—' });
    const fee = el('span', { class: 'pulse__fee', text: '—' });

    const paint = (age, block) => {
      height.textContent = block ? group(block.height) : '—';
      const split = splitAge(age === null ? 0 : age);
      digits[0].value.textContent = pad2(split.hours);
      digits[1].value.textContent = pad2(split.minutes);
      digits[2].value.textContent = pad2(split.seconds);
    };
    const paintPool = (mempool, fees) => {
      pool.textContent = group(mempool?.count || 0);
      fee.textContent = fmtRate(fees?.halfHourFee);
    };

    return {
      node: el(
        'div',
        { class: 'pulse' },
        el('span', { class: 'pulse__label', text: t('lastBlock', lang) }),
        height,
        el('span', { class: 'pulse__label', text: t('sinceLastBlock', lang) }),
        el('div', { class: 'pulse__clock' }, ...digits.map((d) => d.node)),
        el(
          'div',
          { class: 'pulse__foot' },
          el(
            'div',
            { class: 'pulse__cell' },
            pool,
            el('span', {
              class: 'pulse__unit',
              text: t('poolTransactions', lang),
            }),
          ),
          el(
            'div',
            { class: 'pulse__cell' },
            el(
              'span',
              {},
              fee,
              el('span', { class: 'pulse__sat', text: 's/vByte' }),
            ),
            el('span', { class: 'pulse__unit', text: t('bestFee', lang) }),
          ),
        ),
      ),
      paint,
      paintPool,
    };
  }

  /** The fee-rate histogram the service keeps, drawn as it stands. */
  feeSpread(txs) {
    const buckets = Object.entries(txs.feeRateMap || {})
      .map(([rate, cell]) => ({ rate: Number(rate), count: cell.count || 0 }))
      .filter((bucket) => Number.isFinite(bucket.rate))
      .sort((a, b) => a.rate - b.rate)
      .slice(0, 30);
    if (!buckets.length) return null;
    const peak = Math.max(1, ...buckets.map((bucket) => bucket.count));
    return el(
      'div',
      { class: 'stack' },
      el('p', { class: 'section__meta', text: t('feeRateSpread', this.lang) }),
      el(
        'div',
        { class: 'spread' },
        ...buckets.map((bucket) =>
          el('span', {
            class: 'spread__bar',
            style: `height:${Math.max(3, Math.round((bucket.count / peak) * 100))}%`,
            title: `${bucket.rate} sat/vB · ${bucket.count}`,
          }),
        ),
      ),
      el(
        'div',
        { class: 'spread__scale' },
        el('span', { text: `${buckets[0].rate} sat/vB` }),
        el('span', { text: `${buckets[buckets.length - 1].rate} sat/vB` }),
      ),
    );
  }

  /** The chain tip, or any block, with the pool that found it. */
  explorerTip(block, { seek = false } = {}) {
    const lang = this.lang;
    const extras = block.extras || {};
    let header = null;
    try {
      if (extras.header) header = readHeader(extras.header);
    } catch {
      header = null;
    }
    const agrees = header && header.hash === block.id;
    const pool = extras.pool?.name;

    return el(
      'div',
      { class: 'stack' },
      section(
        seek ? t('blockTitle', lang) : t('chainTip', lang),
        `#${group(block.height)}`,
      ),
      el(
        'div',
        { class: 'chain-card' },
        el(
          'div',
          { class: 'chain-card__head' },
          addressSigil(block.id, { size: 34 }),
          el(
            'div',
            { class: 'chain-card__id' },
            el('span', {
              class: 'chain-card__n',
              text: `#${group(block.height)}`,
            }),
            el('span', { class: 'addr break', text: block.id }),
          ),
        ),
        kv(
          [
            [
              t('mined', lang),
              `${stamp(block.timestamp)} · ${ago(block.timestamp, lang)}`,
            ],
            pool ? [t('minedBy', lang), pool] : null,
            [t('transactionsIn', lang), group(block.tx_count)],
            [
              t('sizeWeight', lang),
              `${(block.size / 1000000).toFixed(2)} MB · ${group(block.weight)} WU`,
            ],
            [
              t('blockRewardLabel', lang),
              `${btc(extras.reward || 0)} BTC · ${btc(extras.totalFees || 0)} ${t('feePaid', lang).toLowerCase()}`,
            ],
            [t('difficulty', lang), group(Math.round(block.difficulty))],
            [t('nonce', lang), group(block.nonce)],
            [t('merkleRoot', lang), block.merkle_root],
            [t('previousBlock', lang), block.previousblockhash],
          ].filter(Boolean),
        ),
      ),
      header
        ? notice(
            agrees ? 'ok' : 'danger',
            agrees ? t('hashVerified', lang) : t('hashMismatch', lang),
            `sha256d(header) = ${header.hash}`,
          )
        : null,
    );
  }

  /**
   * What is waiting to be mined.
   *
   * `mempool` is the pool's own summary; `fees` is what the service recommends
   * for the next few blocks. The histogram it keeps comes back as
   * [feeRate, vsize] pairs, which is a shape a bar chart can take directly.
   */
  explorerPool(mempool, fees) {
    const lang = this.lang;
    const buckets = (mempool.fee_histogram || [])
      .map(([rate, vsize]) => ({ rate: Number(rate), weight: Number(vsize) }))
      .filter((bucket) => Number.isFinite(bucket.rate))
      .slice(0, 32)
      .reverse();
    const peak = Math.max(1, ...buckets.map((bucket) => bucket.weight));

    return el(
      'div',
      { class: 'stack', style: 'margin-top:14px' },
      section(
        t('poolStats', lang),
        `${group(mempool.count || 0)} ${t('pending', lang)}`,
      ),
      el(
        'div',
        { class: 'row', style: 'margin-bottom:9px' },
        el('span', {
          class: 'chain-card__btc',
          text: fmtRate(fees?.halfHourFee),
        }),
        el('span', { class: 'chain-card__unit', text: 's/vByte' }),
        el('span', {
          class: 'section__meta',
          style: 'margin-left:auto',
          text: fees
            ? `${t('fastest', lang)} ${fmtRate(fees.fastestFee)} · 1h ${fmtRate(fees.hourFee)} · ${t('economy', lang)} ${fmtRate(fees.economyFee)}`
            : '',
        }),
      ),
      kv([
        [
          t('sizeLabel', lang),
          `${((mempool.vsize || 0) / 1000000).toFixed(2)} MB vB`,
        ],
        [t('feePaid', lang), `${btc(mempool.total_fee || 0)} BTC`],
      ]),
      buckets.length
        ? el(
            'div',
            { class: 'stack' },
            el('p', { class: 'section__meta', text: t('feeRateSpread', lang) }),
            el(
              'div',
              { class: 'spread' },
              ...buckets.map((bucket) =>
                el('span', {
                  class: 'spread__bar',
                  style: `height:${Math.max(3, Math.round((bucket.weight / peak) * 100))}%`,
                  title: `${bucket.rate.toFixed(1)} sat/vB · ${group(bucket.weight)} vB`,
                }),
              ),
            ),
            el(
              'div',
              { class: 'spread__scale' },
              el('span', { text: `${buckets[0].rate.toFixed(1)} sat/vB` }),
              el('span', {
                text: `${buckets[buckets.length - 1].rate.toFixed(1)} sat/vB`,
              }),
            ),
          )
        : null,
    );
  }

  /**
   * Proof of work, mostly reported and partly worked out.
   *
   * The service measures the hashrate and the retarget, which the old source
   * could not, so those are taken rather than derived. The subsidy and the
   * halving still have no endpoint anywhere and are arithmetic on the height —
   * and the difficulty the service reports is held against the one inside the
   * block's own header, which is the only figure here nobody has to be trusted
   * for.
   */
  async explorerPow(block) {
    const lang = this.lang;
    const height = Number(block.height);
    const halving = untilHalving(height);
    let adjustment = null;
    let pools = null;
    try {
      adjustment = await this.chainExplorer.difficultyAdjustment();
    } catch {
      adjustment = null;
    }
    try {
      pools = await this.chainExplorer.pools();
    } catch {
      pools = null;
    }

    const span = (seconds) => {
      const parts = formatSpan(seconds);
      const unit = (name) => t(name === 'seconds' ? 'secondsUnit' : name, lang);
      return `${parts.major} ${unit(parts.majorUnit)} ${parts.minor} ${unit(parts.minorUnit)}`;
    };
    const top = pools?.pools ? pools.pools.slice(0, 8) : [];
    const totalBlocks = pools ? pools.blockCount || 0 : 0;

    return el(
      'div',
      { class: 'stack', style: 'margin-top:14px' },
      section(t('powTitle', lang), t('lastDay', lang)),
      el(
        'div',
        { class: 'chain-card' },
        el(
          'div',
          { class: 'chain-card__figure' },
          el('span', {
            class: 'chain-card__btc',
            text: pools
              ? formatHashrate(pools.lastEstimatedHashrate)
              : formatHashrate(hashrate(block.difficulty)),
          }),
        ),
        kv(
          [
            [t('difficulty', lang), group(Math.round(block.difficulty))],
            adjustment
              ? [
                  t('nextDifficultyLabel', lang),
                  `${adjustment.difficultyChange >= 0 ? '+' : ''}${adjustment.difficultyChange.toFixed(2)}% · ${adjustment.progressPercent.toFixed(1)}%`,
                ]
              : null,
            // The service measures this; when that one call is the one that
            // failed, the height still knows where the boundary is.
            [
              t('retargetIn', lang),
              adjustment
                ? `${group(adjustment.remainingBlocks)} · ${span(adjustment.remainingTime / 1000)}`
                : `${group(untilRetarget(height).blocks)} · ${span(untilRetarget(height).seconds)}`,
            ],
            adjustment
              ? [
                  t('averageBlockTime', lang),
                  span(Math.round(adjustment.timeAvg / 1000)),
                ]
              : null,
            [t('blockRewardLabel', lang), `${btc(blockReward(height))} BTC`],
            [
              t('halvingIn', lang),
              `${group(halving.blocks)} · ${span(halving.seconds)}`,
            ],
          ].filter(Boolean),
        ),
      ),
      top.length
        ? el(
            'div',
            { class: 'stack' },
            el('p', {
              class: 'section__meta',
              text: `${t('minerPools', lang)} · ${group(totalBlocks)} ${t('blocksWord', lang)}`,
            }),
            el(
              'div',
              { class: 'pools' },
              ...top.map((pool) =>
                el(
                  'div',
                  { class: 'pools__row' },
                  el('span', { class: 'pools__name', text: pool.name }),
                  el(
                    'span',
                    { class: 'pools__bar' },
                    el('span', {
                      style: `width:${totalBlocks ? (pool.blockCount / totalBlocks) * 100 : 0}%`,
                    }),
                  ),
                  el('span', {
                    class: 'pools__share',
                    text: `${totalBlocks ? ((pool.blockCount / totalBlocks) * 100).toFixed(1) : '0'}%`,
                  }),
                ),
              ),
            ),
          )
        : null,
    );
  }

  /** One transaction, with its money flowing left to right. */
  explorerTransaction(tx) {
    const lang = this.lang;
    const ins = Object.values(tx.vIn || {});
    const outs = Object.values(tx.vOut || {});
    const side = (entries, coinbase) =>
      el(
        'div',
        { class: 'flow__side' },
        ...entries.slice(0, 24).map((entry) =>
          el(
            'div',
            { class: 'flow__row' },
            entry.address ? addressSigil(entry.address, { size: 18 }) : null,
            el('button', {
              class: 'flow__addr addr',
              type: 'button',
              disabled: entry.address ? undefined : 'true',
              text: entry.address || (coinbase ? 'COINBASE' : '—'),
              onClick: entry.address
                ? () => this.ensurePanel('explorer').api.run(entry.address)
                : undefined,
            }),
            el('span', {
              class: 'flow__amt',
              text: btc(entry.value ?? entry.amount ?? 0),
            }),
          ),
        ),
        entries.length > 24
          ? el('p', { class: 'hint-text', text: `+${entries.length - 24}` })
          : null,
      );

    return el(
      'div',
      { class: 'stack' },
      section(t('txTitle', lang), tx.coinbase ? t('coinbaseTx', lang) : ''),
      el(
        'div',
        { class: 'chain-card' },
        el(
          'div',
          { class: 'chain-card__head' },
          addressSigil(tx.txId, { size: 34 }),
          el('span', { class: 'addr break', text: tx.txId }),
        ),
        kv([
          [
            t('confirmations', lang),
            tx.confirmations
              ? `${tx.confirmations.toLocaleString('en-US')} · #${tx.blockHeight}`
              : t('unconfirmed', lang),
          ],
          [
            t('mined', lang),
            tx.time
              ? `${new Date(tx.time * 1000).toISOString().replace('T', ' ').slice(0, 19)} UTC · ${ago(tx.time, lang)}`
              : '—',
          ],
          [
            t('feePaid', lang),
            `${btc(tx.fee || 0)} BTC · ${fmtRate(tx.feeRate)} sat/vB`,
          ],
          [
            t('sizeWeight', lang),
            `${tx.size} B · ${tx.vSize} vB · ${tx.weight} WU`,
          ],
          [
            t('rbfSegwit', lang),
            `${tx.rbf ? 'RBF' : '—'} / ${tx.segwit ? 'SegWit' : '—'}`,
          ],
        ]),
      ),
      el(
        'div',
        { class: 'flow' },
        el(
          'div',
          {},
          el('p', {
            class: 'section__meta',
            text: `${t('inputs', lang)} · ${ins.length}`,
          }),
          side(ins, tx.coinbase),
        ),
        el(
          'div',
          {},
          el('p', {
            class: 'section__meta',
            text: `${t('outputs', lang)} · ${outs.length}`,
          }),
          side(outs, false),
        ),
      ),
    );
  }

  /** One address: what it holds, what has passed through it, and when. */
  async explorerAddress(address) {
    const lang = this.lang;
    const state = await this.chainExplorer.addressState(address);
    const balance = Number(state.balance || 0);

    return el(
      'div',
      { class: 'stack' },
      section(t('addressTitle', lang), ''),
      el(
        'div',
        { class: 'chain-card' },
        el(
          'div',
          { class: 'chain-card__head' },
          addressSigil(address, { size: 34 }),
          el('span', { class: 'addr break', text: address }),
        ),
        el(
          'div',
          { class: 'chain-card__figure' },
          el('span', { class: 'chain-card__btc', text: btc(balance) }),
          el('span', { class: 'chain-card__unit', text: 'BTC' }),
        ),
        kv([
          [
            t('received', lang),
            `${btc(state.receivedAmount || 0)} BTC · ${state.receivedTxCount || 0}`,
          ],
          [
            t('sent', lang),
            `${btc(state.sentAmount || 0)} BTC · ${state.sentTxCount || 0}`,
          ],
          [
            t('largestReceived', lang),
            `${btc(state.largestReceivedTxAmount || 0)} BTC`,
          ],
          [
            t('unspentOutputs', lang),
            String(
              (state.receivedOutsCount || 0) - (state.spentOutsCount || 0),
            ),
          ],
        ]),
      ),
      el(
        'div',
        { class: 'row' },
        el('button', {
          class: 'btn',
          type: 'button',
          text: t('syncOne', lang),
          onClick: () => {
            this.go('ledger');
            this.ensurePanel('ledger').api.run(address);
          },
        }),
        el('a', {
          class: 'btn',
          target: '_blank',
          rel: 'noopener noreferrer',
          href: `https://mempool.space/address/${encodeURIComponent(address)}`,
          text: t('openInExplorer', lang),
        }),
      ),
    );
  }

  // ---- archive: full-text search across the case files -------------------

  buildArchive() {
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
      class: 'field',
      type: 'search',
      spellcheck: 'false',
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
        replace(
          output,
          el(
            'div',
            { class: 'word-grid' },
            el(
              'div',
              { class: 'word' },
              el('span', { class: 'word__n', text: String(asNumber) }),
              el('span', { text: wordAt(asNumber) }),
            ),
          ),
        );
      } else {
        const hits = searchWordlist(query);
        replace(
          output,
          hits.length
            ? el(
                'div',
                { class: 'stack' },
                el('p', {
                  class: 'hint-text',
                  text: `${hits.length} ${t('matches', lang)}`,
                }),
                el(
                  'div',
                  { class: 'word-grid' },
                  ...hits.map((hit) =>
                    el(
                      'div',
                      { class: 'word' },
                      el('span', { class: 'word__n', text: String(hit.index) }),
                      el('span', { text: hit.word }),
                    ),
                  ),
                ),
              )
            : empty(t('nothingFound', lang)),
        );
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
    const node = el(
      'div',
      {},
      section(t('wordlistTitle', lang), '2048'),
      el(
        'div',
        { class: 'stack' },
        input,
        el('p', { class: 'hint-text', text: t('wordlistHelp', lang) }),
        output,
      ),
    );
    return { node, run };
  }

  searchArchivePane() {
    const lang = this.lang;
    const input = el('input', {
      class: 'field',
      type: 'search',
      spellcheck: 'false',
      placeholder: t('archivePlaceholder', lang),
    });
    const output = el('div', {});
    let logged = '';

    const run = (value = null) => {
      if (value !== null) input.value = value;
      const query = input.value.trim();
      if (!query) return replace(output, empty(t('typeQuery', lang)));
      const results = searchCases(query, lang, this.progress);
      replace(
        output,
        results.length
          ? el(
              'div',
              { class: 'stack' },
              ...results.map((result) =>
                el(
                  'div',
                  { class: 'card' },
                  el(
                    'button',
                    {
                      class: 'card__row',
                      type: 'button',
                      onClick: () => this.go('cases', result.case.id),
                    },
                    el('span', {
                      class: 'card__id',
                      text: String(result.case.id).padStart(2, '0'),
                    }),
                    el('span', {
                      class: 'card__name',
                      text: pick(result.case.codename, lang),
                    }),
                    el('span', { class: 'card__spacer' }),
                    badge('open', `${result.hits.length}`),
                  ),
                  el(
                    'div',
                    { style: 'padding:0 11px 10px' },
                    ...result.hits.slice(0, 4).map((hit) =>
                      el('div', {
                        class: 'evidence',
                        style: 'margin-top:6px',
                        text: hit.line,
                      }),
                    ),
                  ),
                ),
              ),
            )
          : empty(t('nothingInArchive', lang)),
      );

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
    const node = el(
      'div',
      {},
      section(t('archiveTitle', lang)),
      el(
        'div',
        { class: 'stack' },
        input,
        el('p', { class: 'hint-text', text: t('archiveHelp', lang) }),
        output,
      ),
    );
    return { node, run };
  }

  searchCompletePane() {
    const lang = this.lang;
    const input = el('textarea', {
      class: 'field',
      rows: '3',
      spellcheck: 'false',
      placeholder:
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon ?',
    });
    const output = el('div', {});

    const run = async (value = null) => {
      if (value !== null) input.value = value;
      if (!input.value.trim()) return;
      replace(
        output,
        el('p', { class: 'spinner-line', text: t('searching', lang) }),
      );
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
        replace(
          output,
          notice(
            'info',
            tf('positionCandidates', lang, {
              position: position + 1,
              count: candidates.length,
            }),
            t('checksumCuts', lang),
          ),
          hit
            ? notice(
                'ok',
                tf('oneOpensCase', lang, { id: hit.case.id }),
                hit.word,
              )
            : null,
          el(
            'div',
            { class: 'chip-grid' },
            ...candidates.map((candidate) =>
              el(
                'button',
                {
                  class: `chip ${candidate.case ? 'chip--hit' : ''}`,
                  type: 'button',
                  title: candidate.mnemonic,
                  onClick: () => {
                    input.value = candidate.mnemonic;
                  },
                },
                el('span', {
                  class: 'chip__i',
                  text: String(indexOf(candidate.word)),
                }),
                el('span', { text: candidate.word }),
              ),
            ),
          ),
        );
      } catch (error) {
        this.log('complete', error.message, { status: 'danger' });
        replace(output, notice('danger', 'SEARCH REFUSED', error.message));
      }
    };

    const node = el(
      'div',
      {},
      section(t('completeTitle', lang)),
      el(
        'div',
        { class: 'stack' },
        el('p', { class: 'hint-text', text: t('completeHelp', lang) }),
        input,
        el(
          'div',
          { class: 'row' },
          el('button', {
            class: 'btn btn--primary',
            type: 'button',
            text: t('findCandidates', lang),
            onClick: () => run(),
          }),
        ),
        output,
      ),
    );
    return { node, run };
  }

  // ---- randomizer -------------------------------------------------------

  buildRandom() {
    const lang = this.lang;
    const output = el('div', {});
    let count = 12;

    const countRow = el(
      'div',
      { class: 'row row--tight' },
      ...[12, 15, 18, 21, 24].map((value) =>
        el('button', {
          class: 'btn',
          type: 'button',
          'aria-pressed': value === count ? 'true' : 'false',
          text: String(value),
          onClick: (event) => {
            count = value;
            countRow
              .querySelectorAll('.btn')
              .forEach((b) => b.setAttribute('aria-pressed', 'false'));
            event.currentTarget.setAttribute('aria-pressed', 'true');
          },
        }),
      ),
    );

    const generate = async () => {
      replace(
        output,
        el('p', { class: 'spinner-line', text: t('deriving', lang) }),
      );
      await sleep(16);
      const { mnemonic, entropy } = randomMnemonic(count);
      const words = mnemonic.split(' ');
      const wallet = deriveWallet(mnemonic);
      this.wallet = wallet;
      this.recordDecrypt(wallet, null, { generated: true });
      replace(
        output,
        el(
          'div',
          { class: 'row', style: 'margin-bottom:10px' },
          this.copyButton(mnemonic),
          el('span', {
            class: 'section__meta',
            text: `${words.length} words · ${entropy.length * 8} bits`,
          }),
        ),
        el(
          'div',
          { class: 'word-grid' },
          ...words.map((word, index) =>
            el(
              'div',
              { class: 'word' },
              el('span', { class: 'word__n', text: String(index + 1) }),
              el('span', { text: word }),
            ),
          ),
        ),
        kv([['ENTROPY', toHex(entropy)]]),
        this.derivationTable(wallet),
        notice('warn', t('realWalletTitle', lang), t('realWalletBody', lang)),
      );
    };

    const node = el(
      'div',
      {},
      section(t('randomTitle', lang)),
      el(
        'div',
        { class: 'stack' },
        el(
          'div',
          { class: 'row' },
          el('span', { class: 'section__meta', text: t('words', lang) }),
          countRow,
        ),
        el(
          'div',
          { class: 'row' },
          el('button', {
            class: 'btn btn--primary',
            type: 'button',
            text: t('generate', lang),
            onClick: generate,
          }),
        ),
        el('p', { class: 'hint-text', text: t('randomHelp', lang) }),
        output,
      ),
    );
    return { node, api: { run: generate } };
  }

  // ---- about ------------------------------------------------------------

  buildAbout() {
    const lang = this.lang;
    const lines = ABOUT[lang] || ABOUT.en;
    const node = el(
      'div',
      {},
      section('ENIGMA TERMINAL', META.version),
      el(
        'div',
        { class: 'prose' },
        ...lines.map((line) => el('p', { text: line })),
      ),
      el(
        'div',
        { class: 'row' },
        el('a', {
          class: 'btn',
          href: 'https://github.com/legenki/enigma-terminal',
          target: '_blank',
          rel: 'noopener',
          text: 'Source on GitHub ↗',
        }),
      ),
    );
    return { node, api: {} };
  }
}
