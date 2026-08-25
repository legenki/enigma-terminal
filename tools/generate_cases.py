#!/usr/bin/env python3
"""Generate the 256-case contract board from the eight client dossiers.

Two hundred and fifty-six hand-written cases would be three thousand riddles,
and they would be bad ones. Instead the creative work lives in two places that
scale: `data/clients.json` holds the voices, and this file holds the puzzle
*dialects* — the ways a client can point at a word without naming it.

The hard constraint is the checksum: twelve arbitrary words are almost never a
valid BIP-39 phrase. So every case is built the other way round — a valid
mnemonic is drawn first, then each of its words is described in the client's
dialect. That guarantees the answer exists before the puzzle does.

Every case also carries a machine-readable `solution`, so the test suite can
solve all 256 without a human and prove none of them is a dead end. The field
is stripped from the web build; the shipped clues are enough to play.

Run: python3 tools/generate_cases.py
"""

from __future__ import annotations

import hashlib
import json
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from enigma_terminal.crypto_engine import (  # noqa: E402
    WORDLIST, entropy_to_mnemonic, fingerprint, index_of, validate, word_at,
)

FIRST_ID = 9                     # 1..8 are the hand-written campaign
CASES_PER_CLIENT = 32
ACTS = 4
CASES_PER_ACT = CASES_PER_CLIENT // ACTS
GRID_COLUMNS = 16                # 2048 words as 128 rows x 16 columns

#: Deterministic: the same board every build, on every machine.
MASTER_SEED = "bip39-neon-terminal/contract-board/v1"


def board_key(client: dict) -> str:
    """The string that seeds this client's 32 answers.

    Deliberately *not* the slug. The slug is player-facing — it is printed by
    CLIENTS and typed to open a board — so it has to be free to change with the
    fiction. Seeding the RNG from it would mean every rename silently reshuffled
    the client's mnemonics and invalidated saved games. `board_key` is written
    once and never edited again.
    """
    return client.get("board_key", client["slug"])


def rng_for(*parts: object) -> random.Random:
    digest = hashlib.sha256("|".join(str(p) for p in parts).encode()).hexdigest()
    return random.Random(int(digest[:16], 16))


# --------------------------------------------------------------------------- #
# Answers
# --------------------------------------------------------------------------- #

def draw_entropy(rng: random.Random) -> bytes:
    return bytes(rng.randrange(256) for _ in range(16))


def patterned_entropy(rng: random.Random) -> tuple[bytes, dict]:
    """Entropy a person could describe out loud — the ESCRIBANÍA/BAJOFONDO style."""
    style = rng.choice(["repeat", "alternate", "ascend", "ascii"])
    if style == "repeat":
        byte = rng.randrange(256)
        return bytes([byte] * 16), {"style": "repeat", "byte": byte}
    if style == "alternate":
        a, b = rng.randrange(256), rng.randrange(256)
        return bytes([a, b] * 8), {"style": "alternate", "bytes": [a, b]}
    if style == "ascend":
        start, step = rng.randrange(64), rng.choice([1, 2, 3, 5, 7, 9, 11, 17])
        return (bytes((start + step * i) % 256 for i in range(16)),
                {"style": "ascend", "start": start, "step": step})
    token = "".join(rng.choice("ABCDEFGHJKLMNPRSTUVWXYZ") for _ in range(8))
    return (token * 2).encode("ascii"), {"style": "ascii", "token": token}


# --------------------------------------------------------------------------- #
# Puzzle dialects — each turns one word into a clue plus a checkable spec
# --------------------------------------------------------------------------- #

def unique_prefix(word: str) -> tuple[str, bool]:
    """Shortest prefix no other entry shares, and whether one exists at all.

    Forty-nine words in the list are prefixes of longer ones — 'add' sits under
    'addict' and 'address' — so for those no prefix can ever single them out.
    They are pointed at as the *shortest* branch instead, which is unique
    precisely because the word itself is the stem the others grew from.
    """
    for length in range(1, len(word) + 1):
        prefix = word[:length]
        if sum(1 for candidate in WORDLIST if candidate.startswith(prefix)) == 1:
            return prefix, True
    return word, False


