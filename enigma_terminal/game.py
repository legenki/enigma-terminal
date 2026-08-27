"""The interactive terminal: command parsing, quest flow, live-chain queries."""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass, field

from . import __version__
from .cases import LANGUAGES, Campaign, Case, Progress
from .chain import PROVIDERS, AddressStats, ChainClient, ChainError
from .crypto_engine import (
    MnemonicError,
    Wallet,
    complete_mnemonic,
    derive_wallet,
    entropy_to_mnemonic,
    index_of,
    mnemonic_to_entropy,
    normalize,
    random_mnemonic,
    search,
    word_at,
    wordlist_is_authentic,
)
from .journal import STATUS_STYLES, TOOLS, Journal, mask_address, mask_mnemonic
from .ui import DECRYPT_LOGS, NET_LOGS, Screen

PROMPT = "nullsec@enigma:~$ "

HELP_TEXT = {
    "en": [
        ("HELP", "this list"),
        ("LANG RU|EN|ES|PT", "switch narrative language"),
        ("CASES", "the desk: campaign plus taken contracts"),
        ("CLIENTS", "the eight employers and their contract counts"),
        ("BOARD <client>", "list one employer's thirty-two contracts"),
        ("DROP <id>", "return an unsolved contract to the board"),
        ("OPEN <id>", "open a case file and make it active"),
        ("BRIEF / EVIDENCE / CLUES", "re-read the active case"),
        ("HINT", "spend a hint on the active case"),
        ("WORD <1..2048>", "read one entry of the BIP-39 wordlist"),
        ("INDEX <word>", "find a word's position in the wordlist"),
        ("SEARCH <prefix>", "list wordlist entries by prefix"),
        ("ARCHIVE <text>", "full-text search across the case files"),
        ("RANDOM [12..24]", "generate a fresh seed phrase from secure randomness"),
        ("COMPLETE <phrase ?>", "find the missing word of a phrase (one ? marks it)"),
        ("ENTROPY <hex>", "rebuild a mnemonic from raw entropy (32 hex chars)"),
        ("DECRYPT <12 words>", "validate a seed phrase and derive its addresses"),
        ("DERIVE", "re-print the derivation grid of the loaded seed"),
        ("SYNC_LEDGER [addr]", "query the live Bitcoin network for a balance"),
        ("SWEEP", "check all three derived addresses at once"),
        ("TXLOG [addr]", "pull the most recent on-chain transactions"),
        ("PROVIDER [name]", "choose the explorer: blockstream|mempool|blockchain"),
        ("EXPLORER", "print a browser URL for the loaded address"),
        ("NETINFO", "probe all explorer nodes and show latency"),
        ("JOURNAL [tool]", "the investigation journal, newest first"),
        ("RECALL <n>", "replay entry n from the journal"),
        ("PIN <n>", "pin a journal entry so PURGE keeps it"),
        ("PURGE [all]", "clear the journal (pinned entries survive unless 'all')"),
        ("STATUS", "operator status and progress"),
        ("ABOUT", "what this program actually does"),
        ("CLEAR", "wipe the screen"),
        ("RESET", "erase saved progress"),
        ("EXIT", "close the session"),
    ],
    "ru": [
        ("HELP", "этот список"),
        ("LANG RU|EN|ES|PT", "язык повествования"),
        ("CASES", "рабочий стол: кампания плюс взятые контракты"),
        ("CLIENTS", "восемь заказчиков и их счётчики"),
        ("BOARD <заказчик>", "список из 32 контрактов одного заказчика"),
        ("DROP <id>", "вернуть нерешённый контракт на доску"),
        ("OPEN <id>", "открыть дело и сделать его активным"),
        ("BRIEF / EVIDENCE / CLUES", "перечитать активное дело"),
        ("HINT", "потратить подсказку по активному делу"),
        ("WORD <1..2048>", "показать слово словаря BIP-39"),
        ("INDEX <слово>", "найти позицию слова в словаре"),
        ("SEARCH <префикс>", "искать слова словаря по началу"),
        ("ARCHIVE <текст>", "полнотекстовый поиск по делам"),
        ("RANDOM [12..24]", "сгенерировать новую сид-фразу"),
        ("COMPLETE <фраза ?>", "найти недостающее слово фразы (его место — ?)"),
        ("ENTROPY <hex>", "собрать мнемонику из энтропии (32 hex-символа)"),
        ("DECRYPT <12 слов>", "проверить фразу и вывести адреса"),
        ("DERIVE", "повторить сетку деривации загруженного сида"),
        ("SYNC_LEDGER [адрес]", "запрос баланса в живой сети Bitcoin"),
        ("SWEEP", "проверить сразу все три выведенных адреса"),
        ("TXLOG [адрес]", "последние транзакции адреса"),
        ("PROVIDER [имя]", "выбрать эксплорер: blockstream|mempool|blockchain"),
        ("EXPLORER", "ссылка на адрес в браузере"),
        ("NETINFO", "проверить все узлы-эксплореры и показать задержку"),
        ("JOURNAL [инструмент]", "журнал расследования, свежее сверху"),
        ("RECALL <n>", "повторить запись n из журнала"),
        ("PIN <n>", "закрепить запись, чтобы PURGE её не тронул"),
        ("PURGE [all]", "очистить журнал (закреплённые остаются, если не 'all')"),
        ("STATUS", "статус оператора и прогресс"),
        ("ABOUT", "что эта программа делает на самом деле"),
        ("CLEAR", "очистить экран"),
        ("RESET", "стереть сохранённый прогресс"),
        ("EXIT", "завершить сессию"),
    ],
    "es": [
        ("HELP", "esta lista"),
        ("LANG RU|EN|ES|PT", "cambiar idioma narrativo"),
        ("CASES", "el escritorio: campaña más contratos tomados"),
        ("CLIENTS", "los ocho empleadores y sus contratos"),
        ("BOARD <empleador>", "los treinta y dos contratos de un empleador"),
        ("DROP <id>", "devolver un contrato sin resolver al tablón"),
        ("OPEN <id>", "abrir un archivo de caso y activarlo"),
        ("BRIEF / EVIDENCE / CLUES", "releer el caso activo"),
        ("HINT", "gastar una pista en el caso activo"),
        ("WORD <1..2048>", "leer una entrada de la lista BIP-39"),
        ("INDEX <palabra>", "encontrar la posición de una palabra"),
        ("SEARCH <prefijo>", "buscar palabras por prefijo"),
        ("ARCHIVE <texto>", "búsqueda de texto completo"),
        ("RANDOM [12..24]", "generar frase semilla aleatoria segura"),
        ("COMPLETE <frase ?>", "encontrar la palabra faltante (?)"),
        ("ENTROPY <hex>", "reconstruir mnemotécnica desde entropía"),
        ("DECRYPT <12 palabras>", "validar frase y derivar direcciones"),
        ("DERIVE", "imprimir cuadrícula de derivación"),
        ("SYNC_LEDGER [addr]", "consultar saldo en red Bitcoin"),
        ("SWEEP", "comprobar tres direcciones a la vez"),
        ("TXLOG [addr]", "obtener transacciones on-chain recientes"),
        ("PROVIDER [nombre]", "elegir explorador: blockstream|mempool|blockchain"),
        ("EXPLORER", "imprimir URL del navegador"),
        ("NETINFO", "sondear todos los nodos y mostrar latencia"),
        ("JOURNAL [herram.]", "diario de investigación, recientes primero"),
        ("RECALL <n>", "repetir entrada n del diario"),
        ("PIN <n>", "fijar entrada para que PURGE la conserve"),
        ("PURGE [all]", "limpiar diario (entradas fijadas sobreviven)"),
        ("STATUS", "estado del operador y progreso"),
        ("ABOUT", "qué hace este programa"),
        ("CLEAR", "limpiar pantalla"),
        ("RESET", "borrar progreso"),
        ("EXIT", "cerrar sesión"),
    ],
    "pt": [
        ("HELP", "esta lista"),
        ("LANG RU|EN|ES|PT", "mudar idioma da narrativa"),
        ("CASES", "a mesa: campanha mais contratos pegos"),
        ("CLIENTS", "os oito empregadores e seus contratos"),
        ("BOARD <empregador>", "os trinta e dois contratos de um empregador"),
        ("DROP <id>", "devolver um contrato não resolvido ao quadro"),
        ("OPEN <id>", "abrir um arquivo de caso e ativá-lo"),
        ("BRIEF / EVIDENCE / CLUES", "reler o caso ativo"),
        ("HINT", "gastar uma dica no caso ativo"),
        ("WORD <1..2048>", "ler uma entrada da lista BIP-39"),
        ("INDEX <palavra>", "encontrar a posição de uma palavra"),
        ("SEARCH <prefixo>", "buscar palavras por prefixo"),
        ("ARCHIVE <texto>", "busca de texto completo"),
        ("RANDOM [12..24]", "gerar frase semente aleatória segura"),
        ("COMPLETE <frase ?>", "encontrar a palavra que falta (?)"),
        ("ENTROPY <hex>", "reconstruir mnemônica a partir da entropia"),
        ("DECRYPT <12 palavras>", "validar frase e derivar endereços"),
        ("DERIVE", "imprimir grade de derivação"),
        ("SYNC_LEDGER [addr]", "consultar saldo na rede Bitcoin"),
        ("SWEEP", "verificar três endereços de uma vez"),
        ("TXLOG [addr]", "obter transações on-chain recentes"),
        ("PROVIDER [nome]", "escolher explorador: blockstream|mempool|blockchain"),
        ("EXPLORER", "imprimir URL do navegador"),
        ("NETINFO", "testar todos os nós e mostrar latência"),
        ("JOURNAL [ferram.]", "diário de investigação, recentes primeiro"),
        ("RECALL <n>", "repetir a entrada n do diário"),
        ("PIN <n>", "fixar entrada para que PURGE a mantenha"),
        ("PURGE [all]", "limpar diário (entradas fixadas sobrevivem)"),
        ("STATUS", "status do operador e progresso"),
        ("ABOUT", "o que este programa faz"),
        ("CLEAR", "limpar tela"),
        ("RESET", "apagar progresso"),
        ("EXIT", "fechar sessão"),
    ],
}

