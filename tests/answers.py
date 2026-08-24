"""SPOILERS. The answer key, kept here so the test suite has ground truth.

The eight solutions are published BIP-39 test vectors; `data/cases.json` stores
only their SHA-256 fingerprints so the shipped game does not hand out answers.
"""

SOLUTIONS = {
    1: "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
    2: "legal winner thank year wave sausage worth useful legal winner thank yellow",
    3: "letter advice cage absurd amount doctor acoustic avoid letter advice cage above",
    4: "zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong",
    5: "ozone drill grab fiber curtain grace pudding thank cruise elder eight picnic",
    6: "cat swing flag economy stadium alone churn speed unique patch report train",
    7: "vessel ladder alter error federal sibling chat ability sun glass valve picture",
    8: "scheme spot photo card baby mountain device kick cradle pact join borrow",
}

#: Legacy (BIP-44) addresses, the ones SYNC_LEDGER queries by default.
LEGACY_ADDRESSES = {
    1: "1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA",
    2: "1EBuf21icKTE5m3HWVndKx2bTxvqrWCqV6",
    3: "1McjtxpqQQYR59v2cDp5HtjgbjrAr7Wmub",
    4: "1EjnS13zBgN6tUgy6U64qFeh53fyAeUsqE",
    5: "1H8vEx2NFVLXJCft86A5BPMrmPjQ3DQZb7",
    6: "1PpJDjhMCChYbnonB1Ri3cC4PAiU2Ss6xC",
    7: "18Lbc57tBH7tG87jC3bVQXWdjXXHukwdv5",
    8: "18aLaNnNeNgtRY7y2PQch8JEFyoy9aZyf9",
}

#: A checksum-valid mnemonic that belongs to no case — used to test the
#: "valid seed, wrong wallet" branch. Entropy 0102030405060708090a0b0c0d0e0f10.
UNRELATED_MNEMONIC = (
    "absurd avoid scissors anxiety gather lottery category door army half long camera"
)