def arithmetic_for(target: int, rng: random.Random) -> tuple[str, int]:
    """A small expression that evaluates to `target`, and the value itself."""
    form = rng.choice(["mul_add", "sub", "sum", "double"])
    if form == "mul_add" and target > 12:
        factor = rng.choice([w for w in range(3, 40) if w * 2 <= target] or [2])
        whole = target // factor
        rest = target - whole * factor
        return f"{whole} × {factor} + {rest}", target
    if form == "sub":
        extra = rng.randrange(20, 400)
        return f"{target + extra} − {extra}", target
    if form == "double" and target % 2 == 0:
        return f"{target // 2} × 2", target
    left = rng.randrange(1, max(target, 2))
    return f"{left} + {target - left}", target


def clue_for(word: str, position: int, archetype: str, rng: random.Random,
             known_words: list[str]) -> tuple[dict, dict]:
    """Return (bilingual clue line, machine-checkable step)."""
    index = index_of(word)
    n = f"{position + 1:2d}."

    if archetype == "index_math":
        expression, value = arithmetic_for(index, rng)
        return (
            {"ru": f"{n} слово № {expression}", "en": f"{n} word no. {expression}", "es": f"{n} palabra n.º {expression}", "pt": f"{n} palavra n.º {expression}"},
            {"kind": "index", "index": value, "word": word},
        )

    if archetype == "mirror_index":
        mirrored = 2049 - index
        return (
            {"ru": f"{n} зеркало номера {mirrored}", "en": f"{n} the mirror of number {mirrored}", "es": f"{n} el espejo del número {mirrored}", "pt": f"{n} o espelho do número {mirrored}"},
            {"kind": "mirror", "mirror": mirrored, "word": word},
        )

    if archetype == "grid_coords":
        row, column = divmod(index - 1, GRID_COLUMNS)
        return (
            {"ru": f"{n} ряд {row + 1}, колонка {column + 1}",
             "en": f"{n} row {row + 1}, column {column + 1}",
             "es": f"{n} fila {row + 1}, columna {column + 1}",
             "pt": f"{n} linha {row + 1}, coluna {column + 1}"},
            {"kind": "grid", "row": row + 1, "column": column + 1, "word": word},
        )

    if archetype == "ledger_amounts":
        return (
            {"ru": f"{n} лот ушёл за 0.{index:08d} BTC",
             "en": f"{n} the lot closed at 0.{index:08d} BTC",
             "es": f"{n} el lote cerró en 0.{index:08d} BTC",
             "pt": f"{n} o lote fechou em 0.{index:08d} BTC"},
            {"kind": "sats", "sats": index, "word": word},
        )

    if archetype == "unique_prefix":
        prefix, exclusive = unique_prefix(word)
        if exclusive:
            return (
                {"ru": f"{n} единственная ветка на «{prefix}»",
                 "en": f"{n} the only branch under '{prefix}'",
                 "es": f"{n} la única rama bajo '{prefix}'",
                 "pt": f"{n} o único ramo sob '{prefix}'"},
                {"kind": "prefix", "prefix": prefix, "word": word},
            )
        return (
            {"ru": f"{n} самая короткая ветка на «{prefix}»",
             "en": f"{n} the shortest branch under '{prefix}'",
             "es": f"{n} la rama más corta bajo '{prefix}'",
             "pt": f"{n} o ramo mais curto sob '{prefix}'"},
            {"kind": "prefix_shortest", "prefix": prefix, "word": word},
        )

    if archetype == "neighbour":
        # Point at a word by its neighbour in the list, never at itself.
        if index > 1 and (index == 2048 or rng.random() < 0.5):
            anchor, direction = word_at(index - 1), "after"
            line = {"ru": f"{n} следующее за «{anchor}»", "en": f"{n} the one after '{anchor}'", "es": f"{n} el siguiente después de '{anchor}'", "pt": f"{n} o próximo depois de '{anchor}'"}
        else:
            anchor, direction = word_at(index + 1), "before"
            line = {"ru": f"{n} стоящее перед «{anchor}»", "en": f"{n} the one before '{anchor}'", "es": f"{n} el anterior a '{anchor}'", "pt": f"{n} o anterior a '{anchor}'"}
        return line, {"kind": "neighbour", "anchor": anchor, "direction": direction, "word": word}

    raise ValueError(f"unknown archetype {archetype}")