TEXT = {
    "no_case": {
        "en": "NO ACTIVE CASE. RUN: CASES, THEN OPEN <id>",
        "ru": "НЕТ АКТИВНОГО ДЕЛА. ВЫПОЛНИ: CASES, ЗАТЕМ OPEN <id>",
        "es": "NO HAY CASO ACTIVO. EJECUTA: CASES, LUEGO OPEN <id>",
        "pt": "NENHUM CASO ATIVO. EXECUTE: CASES, DEPOIS OPEN <id>",
    },
    "no_wallet": {
        "en": "NO SEED LOADED. RUN: DECRYPT <12 words>",
        "ru": "СИД НЕ ЗАГРУЖЕН. ВЫПОЛНИ: DECRYPT <12 слов>",
        "es": "NO HAY SEMILLA CARGADA. EJECUTA: DECRYPT <12 palabras>",
        "pt": "NENHUMA SEMENTE CARREGADA. EXECUTE: DECRYPT <12 palavras>",
    },
    "locked": {
        "en": "CASE LOCKED. REQUIRED CASES: {req}",
        "ru": "ДЕЛО ЗАБЛОКИРОВАНО. СНАЧАЛА ЗАКРОЙ ДЕЛА: {req}",
        "es": "CASO BLOQUEADO. CASOS REQUERIDOS: {req}",
        "pt": "CASO BLOQUEADO. CASOS NECESSÁRIOS: {req}",
    },
    "solved_banner": {
        "en": "CASE {id} CLOSED — SEED MATCHES THE STORED FINGERPRINT",
        "ru": "ДЕЛО {id} ЗАКРЫТО — СИД СОВПАЛ С СОХРАНЁННЫМ ОТПЕЧАТКОМ",
        "es": "CASO {id} CERRADO — LA SEMILLA COINCIDE CON LA HUELLA",
        "pt": "CASO {id} FECHADO — A SEMENTE CORRESPONDE À IMPRESSÃO",
    },
    "filed_with": {
        "en": "FILED WITH {client}.",
        "ru": "СДАНО ЗАКАЗЧИКУ: {client}.",
        "es": "ENTREGADO A {client}.",
        "pt": "ENTREGUE A {client}.",
    },
    "took_it": {
        "en": "TAKEN INTO WORK — {client}",
        "ru": "ВЗЯТО В РАБОТУ — {client}",
        "es": "TOMADO EN TRABAJO — {client}",
        "pt": "PEGADO PARA TRABALHO — {client}",
    },
    "not_on_desk": {
        "en": "CASE {id} IS NOT ON THE DESK.",
        "ru": "ДЕЛА {id} НЕТ НА СТОЛЕ.",
        "es": "EL CASO {id} NO ESTÁ EN EL ESCRITORIO.",
        "pt": "O CASO {id} NÃO ESTÁ NA MESA.",
    },
    "not_this_case": {
        "en": "VALID MNEMONIC, BUT IT IS NOT THE KEY TO CASE {id}.",
        "ru": "МНЕМОНИКА ВАЛИДНА, НО ЭТО НЕ КЛЮЧ К ДЕЛУ {id}.",
        "es": "MNEMOTÉCNICA VÁLIDA, PERO NO ES LA CLAVE DEL CASO {id}.",
        "pt": "MNEMÔNICA VÁLIDA, MAS NÃO É A CHAVE DO CASO {id}.",
    },
    "wrong_case": {
        "en": "THIS SEED BELONGS TO CASE {id} ({name}).",
        "ru": "ЭТОТ СИД ОТНОСИТСЯ К ДЕЛУ {id} ({name}).",
        "es": "ESTA SEMILLA PERTENECE AL CASO {id} ({name}).",
        "pt": "ESTA SEMENTE PERTENCE AO CASO {id} ({name}).",
    },
    "hints_done": {
        "en": "NO HINTS LEFT ON THIS CASE.",
        "ru": "ПОДСКАЗКИ ПО ЭТОМУ ДЕЛУ ЗАКОНЧИЛИСЬ.",
        "es": "NO QUEDAN PISTAS EN ESTE CASO.",
        "pt": "NÃO RESTAM DICAS NESTE CASO.",
    },
    "all_done": {
        "en": "ALL EIGHT CASES CLOSED. ORACLE'S ARCHIVE IS FULLY RECOVERED.",
        "ru": "ВСЕ ВОСЕМЬ ДЕЛ ЗАКРЫТЫ. АРХИВ ORACLE ВОССТАНОВЛЕН ПОЛНОСТЬЮ.",
        "es": "LOS OCHO CASOS ESTÁN CERRADOS. EL ARCHIVO DE ORACLE FUE RECUPERADO TOTALMENTE.",
        "pt": "TODOS OS OITO CASOS ESTÃO FECHADOS. O ARQUIVO DE ORACLE ESTÁ TOTALMENTE RECUPERADO.",
    },
    "already_solved": {
        "en": "CASE {id} WAS ALREADY CLOSED. ACTIVE CASE: {active}.",
        "ru": "ДЕЛО {id} УЖЕ ЗАКРЫТО РАНЕЕ. АКТИВНОЕ ДЕЛО: {active}.",
        "es": "EL CASO {id} YA ESTABA CERRADO. CASO ACTIVO: {active}.",
        "pt": "O CASO {id} JÁ ESTAVA FECHADO. CASO ATIVO: {active}.",
    },
}

ABOUT_TEXT = {
    "en": [
        "ENIGMA TERMINAL — a detective quest played against the real network.",
        "",
        "Everything below the story is genuine:",
        "  * mnemonics are checked against the official BIP-39 English wordlist,",
        "    including the SHA-256 checksum carried by the final word;",
        "  * seeds come from PBKDF2-HMAC-SHA512 with 2048 rounds;",
        "  * keys are derived over secp256k1 through BIP-32 (BIP-44/49/84 paths);",
        "  * balances come from live HTTP calls to public block explorers.",
        "",
        "The eight case answers are published BIP-39 test vectors. Their wallets are",
        "known to the whole world, hold nothing worth taking, and carry years of real",
        "on-chain history — which is exactly what makes them good exhibits.",
        "",
        "This program has no wallet-cracking capability and none is planned:",
        "it derives addresses from phrases you already know and reads public data.",
        "Never type a seed phrase that controls real funds into any program, this one",
        "included.",
    ],
    "ru": [
        "ENIGMA TERMINAL — детективный квест, играющий против настоящей сети.",
        "",
        "Всё, что находится под сюжетом, — подлинное:",
        "  * мнемоники проверяются по официальному словарю BIP-39,",
        "    включая контрольную сумму SHA-256 в последнем слове;",
        "  * сид получается через PBKDF2-HMAC-SHA512, 2048 раундов;",
        "  * ключи выводятся на кривой secp256k1 по BIP-32 (пути BIP-44/49/84);",
        "  * балансы приходят живыми HTTP-запросами к публичным эксплорерам.",
        "",
        "Ответы восьми дел — опубликованные тестовые векторы BIP-39. Эти кошельки",
        "известны всему миру, в них нет ничего ценного, зато есть годы настоящей",
        "истории в блокчейне — именно поэтому они и годятся как вещдоки.",
        "",
        "Программа не умеет взламывать чужие кошельки и не будет уметь:",
        "она считает адреса по уже известным фразам и читает публичные данные.",
        "Никогда не вводи в программы — включая эту — сид-фразу от кошелька",
        "с реальными деньгами.",
    ],
    "es": [
        "ENIGMA TERMINAL — una aventura de detectives contra la red real.",
        "",
        "Todo lo que hay debajo de la historia es genuino:",
        "  * las mnemotécnicas se validan contra la lista oficial BIP-39 en inglés,",
        "    incluida la suma de comprobación SHA-256 en la última palabra;",
        "  * las semillas vienen de PBKDF2-HMAC-SHA512 con 2048 rondas;",
        "  * las claves se derivan sobre secp256k1 a través de BIP-32 (rutas BIP-44/49/84);",
        "  * los saldos provienen de llamadas HTTP a exploradores de bloques públicos.",
        "",
        "Las respuestas de los ocho casos son vectores de prueba BIP-39 publicados. Sus",
        "carteras son conocidas mundialmente, no contienen nada de valor y tienen años de",
        "historia real en la cadena, lo que las hace excelentes pruebas.",
        "",
        "Este programa no tiene capacidad de piratear carteras y no está planeado:",
        "deriva direcciones de frases que ya conoces y lee datos públicos.",
        "Nunca ingreses una frase semilla con fondos reales en ningún programa, incluido",
        "este.",
    ],
    "pt": [
        "ENIGMA TERMINAL — uma aventura de detetives jogada contra a rede real.",
        "",
        "Tudo abaixo da história é genuíno:",
        "  * as mnemônicas são validadas contra a lista oficial BIP-39 em inglês,",
        "    incluindo a soma de verificação SHA-256 na última palavra;",
        "  * as sementes vêm de PBKDF2-HMAC-SHA512 com 2048 rodadas;",
        "  * as chaves são derivadas sobre secp256k1 através de BIP-32 (caminhos BIP-44/49/84);",
        "  * os saldos vêm de chamadas HTTP ativas para exploradores de blocos públicos.",
        "",
        "As respostas dos oito casos são vetores de teste BIP-39 publicados. Suas",
        "carteiras são conhecidas mundialmente, não contêm nada de valor e carregam anos",
        "de história real on-chain — o que as torna excelentes evidências.",
        "",
        "Este programa não tem capacidade de hackear carteiras e nenhuma está planejada:",
        "ele deriva endereços de frases que você já conhece e lê dados públicos.",
        "Nunca digite uma frase semente que controla fundos reais em qualquer programa, este",
        "incluído.",
    ],
}


@dataclass
class Session:
    campaign: Campaign
    progress: Progress
    screen: Screen
    chain: ChainClient
    journal: Journal = field(default_factory=Journal)
    lang: str = "ru"
    active: Case | None = None
    wallet: Wallet | None = None
    running: bool = True
    #: The filtered slice shown by the last JOURNAL call; RECALL/PIN index into it
    #: so their positions always agree with what was printed.
    _journal_view: list = field(default_factory=list)

    def t(self, key: str, **fmt) -> str:
        return TEXT[key][self.lang].format(**fmt)

# --------------------------------------------------------------------------- #
# Command implementations
# --------------------------------------------------------------------------- #

def cmd_help(s: Session, _arg: str) -> None:
    s.screen.write()
    for command, description in HELP_TEXT[s.lang]:
        print(s.screen.paint(f"  {command:<26}", "green")
              + s.screen.paint(description, "grey"))
    s.screen.write()


def cmd_about(s: Session, _arg: str) -> None:
    s.screen.write()
    s.screen.lines(ABOUT_TEXT[s.lang], "grey")
    s.screen.write()


#: The one warning in the game that must never fall back to a language the
#: player does not read: it is what stands between them and a funded address.
REAL_WALLET = {
    "en": "THIS IS A REAL WALLET. DO NOT FUND IT — THE PHRASE IS SAVED IN YOUR JOURNAL (PURGE TO ERASE).",
    "ru": "ЭТО НАСТОЯЩИЙ КОШЕЛЁК. НЕ КЛАДИ НА НЕГО ДЕНЬГИ — ФРАЗА СОХРАНЕНА В ЖУРНАЛЕ (PURGE — СТЕРЕТЬ).",
    "es": "ESTA ES UNA CARTERA REAL. NO LE PONGAS FONDOS — LA FRASE ESTÁ GUARDADA EN TU DIARIO (PURGE PARA BORRAR).",
    "pt": "ESTA É UMA CARTEIRA REAL. NÃO COLOQUE FUNDOS — A FRASE ESTÁ SALVA NO DIÁRIO (PURGE PARA APAGAR).",
}


def cmd_lang(s: Session, arg: str) -> None:
    choice = arg.strip().lower()
    if choice not in LANGUAGES:
        s.screen.warn("USAGE: " + " | ".join(f"LANG {c.upper()}" for c in LANGUAGES))
        return
    s.lang = choice
    s.screen.ok(f"NARRATIVE LANGUAGE: {choice.upper()}")