def build_puzzle(mnemonic: str, archetype: str, rng: random.Random) -> tuple[list, list]:
    """Clue lines and solver steps for a whole phrase."""
    words = mnemonic.split()

    if archetype == "redacted":
        # Everything is on the sheet but one word: the checksum recovers it.
        hidden = rng.randrange(len(words))
        shown = ["▓▓▓▓▓" if i == hidden else w for i, w in enumerate(words)]
        pattern = " ".join("?" if i == hidden else w for i, w in enumerate(words))
        lines = [
            {"ru": "    " + " ".join(shown[:6]), "en": "    " + " ".join(shown[:6]), "es": "    " + " ".join(shown[:6]), "pt": "    " + " ".join(shown[:6])},
            {"ru": "    " + " ".join(shown[6:]), "en": "    " + " ".join(shown[6:]), "es": "    " + " ".join(shown[6:]), "pt": "    " + " ".join(shown[6:])},
            {"ru": "", "en": "", "es": "", "pt": ""},
            {"ru": f"Позиция {hidden + 1} вымарана. Восстанови её контрольной суммой:",
             "en": f"Position {hidden + 1} is redacted. Recover it by checksum:",
             "es": f"La posición {hidden + 1} está censurada. Recupérala con la suma de comprobación:",
             "pt": f"A posição {hidden + 1} está censurada. Recupere-a com a soma de verificação:"},
            {"ru": f"COMPLETE {pattern}", "en": f"COMPLETE {pattern}", "es": f"COMPLETE {pattern}", "pt": f"COMPLETE {pattern}"},
        ]
        return lines, [{"kind": "redacted", "pattern": pattern, "word": words[hidden],
                        "position": hidden}]

    lines, steps = [], []
    for position, word in enumerate(words):
        line, step = clue_for(word, position, archetype, rng, words)
        lines.append(line)
        steps.append(step)
    return lines, steps


# --------------------------------------------------------------------------- #
# Narrative assembly
# --------------------------------------------------------------------------- #


DIALECT_PRIMER = {
    "index_math": {
        "ru": "Каждая строка даёт номер слова в словаре BIP-39. Посчитай и загляни: WORD <n>.",
        "en": "Each line gives a word's number in the BIP-39 list. Do the sum, then look: WORD <n>.",
        "es": "Cada línea da el número de una palabra en la lista BIP-39. Haz la suma y busca: WORD <n>.",
        "pt": "Cada linha dá o número de uma palavra na lista BIP-39. Faça a soma e busque: WORD <n>.",
    },
    "mirror_index": {
        "ru": "Числа зеркальны: настоящий номер — это 2049 минус названный.",
        "en": "The numbers are mirrored: the real index is 2049 minus the one given.",
        "es": "Los números están en espejo: el índice real es 2049 menos el indicado.",
        "pt": "Os números estão espelhados: o índice real é 2049 menos o indicado.",
    },
    "grid_coords": {
        "ru": "Словарь разложен по сетке 128 × 16. Номер слова = (ряд − 1) × 16 + колонка.",
        "en": "The list is laid out 128 × 16. A word's index is (row − 1) × 16 + column.",
        "es": "La lista está dispuesta en 128 × 16. El índice es (fila − 1) × 16 + columna.",
        "pt": "A lista está disposta em 128 × 16. O índice é (linha − 1) × 16 + coluna.",
    },
    "ledger_amounts": {
        "ru": "Цена лота — это сатоши, а сатоши — это номер слова. Ноль целых, восемь знаков.",
        "en": "A lot's price is satoshi, and the satoshi are the word's index. Zero point, eight digits.",
        "es": "El precio de un lote son satoshis, y los satoshis son el índice. Cero punto, ocho dígitos.",
        "pt": "O preço de um lote são satoshis, e os satoshis são o índice. Zero ponto, oito dígitos.",
    },
    "unique_prefix": {
        "ru": "В словаре ровно одно слово начинается так. Проверь командой SEARCH <начало>.",
        "en": "Exactly one word in the list begins that way. Check it with SEARCH <prefix>.",
        "es": "Exactamente una palabra en la lista comienza así. Compruébalo con SEARCH <prefix>.",
        "pt": "Exatamente uma palavra na lista começa assim. Verifique com SEARCH <prefix>.",
    },
    "neighbour": {
        "ru": "Каждое слово стоит вплотную к названному. INDEX <слово> даст номер соседа.",
        "en": "Each word sits right beside the one named. INDEX <word> gives the neighbour's number.",
        "es": "Cada palabra se ubica justo al lado de la nombrada. INDEX <word> da el número del vecino.",
        "pt": "Cada palavra fica bem ao lado da nomeada. INDEX <word> dá o número do vizinho.",
    },
    "entropy_pattern": {
        "ru": "Здесь нет слов — есть шестнадцать байт. Собери их и скорми команде ENTROPY <hex>.",
        "en": "There are no words here, only sixteen bytes. Assemble them and feed ENTROPY <hex>.",
        "es": "Aquí no hay palabras, solo dieciséis bytes. Ensámblalos y usa ENTROPY <hex>.",
        "pt": "Não há palavras aqui, apenas dezesseis bytes. Monte-os e use ENTROPY <hex>.",
    },
    "redacted": {
        "ru": "Фраза выдана целиком, кроме одного слова. Его вернёт контрольная сумма.",
        "en": "The phrase is released in full but for one word. The checksum will give it back.",
        "es": "La frase se entrega completa excepto por una palabra. La suma de comprobación la recuperará.",
        "pt": "A frase é entregue completa, exceto por uma palavra. A soma de verificação a recuperará.",
    },
}