def cmd_cases(s: Session, _arg: str) -> None:
    desk = s.campaign.caseload(s.progress)
    s.screen.write()
    s.screen.write("  CASE FILES // THE DESK", "cyan", "bold")
    s.screen.rule()
    for case in desk:
        unlocked = s.campaign.is_unlocked(case, s.progress)
        if case.id in s.progress.solved:
            mark, styles = "[CLOSED]", ("dark",)
        elif not unlocked:
            mark, styles = "[LOCKED]", ("grey",)
        else:
            mark, styles = "[  OPEN]", ("green",)
        stars = "*" * case.difficulty
        pointer = ">" if s.active and s.active.id == case.id else " "
        client = s.campaign.client(case.client) if case.client else None
        employer = client["name"][s.lang] if client else ""
        s.screen.write(
            f" {pointer} {mark} {case.id:03d}  {case.codename(s.lang):<22} "
            f"{stars:<5} {employer}",
            *styles,
        )
    solved = sum(1 for case in desk if case.id in s.progress.solved)
    s.screen.rule()
    s.screen.write(f"  {solved}/{len(desk)} CLOSED · BOARD HAS {len(s.campaign.contracts)} MORE", "amber")
    s.screen.write()


def _show_case(s: Session, case: Case) -> None:
    s.screen.write()
    s.screen.write(f"  CASE {case.id:02d} // {case.codename(s.lang)}", "magenta", "bold")
    s.screen.rule("=")
    s.screen.lines(case.brief(s.lang), "white", typed=True)
    s.screen.write()
    s.screen.lines(case.evidence(s.lang), "grey")
    s.screen.write()
    s.screen.write("  DECODING TABLE:", "cyan")
    s.screen.lines(case.clues(s.lang), "green")
    s.screen.rule("=")
    s.screen.write()


def cmd_open(s: Session, arg: str) -> None:
    try:
        case_id = int(arg.strip())
    except ValueError:
        s.screen.warn("USAGE: OPEN <case id>")
        return
    case = s.campaign.get(case_id)
    if case is None:
        s.screen.error(f"CASE {arg.strip()} NOT FOUND IN ARCHIVE.")
        return
    if not s.campaign.is_unlocked(case, s.progress):
        missing = ", ".join(str(r) for r in case.requires if r not in s.progress.solved)
        s.screen.error(s.t("locked", req=missing))
        return
    s.active = case
    if case.client and s.progress.take(case.id):
        client = s.campaign.client(case.client)
        name = client["name"][s.lang] if client else case.client
        _log(s, "case", f"Taken: {case.codename(s.lang)}", detail=name,
             payload={"caseId": case.id})
        s.screen.ok(s.t("took_it", client=name))
    _show_case(s, case)


def cmd_clients(s: Session, _arg: str) -> None:
    """The eight employers and how far the player has got with each."""
    if not s.campaign.clients:
        s.screen.error("CONTRACT BOARD UNAVAILABLE.")
        return
    s.screen.write()
    s.screen.write("  CONTRACT BOARD // EIGHT EMPLOYERS", "cyan", "bold")
    s.screen.rule()
    for client in s.campaign.clients:
        cases = s.campaign.cases_for_client(client["slug"])
        solved = sum(1 for case in cases if case.id in s.progress.solved)
        print(
            s.screen.paint(f"  {client['order']:02d} ", "dark")
            + s.screen.paint(f"{client['name'][s.lang]:<20}", "magenta")
            + s.screen.paint(f"{solved:>2}/{len(cases)} ", "green" if solved else "grey")
            + s.screen.paint(client["kind"][s.lang], "grey")
        )
        s.screen.write(f"     {client['slug']} · {client['district'][s.lang]}", "dark")
    s.screen.rule()
    s.screen.write("  BOARD <client> TO OPEN ONE", "grey")
    s.screen.write()


def cmd_board(s: Session, arg: str) -> None:
    """One employer's thirty-two contracts."""
    slug = arg.strip().lower()
    if not slug:
        s.screen.warn("USAGE: BOARD <client>  (see CLIENTS)")
        return
    client = s.campaign.client(slug)
    if client is None:
        s.screen.error(f"NO CLIENT '{slug.upper()}'. RUN CLIENTS.")
        return
    s.screen.write()
    s.screen.write(f"  {client['name'][s.lang]} // {client['district'][s.lang]}",
                   "magenta", "bold")
    s.screen.lines(client["creed"][s.lang], "white")
    s.screen.write()
    s.screen.write(f"  {client['dialect'][s.lang]}", "cyan")
    s.screen.rule()
    for case in s.campaign.cases_for_client(slug):
        solved = case.id in s.progress.solved
        locked = any(req not in s.progress.solved for req in case.requires)
        mark = "[CLOSED]" if solved else "[LOCKED]" if locked else "[  OPEN]"
        style = "dark" if solved else "grey" if locked else "green"
        on_desk = "*" if case.id in s.progress.taken else " "
        s.screen.write(
            f"  {mark}{on_desk}{case.id:03d}  {case.codename(s.lang):<24} "
            f"{'*' * case.difficulty:<5} {case.archetype}",
            style,
        )
    s.screen.rule()
    s.screen.write("  OPEN <id> TAKES A CONTRACT ONTO THE DESK", "grey")
    s.screen.write()


def cmd_drop(s: Session, arg: str) -> None:
    """Return an unsolved contract to the board."""
    try:
        case_id = int(arg.strip())
    except ValueError:
        s.screen.warn("USAGE: DROP <case id>")
        return
    if case_id in s.progress.solved:
        s.screen.warn("CLOSED CASES STAY ON THE DESK.")
        return
    if not s.progress.drop(case_id):
        s.screen.error(s.t("not_on_desk", id=case_id))
        return
    if s.active and s.active.id == case_id:
        s.active = None
    s.screen.ok(f"CASE {case_id} RETURNED TO THE BOARD.")


def cmd_brief(s: Session, _arg: str) -> None:
    if not s.active:
        s.screen.warn(s.t("no_case"))
        return
    s.screen.lines(s.active.brief(s.lang), "white")


def cmd_evidence(s: Session, _arg: str) -> None:
    if not s.active:
        s.screen.warn(s.t("no_case"))
        return
    s.screen.lines(s.active.evidence(s.lang), "grey")


def cmd_clues(s: Session, _arg: str) -> None:
    if not s.active:
        s.screen.warn(s.t("no_case"))
        return
    s.screen.lines(s.active.clues(s.lang), "green")


def cmd_hint(s: Session, _arg: str) -> None:
    if not s.active:
        s.screen.warn(s.t("no_case"))
        return
    hints = s.active.hints(s.lang)
    used = s.progress.hints_used.get(s.active.id, 0)
    if used >= len(hints):
        s.screen.warn(s.t("hints_done"))
        return
    s.progress.use_hint(s.active.id)
    _log(s, "hint", f"{s.active.codename(s.lang)} — hint {used + 1}/{len(hints)}",
         detail=hints[used], payload={"caseId": s.active.id})
    s.screen.write(f"[HINT {used + 1}/{len(hints)}] {hints[used]}", "amber")


def cmd_word(s: Session, arg: str) -> None:
    try:
        position = int(arg.strip())
        s.screen.kv(f"WORD {position:04d}", word_at(position))
    except ValueError:
        s.screen.warn("USAGE: WORD <1..2048>")
    except IndexError as exc:
        s.screen.error(str(exc).upper())


def cmd_index(s: Session, arg: str) -> None:
    word = arg.strip().lower()
    if not word:
        s.screen.warn("USAGE: INDEX <word>")
        return
    try:
        s.screen.kv(f"INDEX OF {word}", f"{index_of(word):04d}")
    except KeyError:
        s.screen.error(f"'{word.upper()}' IS NOT IN THE BIP-39 DICTIONARY.")


def cmd_search(s: Session, arg: str) -> None:
    prefix = arg.strip().lower()
    if not prefix:
        s.screen.warn("USAGE: SEARCH <prefix>")
        return
    hits = search(prefix)
    if not hits:
        s.screen.warn(f"NO WORDLIST ENTRY STARTS WITH '{prefix.upper()}'.")
        return
    _log(s, "search", prefix, detail=f"{len(hits)} match(es)", payload={"query": prefix})
    for chunk_start in range(0, len(hits), 4):
        row = hits[chunk_start : chunk_start + 4]
        s.screen.write("  " + "".join(f"{i:>5}  {w:<14}" for i, w in row), "green")
    s.screen.write(f"  {len(hits)} MATCH(ES)", "grey")


def cmd_archive(s: Session, arg: str) -> None:
    """Full-text search over the case files."""
    query = arg.strip()
    if not query:
        s.screen.warn("USAGE: ARCHIVE <text>")
        return
    results = s.campaign.search(query, s.lang, s.progress)
    if not results:
        s.screen.warn(f"NOTHING IN THE ARCHIVE MATCHES '{query.upper()}'.")
        return
    s.screen.write()
    for case, hits in results:
        s.screen.write(f"  CASE {case.id:02d} // {case.codename(s.lang)}", "magenta")
        for line in hits[:4]:
            s.screen.write(f"      {line.strip()}", "grey")
    _log(s, "archive", query, detail=f"{len(results)} case(s)", payload={"query": query})
    s.screen.write(f"  {len(results)} CASE(S) MATCHED", "grey")
    s.screen.write()


def cmd_random(s: Session, arg: str) -> None:
    """Generate a brand-new seed phrase from the OS random source."""
    try:
        count = int(arg.strip()) if arg.strip() else 12
    except ValueError:
        s.screen.warn("USAGE: RANDOM [12|15|18|21|24]")
        return
    try:
        mnemonic, entropy = random_mnemonic(count)
    except MnemonicError as exc:
        s.screen.error(str(exc))
        return
    s.screen.write()
    s.screen.write("[RNG] DRAWING FROM THE OS CRYPTOGRAPHIC RANDOM SOURCE...", "cyan")
    s.screen.kv("ENTROPY", entropy.hex(), value_styles=("cyan",))
    s.screen.kv("BITS", str(len(entropy) * 8), value_styles=("cyan",))
    s.screen.stream(f"{'MNEMONIC':<18}: {mnemonic}", "green", "bold", cps=120)
    s.screen.write()
    s.screen.warn(REAL_WALLET.get(s.lang, REAL_WALLET["en"]))
    _log(s, "random", f"{len(entropy) * 8}-bit phrase", detail=mnemonic,
         payload={"mnemonic": mnemonic})
    s.screen.info(f"RUN: DECRYPT {mnemonic}")


def cmd_complete(s: Session, arg: str) -> None:
    """Recover the one word a player cannot remember."""
    phrase = arg.strip()
    if not phrase:
        s.screen.warn("USAGE: COMPLETE <phrase with ? in place of the missing word>")
        return
    s.screen.write()
    result, error = s.screen.run_with_logs(
        lambda: complete_mnemonic(phrase),
        ["[~] enumerating candidate words...", "[~] verifying sha256 checksums..."],
    )
    if isinstance(error, MnemonicError):
        s.screen.error(str(error))
        return
    if error is not None or result is None:
        s.screen.error(f"SEARCH FAILED: {error}")
        return

    position, matches = result
    s.screen.ok(f"POSITION {position + 1}: {len(matches)} WORD(S) SATISFY THE CHECKSUM.")
    for start in range(0, len(matches), 6):
        s.screen.write("  " + "".join(w.ljust(12) for w in matches[start : start + 6]),
                       "green")

    # If one completion is a case key, the detective has just closed the gap.
    words = normalize(phrase).split()
    hit = None
    for candidate in matches:
        attempt = list(words)
        attempt[position] = candidate
        owner = s.campaign.find_by_mnemonic(" ".join(attempt))
        if owner is not None:
            hit = (candidate, owner)
            s.screen.write(
                f"[HIT ] '{candidate}' COMPLETES THE KEY TO CASE {owner.id}.", "magenta"
            )
            break
    _log(
        s, "complete", f"? @ {position + 1}",
        status="ok" if hit else "info",
        detail=(f"{len(matches)} candidates · {hit[0]} -> case {hit[1].id}" if hit
                else f"{len(matches)} candidates"),
        payload={"pattern": phrase},
    )
    s.screen.write()


def cmd_entropy(s: Session, arg: str) -> None:
    raw = arg.strip().lower().replace("0x", "").replace(" ", "")
    if not raw:
        s.screen.warn("USAGE: ENTROPY <hex> (32 hex chars = 128 bits = 12 words)")
        return
    try:
        entropy = bytes.fromhex(raw)
    except ValueError:
        s.screen.error("ENTROPY MUST BE HEXADECIMAL.")
        return
    try:
        mnemonic = entropy_to_mnemonic(entropy)
    except MnemonicError as exc:
        s.screen.error(str(exc))
        return
    s.screen.write()
    s.screen.kv("ENTROPY", entropy.hex(), value_styles=("cyan",))
    s.screen.kv("BITS", str(len(entropy) * 8), value_styles=("cyan",))
    s.screen.stream(f"{'MNEMONIC':<18}: {mnemonic}", "green", "bold", cps=120)
    s.screen.write()
    s.screen.info("RUN: DECRYPT " + mnemonic)


def _print_derivation(s: Session, wallet: Wallet) -> None:
    s.screen.rule("=")
    s.screen.kv("BIP39 SEED", wallet.seed[:64] + "...", value_styles=("dark",))
    s.screen.kv("MASTER XPRV", wallet.master_xprv, value_styles=("dark",))
    s.screen.rule("-")
    for derived in wallet.addresses:
        label = f"PATH {derived.path} ({derived.label})"
        print(s.screen.paint(f"{label:<44}: ", "grey")
              + s.screen.paint(derived.address, "green", "bold"))
    s.screen.rule("-")
    for derived in wallet.addresses:
        s.screen.kv(f"PUBKEY m/{derived.purpose}'", derived.public_key,
                    value_styles=("dark",), width=18)
    s.screen.rule("=")
    s.screen.write("[STATUS] DERIVATION COMPLETE. RUN SYNC_LEDGER TO QUERY THE CHAIN.",
                   "cyan")