ENTROPY_CLUES = {
    "repeat": {
        "ru": "Один байт, повторённый шестнадцать раз: {hex2} — и так до конца строки.",
        "en": "One byte repeated sixteen times: {hex2}, all the way along.",
        "es": "Un byte repetido dieciséis veces: {hex2}, hasta el final.",
        "pt": "Um byte repetido dezesseis vezes: {hex2}, até o fim.",
    },
    "alternate": {
        "ru": "Два байта, чередующиеся восемь раз: {a} и {b}.",
        "en": "Two bytes alternating eight times: {a} then {b}.",
        "es": "Dos bytes alternando ocho veces: {a} luego {b}.",
        "pt": "Dois bytes alternando oito vezes: {a} depois {b}.",
    },
    "ascend": {
        "ru": "Шестнадцать байт с шагом {step}, начиная с {start} (по модулю 256).",
        "en": "Sixteen bytes stepping by {step} from {start} (modulo 256).",
        "es": "Dieciséis bytes avanzando de a {step} desde {start} (módulo 256).",
        "pt": "Dezesseis bytes avançando de {step} em {step} desde {start} (módulo 256).",
    },
    "ascii": {
        "ru": "Восемь букв «{token}», записанные в ASCII и повторённые дважды.",
        "en": "The eight letters '{token}' in ASCII, written out twice.",
        "es": "Las ocho letras '{token}' en ASCII, escritas dos veces.",
        "pt": "As oito letras '{token}' em ASCII, escritas duas vezes.",
    },
}

def entropy_clue_lines(spec: dict, entropy: bytes) -> list[dict]:
    template = ENTROPY_CLUES[spec["style"]]
    fields = {
        "hex2": f"0x{spec.get('byte', 0):02x}",
        "a": f"0x{spec.get('bytes', [0, 0])[0]:02x}",
        "b": f"0x{spec.get('bytes', [0, 0])[1]:02x}",
        "step": spec.get("step"),
        "start": spec.get("start"),
        "token": spec.get("token"),
    }
    return [{"ru": template["ru"].format(**fields), "en": template["en"].format(**fields), "es": template["es"].format(**fields), "pt": template["pt"].format(**fields)}]

#: Every language the generated board is written in. English is the fallback
#: elsewhere, but a contract must carry all four or the board is half-built.
LANGS = ("ru", "en", "es", "pt")

EXHIBIT = {"ru": "ВЕЩДОК: ", "en": "EXHIBIT: ", "es": "PRUEBA: ", "pt": "PROVA: "}

WORDS = {"ru": "Слова", "en": "Words", "es": "Palabras", "pt": "Palavras"}

ENTROPY_OPENER = {
    "ru": "Энтропия начинается с ",
    "en": "The entropy begins with ",
    "es": "La entropía comienza con ",
    "pt": "A entropia começa com ",
}


BRIEF = {
    "ru": [
        "Заказчик: {client}. Район: {district}.",
        "Дело {act_index} из восьми в фазе «{act}».",
        "{hook}",
    ],
    "en": [
        "Client: {client}. District: {district}.",
        "Case {act_index} of eight in the '{act}' phase.",
        "{hook}",
    ],
    "es": [
        "Cliente: {client}. Distrito: {district}.",
        "Caso {act_index} de ocho en la fase '{act}'.",
        "{hook}",
    ],
    "pt": [
        "Cliente: {client}. Distrito: {district}.",
        "Caso {act_index} de oito na fase '{act}'.",
        "{hook}",
    ],
}

HOOKS = {
    "ru": [
        "Кошелёк числится за человеком, которого не могут найти уже {years} года.",
        "Ключ был у подрядчика. Подрядчик закрылся, документы уехали в макулатуру, кошелёк остался.",
        "Владелец умер, наследники судятся, а фраза лежит в сейфе, который никто не может открыть.",
        "Счёт заморожен формально. Фактически его просто некому разморозить.",
        "Эту фразу разделили на части между тремя людьми. Двое согласны сотрудничать.",
        "Кошелёк всплыл при инвентаризации. В описи он значится как «прочее».",
        "Ключ вынесли из офиса в день закрытия. Вместе с кофемашиной.",
        "Про этот кошелёк забыли настолько прочно, что о нём напомнил налоговый запрос.",
        "Расчёт шёл через cueva на Флориде. Cueva закрылась в ту же неделю, вместе с ключом.",
        "Фразу записали на обороте билета в Субте. Билет нашли, обратную сторону — нет.",
        "Владелец держал ключ в депозитной ячейке на Реконкисте. Банк съехал {years} года назад.",
        "Судестада залила подвал, и вместе с архивом ушёл единственный человек, знавший фразу.",
        "Арболито с Флориды взял кошелёк в залог и с тех пор не выходит на связь.",
        "Ключ уехал с грузом в Мар-дель-Плату и вернулся без хозяина.",
    ],
    "en": [
        "The wallet is registered to someone nobody has found in {years} years.",
        "A contractor held the key. The contractor folded, the papers went to pulp, the wallet stayed.",
        "The owner died, the heirs are in court, and the phrase sits in a safe nobody can open.",
        "The account is frozen on paper. In practice there is simply no one left to unfreeze it.",
        "The phrase was split between three people. Two of them are willing to cooperate.",
        "The wallet surfaced during an inventory. The schedule lists it as 'miscellaneous'.",
        "The key left the office on closing day. Along with the coffee machine.",
        "This wallet was forgotten so thoroughly that a tax query had to remind everyone.",
        "Settlement ran through a cueva off Florida. The cueva shut that same week, key and all.",
        "The phrase was written on the back of a Subte ticket. The ticket turned up; the back did not.",
        "The owner kept the key in a box on Reconquista. The bank moved out {years} years ago.",
        "The sudestada flooded the cellar, and the one person who knew the phrase went with the archive.",
        "An arbolito on Florida took the wallet as collateral and has not been seen since.",
        "The key travelled to Mar del Plata with a shipment and came back without its owner.",
    ],
    "es": [
        "La cartera está registrada a nombre de alguien a quien nadie ha encontrado en {years} años.",
        "Un contratista tenía la clave. Quebró, los papeles se hicieron pulpa, la cartera se quedó.",
        "El dueño murió, los herederos están en juicio y la frase reposa en una caja fuerte que nadie puede abrir.",
        "La cuenta está formalmente congelada. En la práctica no queda nadie para descongelarla.",
        "La frase se dividió entre tres personas. Dos están dispuestas a cooperar.",
        "La cartera apareció en un inventario. El registro la cataloga como 'miscelánea'.",
        "La clave salió de la oficina el día del cierre. Junto con la máquina de café.",
        "Esta cartera fue olvidada tan a fondo que una consulta fiscal tuvo que recordarla.",
        "La liquidación pasó por una cueva en Florida. Cerró la misma semana, clave incluida.",
        "La frase fue escrita en el reverso de un boleto de Subte. El boleto apareció; el reverso no.",
        "El dueño guardaba la clave en una caja en Reconquista. El banco se mudó hace {years} años.",
        "La sudestada inundó el sótano, y la única persona que conocía la frase se fue con el archivo.",
        "Un arbolito en Florida tomó la cartera como garantía y no se le ha visto desde entonces.",
        "La clave viajó a Mar del Plata con un cargamento y regresó sin su dueño."
    ],
    "pt": [
        "A carteira está registrada no nome de alguém que não é encontrado há {years} anos.",
        "Um empreiteiro tinha a chave. Ele faliu, os papéis viraram celulose, a carteira ficou.",
        "O dono morreu, os herdeiros estão no tribunal, e a frase repousa num cofre que ninguém consegue abrir.",
        "A conta está formalmente congelada. Na prática, não sobrou ninguém para descongelá-la.",
        "A frase foi dividida entre três pessoas. Duas estão dispostas a cooperar.",
        "A carteira apareceu em um inventário. O registro a cataloga como 'diversos'.",
        "A chave saiu do escritório no dia do fechamento. Junto com a máquina de café.",
        "Esta carteira foi esquecida tão profundamente que uma consulta fiscal teve que lembrá-la.",
        "O pagamento passou por uma cueva na Florida. A cueva fechou na mesma semana, com a chave e tudo.",
        "A frase foi escrita no verso de um bilhete do Subte. O bilhete apareceu; o verso não.",
        "O dono guardava a chave numa caixa na Reconquista. O banco mudou-se há {years} anos.",
        "A sudestada inundou o porão, e a única pessoa que conhecia a frase se foi com o arquivo.",
        "Um arbolito na Florida pegou a carteira como garantia e não é visto desde então.",
        "A chave viajou para Mar del Plata com um carregamento e voltou sem seu dono."
    ],
}