def cmd_decrypt(s: Session, arg: str) -> None:
    phrase = arg.strip()
    if not phrase:
        s.screen.warn("USAGE: DECRYPT <12 words>")
        return
    s.screen.write()
    wallet, error = s.screen.run_with_logs(lambda: derive_wallet(phrase), DECRYPT_LOGS)
    if isinstance(error, MnemonicError):
        s.screen.error(str(error))
        if error.kind == "checksum":
            s.screen.write(
                "        THE LAST WORD CARRIES THE CHECKSUM. ONE WRONG WORD BREAKS IT.",
                "red",
            )
        return
    if error is not None or wallet is None:
        s.screen.error(f"DERIVATION FAILED: {error}")
        return

    s.wallet = wallet
    owner = s.campaign.find_by_mnemonic(wallet.mnemonic)
    s.journal.refresh()
    generated = any(
        e.tool == "random" and e.payload.get("mnemonic") == wallet.mnemonic 
        for e in s.journal.entries
    )
    _record_decrypt(s, wallet, owner, generated=generated)
    s.screen.ok("MNEMONIC CHECKSUM VALID.")
    _print_derivation(s, wallet)

    if s.active and owner is not None and owner.id == s.active.id:
        _close_case(s, s.active)
    elif owner is not None and owner.id not in s.progress.solved:
        if s.campaign.is_unlocked(owner, s.progress):
            s.active = owner
            _close_case(s, owner)
        else:
            s.screen.warn(s.t("wrong_case", id=owner.id, name=owner.codename(s.lang)))
    elif owner is not None and owner.id in s.progress.solved:
        # Re-entering a known answer: let the player know it's already closed.
        active_id = s.active.id if s.active else "—"
        s.screen.info(s.t("already_solved", id=owner.id, active=active_id))
    elif s.active is not None:
        s.screen.warn(s.t("not_this_case", id=s.active.id))


def _close_case(s: Session, case: Case) -> None:
    first_time = case.id not in s.progress.solved
    s.progress.mark_solved(case.id)
    if first_time:
        _log(s, "case", f"Case {case.id} — {case.codename(s.lang)}", status="ok",
             payload={"caseId": case.id})
    s.screen.write()
    s.screen.write("  " + s.t("solved_banner", id=case.id), "magenta", "bold")
    client = s.campaign.client(case.client) if case.client else None
    if client is not None:
        s.screen.write("  " + s.t("filed_with", client=client["name"][s.lang]), "cyan")
    s.screen.rule("=")
    if first_time:
        s.screen.lines(case.epilogue(s.lang), "white", typed=True)
    else:
        s.screen.lines(case.epilogue(s.lang), "white")
    s.screen.rule("=")
    # The campaign, not any eight cases: closing eight contracts is not the end.
    if all(entry.id in s.progress.solved for entry in s.campaign.cases):
        s.screen.write()
        s.screen.write("  " + s.t("all_done"), "amber", "bold")
    s.screen.write()


def cmd_derive(s: Session, _arg: str) -> None:
    if not s.wallet:
        s.screen.warn(s.t("no_wallet"))
        return
    _print_derivation(s, s.wallet)


def _target_address(s: Session, arg: str) -> str | None:
    if arg.strip():
        return arg.strip()
    if s.wallet:
        return s.wallet.primary.address
    s.screen.warn(s.t("no_wallet"))
    return None


def cmd_sync(s: Session, arg: str) -> None:
    address = _target_address(s, arg)
    if address is None:
        return
    s.screen.write()
    s.screen.write(f"[NET] ESTABLISHING ENCRYPTED PROXY TO {s.chain.node_name} NODE... OK",
                   "cyan")
    s.screen.write(f"[NET] QUERYING ADDR: {address}", "cyan")
    stats, error = s.screen.run_with_logs(
        lambda: s.chain.address_stats(address), NET_LOGS
    )
    if isinstance(error, ChainError) or stats is None:
        s.screen.error("NETWORK LINK DOWN. NO EXPLORER ANSWERED.")
        s.screen.write(f"        {error}", "red")
        return
    if error is not None:
        s.screen.error(f"UNEXPECTED FAILURE: {error}")
        return

    _log(
        s, "ledger", address,
        status="warn" if stats.confirmed_sats > 0 else "info",
        detail=f"{stats.confirmed_btc} BTC · {stats.tx_count} tx · {stats.provider}",
        payload={"address": address},
    )
    s.screen.write("[NET] PARSING DATA STREAMS... SUCCESS", "cyan")
    s.screen.rule("-")
    s.screen.write("ADDRESS BALANCE ANALYSIS:", "white", "bold")
    s.screen.kv("CONFIRMED BALANCE", f"{stats.confirmed_btc} BTC")
    s.screen.kv("UNCONFIRMED TXs", f"{stats.unconfirmed_btc} BTC")
    s.screen.kv("TOTAL RECEIVED", f"{stats.total_received_btc} BTC")
    s.screen.kv("TOTAL SENT", f"{stats.total_sent_btc} BTC")
    s.screen.kv("TX COUNT", str(stats.tx_count))
    s.screen.kv("UTXO COUNT", str(stats.utxo_count))
    s.screen.kv("SOURCE NODE", stats.provider, value_styles=("dark",))
    s.screen.rule("-")
    if stats.confirmed_sats > 0:
        s.screen.write("[STATUS] ACCESS KEY REQUIRED FOR WITHDRAWAL.", "amber")
    elif stats.is_touched:
        s.screen.write("[STATUS] WALLET DRAINED. HISTORY INTACT — RUN TXLOG.", "amber")
    else:
        s.screen.write("[STATUS] ADDRESS NEVER USED ON MAINNET.", "grey")
    s.screen.write()


def cmd_sweep(s: Session, _arg: str) -> None:
    """Query every derived path — history often sits on one branch only."""
    if not s.wallet:
        s.screen.warn(s.t("no_wallet"))
        return
    s.screen.write()
    s.screen.write("[NET] SWEEPING DERIVATION GRID ACROSS THE LIVE CHAIN...", "cyan")

    wallet = s.wallet

    def sweep() -> list[tuple[str, AddressStats | ChainError]]:
        results: list[tuple[str, AddressStats | ChainError]] = []
        for derived in wallet.addresses:
            try:
                results.append((derived.label, s.chain.address_stats(derived.address)))
            except ChainError as exc:
                results.append((derived.label, exc))
        return results

    rows, error = s.screen.run_with_logs(sweep, NET_LOGS)
    if error is not None or rows is None:
        s.screen.error(f"SWEEP FAILED: {error}")
        return

    s.screen.rule("-")
    header = f"{'PATH':<16}{'ADDRESS':<46}{'TX':>5}  {'RECEIVED':>16}"
    s.screen.write(header, "grey")
    touched = 0
    for derived, (label, result) in zip(s.wallet.addresses, rows, strict=True):
        if isinstance(result, ChainError):
            s.screen.write(f"m/{derived.purpose}'".ljust(16)
                           + derived.address.ljust(46) + "  UNREACHABLE", "red")
            continue
        if result.is_touched:
            touched += 1
        s.screen.write(
            f"m/{derived.purpose}'".ljust(16) + derived.address.ljust(46)
            + f"{result.tx_count:>5}  {result.total_received_btc:>16}",
            "green" if result.is_touched else "dark",
        )
    s.screen.rule("-")
    _log(s, "sweep", s.wallet.primary.address,
         status="ok" if touched else "info",
         detail=f"{touched}/3 paths carry history",
         payload={"address": s.wallet.primary.address})
    if touched:
        s.screen.write(f"[STATUS] {touched}/3 PATHS CARRY ON-CHAIN HISTORY.", "amber")
    else:
        s.screen.write("[STATUS] NO PATH OF THIS SEED HAS EVER BEEN USED.", "grey")
    s.screen.write()


def cmd_txlog(s: Session, arg: str) -> None:
    address = _target_address(s, arg)
    if address is None:
        return
    s.screen.write()
    s.screen.write(f"[NET] FETCHING TRANSACTION HISTORY: {address}", "cyan")
    txs, error = s.screen.run_with_logs(
        lambda: s.chain.transactions(address, limit=8), NET_LOGS[:3]
    )
    if error is not None or txs is None:
        s.screen.error("TX HISTORY UNAVAILABLE.")
        s.screen.write(f"        {error}", "red")
        return
    if not txs:
        s.screen.warn("NO TRANSACTIONS RECORDED FOR THIS ADDRESS.")
        return
    s.screen.rule("-")
    for tx in txs:
        height = str(tx.block_height) if tx.block_height else "MEMPOOL"
        state = "CONFIRMED" if tx.confirmed else "PENDING  "
        if tx.value_delta_sats is not None:
            sign = "IN " if tx.value_delta_sats >= 0 else "OUT"
            delta = AddressStats.btc(abs(tx.value_delta_sats))
            delta_str = f"  {sign}  {delta:>16} BTC"
        else:
            delta_str = ""
        s.screen.write(
            f"  {state}  BLOCK {height:>9}  {tx.txid}{delta_str}", "green"
        )
    s.screen.rule("-")
    _log(s, "txlog", address, detail=f"{len(txs)} transaction(s)",
         payload={"address": address})
    s.screen.write(f"  {len(txs)} MOST RECENT TX(s)", "grey")
    s.screen.write()


def cmd_provider(s: Session, arg: str) -> None:
    name = arg.strip().lower()
    if not name:
        current = s.chain.order[0]
        for key, provider in PROVIDERS.items():
            mark = ">" if key == current else " "
            s.screen.write(f" {mark} {key:<12} {provider.base}", "green")
        return
    if name not in PROVIDERS:
        s.screen.error("UNKNOWN PROVIDER. TRY: " + ", ".join(PROVIDERS))
        return
    s.chain.preferred = name
    s.screen.ok(f"PRIMARY NODE: {PROVIDERS[name].name}")


def cmd_explorer(s: Session, arg: str) -> None:
    address = _target_address(s, arg)
    if address is None:
        return
    s.screen.kv("EXPLORER", s.chain.explorer_url(address), value_styles=("cyan",))


def cmd_netinfo(s: Session, _arg: str) -> None:
    """Probe every configured provider and display latency / status."""
    s.screen.write()
    s.screen.write("[NET] PROBING EXPLORER NODES...", "cyan")
    results, error = s.screen.run_with_logs(
        s.chain.netinfo, NET_LOGS[:2]
    )
    if error is not None or results is None:
        s.screen.error(f"PROBE FAILED: {error}")
        return
    s.screen.rule("-")
    s.screen.write("NETWORK NODE STATUS:", "white", "bold")
    current = s.chain.order[0]
    for key, status in results.items():
        mark = "PRIMARY  " if key == current else "FALLBACK "
        style = "green" if status.startswith("OK") else "red"
        s.screen.write(f"  {mark} {key:<12} {PROVIDERS[key].base:<35} {status}", style)
    s.screen.rule("-")
    s.screen.write(f"[STATUS] ACTIVE PROVIDER: {s.chain.node_name}", "cyan")
    s.screen.write()


def _log(s: Session, tool: str, title: str, *, detail: str = "",
         status: str = "info", payload: dict | None = None) -> None:
    """Record one move; the web build reads the same structure."""
    s.journal.push(tool, title, detail=detail, status=status, payload=payload)


def _record_decrypt(s: Session, wallet: Wallet, owner, *, generated: bool = False) -> None:
    """Journal a derivation, masking phrases the game does not recognise."""
    storable = owner is not None or generated
    _log(
        s,
        "random" if generated else "decrypt",
        wallet.primary.address if storable else mask_address(wallet.primary.address),
        status="ok" if owner is not None else "info",
        detail=wallet.mnemonic if storable
        else f"{mask_mnemonic(wallet.mnemonic)} — NOT STORED",
        payload={"mnemonic": wallet.mnemonic} if storable else {"masked": True},
    )


def cmd_journal(s: Session, arg: str) -> None:
    """List the investigation journal, newest first."""
    tool = arg.strip().lower()
    if tool and tool not in TOOLS:
        s.screen.error("UNKNOWN TOOL. TRY: " + ", ".join(TOOLS))
        return
    s.journal.refresh()
    entries = s.journal.by_tool(tool)
    if not entries:
        s.screen.warn("JOURNAL EMPTY.")
        return
    page = entries[:30]
    # Save this view so RECALL/PIN positions always agree with what was printed.
    s._journal_view = page
    s.screen.write()
    s.screen.write("  INVESTIGATION JOURNAL", "cyan", "bold")
    s.screen.rule()
    for index, entry in enumerate(page, 1):
        style = STATUS_STYLES.get(entry.status, "grey")
        label = TOOLS.get(entry.tool, entry.tool).upper()
        pin = "*" if entry.pinned else " "
        print(
            s.screen.paint(f"{index:>3}. {entry.clock} ", "dark")
            + s.screen.paint(f"{label:<12}", "cyan")
            + s.screen.paint(f"{pin} ", "amber")
            + s.screen.paint(entry.title, style)
        )
        if entry.detail:
            s.screen.write(f"      {entry.detail}", "dark")
    s.screen.rule()
    shown = len(page)
    total = len(entries)
    suffix = f" (showing {shown} of {total})" if total > shown else ""
    s.screen.write(f"  {total} ENTRY(S){suffix} — RECALL <n> TO REPLAY", "grey")
    s.screen.write()


def _view_entry(s: Session, position: int):
    """Return the Entry at 1-based ``position`` in the last JOURNAL view.

    Falls back to the full unfiltered list when no JOURNAL has been run yet
    (e.g. direct RECALL 1 on session start) so the command still works.
    """
    view = s._journal_view or s.journal.entries
    if 1 <= position <= len(view):
        return view[position - 1]
    return None


def cmd_recall(s: Session, arg: str) -> None:
    """Replay a journal entry in the tool that produced it."""
    try:
        position = int(arg.strip())
    except ValueError:
        s.screen.warn("USAGE: RECALL <n>  (see JOURNAL)")
        return
    s.journal.refresh()
    entry = _view_entry(s, position)
    if entry is None:
        s.screen.error(f"NO JOURNAL ENTRY {position}.")
        return
    payload = entry.payload or {}
    s.screen.info(f"REPLAYING #{position}: {entry.title}")

    if entry.tool in ("decrypt", "random"):
        mnemonic = payload.get("mnemonic")
        if not mnemonic:
            s.screen.warn(
                "PHRASE WAS NOT STORED — THE GAME DOES NOT KEEP UNKNOWN SEEDS."
            )
            return
        cmd_decrypt(s, mnemonic)
    elif entry.tool == "ledger":
        cmd_sync(s, payload.get("address", ""))
    elif entry.tool == "sweep":
        cmd_sweep(s, "")
    elif entry.tool == "txlog":
        cmd_txlog(s, payload.get("address", ""))
    elif entry.tool == "search":
        cmd_search(s, payload.get("query", ""))
    elif entry.tool == "archive":
        cmd_archive(s, payload.get("query", ""))
    elif entry.tool == "complete":
        cmd_complete(s, payload.get("pattern", ""))
    elif entry.tool in ("case", "hint"):
        cmd_open(s, str(payload.get("caseId", "")))
    else:
        s.screen.warn("THIS ENTRY HAS NOTHING TO REPLAY.")