EPILOGUE = {
    "ru": [
        "Ключ восстановлен. Адрес чист: по нему не прошло ни одной транзакции —",
        "ни входящей, ни исходящей. Проверь сам, SWEEP покажет все три пути.",
        "{payoff}",
    ],
    "en": [
        "Key recovered. The address is clean: not one transaction has ever touched it —",
        "nothing in, nothing out. See for yourself; SWEEP walks all three paths.",
        "{payoff}",
    ],
    "es": [
        "Clave recuperada. La dirección está limpia: ni una sola transacción la ha tocado —",
        "nada entra, nada sale. Compruébalo tú mismo; SWEEP recorre las tres rutas.",
        "{payoff}",
    ],
    "pt": [
        "Chave recuperada. O endereço está limpo: nem uma única transação a tocou —",
        "nada entra, nada sai. Verifique você mesmo; SWEEP percorre as três rotas.",
        "{payoff}",
    ],
}


def codename_deck(client: dict) -> list[tuple[int, int]]:
    """Thirty-two distinct adjective/noun pairs, dealt without replacement.

    Drawing at random from sixty-four combinations gives a client two
    identically named cases about a third of the time, so the deck is shuffled
    once and dealt instead.
    """
    adjectives = client["motifs"]["adjective"]["ru"]
    nouns = client["motifs"]["noun"]["ru"]
    deck = [(a, n) for a in range(len(adjectives)) for n in range(len(nouns))]
    rng_for(MASTER_SEED, "deck", board_key(client)).shuffle(deck)
    return deck[:CASES_PER_CLIENT]