def cmd_pin(s: Session, arg: str) -> None:
    try:
        position = int(arg.strip())
    except ValueError:
        s.screen.warn("USAGE: PIN <n>  (see JOURNAL)")
        return
    s.journal.refresh()
    target = _view_entry(s, position)
    if target is None:
        s.screen.error(f"NO JOURNAL ENTRY {position}.")
        return
    # toggle_pin works by full-list position; look the entry up by its stable id.
    full_pos = next(
        (i + 1 for i, e in enumerate(s.journal.entries) if e.id == target.id), None
    )
    if full_pos is None:
        s.screen.error(f"NO JOURNAL ENTRY {position}.")
        return
    entry = s.journal.toggle_pin(full_pos)
    if entry is None:
        s.screen.error(f"NO JOURNAL ENTRY {position}.")
        return
    s.screen.ok(("PINNED: " if entry.pinned else "UNPINNED: ") + entry.title)


def cmd_purge(s: Session, arg: str) -> None:
    purge_all = arg.strip().lower() == "all"
    s.journal.clear(keep_pinned=not purge_all)
    s.screen.ok(
        "JOURNAL CLEARED." if purge_all else "JOURNAL CLEARED, PINNED ENTRIES KEPT."
    )


def cmd_status(s: Session, _arg: str) -> None:
    s.screen.write()
    s.screen.kv("OPERATOR", s.campaign.meta["operator"])
    s.screen.kv("CLIENT", s.campaign.meta["client"])
    s.screen.kv("BUILD", f"{__version__}")
    s.screen.kv("LANGUAGE", s.lang.upper())
    s.screen.kv("PRIMARY NODE", s.chain.node_name)
    s.screen.kv("MODE", "OFFLINE" if s.chain.offline else "LIVE NET",
                value_styles=("amber",) if s.chain.offline else ("green",))
    s.screen.kv("WORDLIST", "AUTHENTIC" if wordlist_is_authentic() else "MODIFIED")
    # Against the desk, not the campaign: solved counts contracts too, so
    # closing one used to read 9/8.
    desk = s.campaign.caseload(s.progress)
    closed = sum(1 for case in desk if case.id in s.progress.solved)
    s.screen.kv("CASES CLOSED", f"{closed}/{len(desk)}")
    s.screen.kv("JOURNAL", f"{len(s.journal)} entries")
    s.screen.kv("ACTIVE CASE",
                f"{s.active.id:02d} {s.active.codename(s.lang)}" if s.active else "NONE")
    if s.wallet:
        s.screen.kv("LOADED ADDRESS", s.wallet.primary.address)
        try:
            entropy = mnemonic_to_entropy(s.wallet.mnemonic)
            s.screen.kv("SEED ENTROPY", entropy.hex(), value_styles=("dark",))
        except MnemonicError:  # pragma: no cover - wallet is validated on load
            pass
    s.screen.write()


def cmd_clear(s: Session, _arg: str) -> None:
    print("\033[2J\033[H", end="", flush=True)


def cmd_reset(s: Session, _arg: str) -> None:
    if not s.progress.save():
        s.screen.error("PROGRESS DISK WRITE FAILED — RESET NOT SAVED.")
        return
    s.progress.reset()
    s.active = None
    s.wallet = None
    s.screen.ok("PROGRESS ERASED. ARCHIVE SEALED AGAIN.")
    s.screen.warn("NOTE: JOURNAL STILL HOLDS ANSWERS. RUN PURGE ALL TO CLEAR IT.")


def cmd_exit(s: Session, _arg: str) -> None:
    s.running = False
    s.screen.write()
    s.screen.write("[SYS] SESSION CLOSED. THE RAIN KEEPS FALLING.", "dark")


COMMANDS = {
    "HELP": cmd_help, "?": cmd_help,
    "ABOUT": cmd_about,
    "LANG": cmd_lang,
    "CASES": cmd_cases, "LS": cmd_cases,
    "OPEN": cmd_open,
    "BRIEF": cmd_brief,
    "EVIDENCE": cmd_evidence,
    "CLUES": cmd_clues,
    "HINT": cmd_hint,
    "WORD": cmd_word,
    "INDEX": cmd_index,
    "SEARCH": cmd_search,
    "CLIENTS": cmd_clients,
    "BOARD": cmd_board,
    "DROP": cmd_drop,
    "ARCHIVE": cmd_archive,
    "RANDOM": cmd_random, "ROLL": cmd_random,
    "COMPLETE": cmd_complete, "FIND": cmd_complete,
    "ENTROPY": cmd_entropy,
    "DECRYPT": cmd_decrypt,
    "DERIVE": cmd_derive,
    "SYNC_LEDGER": cmd_sync, "SYNC": cmd_sync,
    "SWEEP": cmd_sweep,
    "TXLOG": cmd_txlog,
    "PROVIDER": cmd_provider,
    "EXPLORER": cmd_explorer,
    "NETINFO": cmd_netinfo,
    "JOURNAL": cmd_journal, "LOG": cmd_journal,
    "RECALL": cmd_recall,
    "PIN": cmd_pin,
    "PURGE": cmd_purge,
    "STATUS": cmd_status,
    "CLEAR": cmd_clear,
    "RESET": cmd_reset,
    "EXIT": cmd_exit, "QUIT": cmd_exit,
}


def dispatch(session: Session, line: str) -> None:
    line = line.strip()
    if not line:
        return
    head, _, tail = line.partition(" ")
    handler = COMMANDS.get(head.upper())
    if handler is None:
        session.screen.error(f"UNKNOWN COMMAND: {head.upper()}")
        session.screen.write("        TYPE HELP FOR THE COMMAND LIST.", "grey")
        return
    handler(session, tail)


def build_session(args: argparse.Namespace) -> Session:
    campaign = Campaign()
    return Session(
        campaign=campaign,
        progress=Progress.load(),
        screen=Screen(colour=None if not args.no_color else False, speed=args.speed),
        chain=ChainClient(preferred=args.provider, offline=args.offline),
        journal=Journal(),
        lang=args.lang,
    )


def run(session: Session) -> int:
    screen = session.screen
    screen.boot(
        version=__version__,
        checksum="OK" if wordlist_is_authentic() else "MODIFIED",
        provider=session.chain.node_name,
        operator=session.campaign.meta["operator"],
        client=session.campaign.meta["client"],
    )
    screen.lines(session.campaign.prologue(session.lang), "white", typed=True)
    screen.write()

    while session.running:
        try:
            line = input(screen.paint(PROMPT, "green", "bold"))
        except EOFError:
            screen.write()
            break
        except KeyboardInterrupt:
            screen.write()
            screen.write("[SYS] INTERRUPT — TYPE EXIT TO LEAVE.", "amber")
            continue
        dispatch(session, line)
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="enigma-terminal",
        description="ENIGMA TERMINAL — a detective quest over the live Bitcoin network.",
    )
    parser.add_argument("--lang", choices=LANGUAGES, default="ru",
                        help="narrative language (default: ru)")
    parser.add_argument("--provider", choices=tuple(PROVIDERS), default=None,
                        help="preferred block explorer")
    parser.add_argument("--offline", action="store_true",
                        help="disable every network call; crypto still runs for real")
    parser.add_argument("--speed", type=float, default=1.0,
                        help="animation speed multiplier; 0 disables animation")
    parser.add_argument("--no-color", action="store_true", help="disable ANSI colour")
    parser.add_argument("--command", "-c", action="append", default=None,
                        help="run a command and exit (repeatable)")
    args = parser.parse_args(argv)

    session = build_session(args)
    if args.command:
        for line in args.command:
            dispatch(session, line)
        return 0
    try:
        return run(session)
    except KeyboardInterrupt:  # pragma: no cover - user abort
        session.screen.write()
        return 130


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