def make_case(client: dict, slot: int, case_id: int, deck: list) -> dict:
    act = slot // CASES_PER_ACT
    act_index = slot % CASES_PER_ACT + 1
    rng = rng_for(MASTER_SEED, board_key(client), slot)

    archetype = client["archetypes"][slot % len(client["archetypes"])]
    # The final act of every client always ends on their signature dialect.
    if act == ACTS - 1:
        archetype = client["archetypes"][0]

    if archetype == "entropy_pattern":
        entropy, spec = patterned_entropy(rng)
        mnemonic = entropy_to_mnemonic(entropy)
        clue_lines = entropy_clue_lines(spec, entropy)
        steps = [{"kind": "entropy", "hex": entropy.hex()}]
        kind = "entropy"
    else:
        mnemonic = entropy_to_mnemonic(draw_entropy(rng))
        clue_lines, steps = build_puzzle(mnemonic, archetype, rng)
        kind = "words"

    validate(mnemonic)

    adjectives = client["motifs"]["adjective"]
    nouns = client["motifs"]["noun"]
    a_i, n_i = deck[slot]
    # Russian adjectives agree with the noun; English ones do not care.
    ru_gender = nouns["ru_gender"][n_i]
    russian_adjective = adjectives["ru_forms"][a_i][ru_gender]

    # Spanish and Portuguese agree too, and the noun leads: RESTO SECO.
    es_adjective = adjectives["es_forms"][a_i][nouns["es_gender"][n_i]]
    pt_adjective = adjectives["pt_forms"][a_i][nouns["pt_gender"][n_i]]

    low, high = client["difficulty"]
    difficulty = min(high, low + act * (high - low) // max(ACTS - 1, 1))

    hook_i = rng.randrange(len(HOOKS["ru"]))
    years = rng.choice([2, 3, 4, 5, 6, 7, 9, 11])
    source_i = rng.randrange(len(client["evidence_sources"]["ru"]))

    case: dict = {
        "id": case_id,
        "client": client["slug"],
        "act": act + 1,
        "archetype": archetype,
        "difficulty": difficulty,
        "kind": kind,
        "fingerprint": fingerprint(mnemonic),
        "codename": {
            "ru": f"{russian_adjective} {nouns['ru'][n_i]}",
            "en": f"{adjectives['en'][a_i]} {nouns['en'][n_i]}",
            "es": f"{nouns['es'][n_i]} {es_adjective}",
            "pt": f"{nouns['pt'][n_i]} {pt_adjective}",
        },
        "requires": [case_id - 1] if act_index > 1 or act > 0 else [],
        "solution": {"archetype": archetype, "steps": steps},
    }

    for lang in LANGS:
        case.setdefault("brief", {})[lang] = [
            line.format(
                client=client["name"][lang],
                district=client["district"][lang],
                act=client["acts"][lang][act],
                act_index=act_index,
                hook=HOOKS[lang][hook_i].format(years=years),
            )
            for line in BRIEF[lang]
        ]
        case.setdefault("evidence", {})[lang] = [
            EXHIBIT[lang] + client["evidence_sources"][lang][source_i],
            client["dialect"][lang],
        ]
        case.setdefault("clues", {})[lang] = (
            [DIALECT_PRIMER[archetype][lang], ""] + [line[lang] for line in clue_lines]
        )
        case.setdefault("epilogue", {})[lang] = [
            line.format(payoff=client["payoff"][lang]) for line in EPILOGUE[lang]
        ]

    words = mnemonic.split()
    for lang in LANGS:
        joiner = WORDS[lang]
        case.setdefault("hints", {})[lang] = [
            DIALECT_PRIMER[archetype][lang],
            (f"{joiner} 1-6: " + ", ".join(words[:6])) if kind == "words"
            else ENTROPY_OPENER[lang] + steps[0]["hex"][:8],
            (f"{joiner} 7-12: " + ", ".join(words[6:])) if kind == "words"
            else ("ENTROPY " + steps[0]["hex"]),
        ]
    return case


def main() -> int:
    clients = json.loads((ROOT / "data" / "clients.json").read_text(encoding="utf-8"))
    cases: list[dict] = []
    case_id = FIRST_ID
    for client in clients["clients"]:
        deck = codename_deck(client)
        for slot in range(CASES_PER_CLIENT):
            cases.append(make_case(client, slot, case_id, deck))
            case_id += 1

    fingerprints = {case["fingerprint"] for case in cases}
    if len(fingerprints) != len(cases):
        raise SystemExit("fingerprint collision — two cases share an answer")
    names = {case["codename"]["ru"] for case in cases}
    if len(names) != len(cases):
        raise SystemExit(f"codename collision — {len(cases) - len(names)} duplicate(s)")

    out = ROOT / "data" / "contracts.json"
    out.write_text(
        json.dumps({"generated_by": "tools/generate_cases.py", "seed": MASTER_SEED,
                    "cases": cases}, ensure_ascii=False, indent=1) + "\n",
        encoding="utf-8",
    )
    by_archetype: dict[str, int] = {}
    for case in cases:
        by_archetype[case["archetype"]] = by_archetype.get(case["archetype"], 0) + 1
    print(f"{len(cases)} cases -> {out.relative_to(ROOT)}  ({out.stat().st_size / 1024:.0f} KB)")
    for name, count in sorted(by_archetype.items(), key=lambda kv: -kv[1]):
        print(f"  {name:<16} {count}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
