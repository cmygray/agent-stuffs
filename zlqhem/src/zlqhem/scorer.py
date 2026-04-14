"""Frequency-based scoring engine for Korean/English word classification.

Three-gate pipeline:
1. Structural gate: passthrough for non-alpha tokens
2. Syllable ratio gate: reject Korean if < 50% complete syllables
3. Frequency comparison: dictionary lookup with modifiers
"""

import unicodedata

from zlqhem.convert import qwerty_to_hangul
from zlqhem.dict_en import get_freq as en_freq
from zlqhem.dict_kr import get_freq as kr_freq


def _is_hangul_syllable(ch: str) -> bool:
    """Check if a character is a composed Hangul syllable (가-힣)."""
    return 0xAC00 <= ord(ch) <= 0xD7A3


def _is_hangul_jamo(ch: str) -> bool:
    """Check if a character is an uncomposed Hangul jamo (ㄱ-ㅣ)."""
    return 0x3131 <= ord(ch) <= 0x3163


def syllable_ratio(text: str) -> float:
    """Ratio of composed syllable blocks to total Hangul characters.

    Returns 0.0 if no Hangul characters at all.
    """
    syllables = sum(1 for ch in text if _is_hangul_syllable(ch))
    jamo = sum(1 for ch in text if _is_hangul_jamo(ch))
    total = syllables + jamo
    if total == 0:
        return 0.0
    return syllables / total


def score(word: str) -> tuple[str, float, str]:
    """Classify a single word as English or Korean.

    Returns (output_text, confidence, language_tag).
    - language_tag: "en", "kr", or "pass"
    - confidence: absolute score difference (higher = more confident)
    """
    # Gate 1: structural passthrough
    if not word or not any(ch.isalpha() for ch in word):
        return word, 1.0, "pass"

    # Gate 1b: if word contains non-alpha (path, url-like), passthrough
    if any(ch in word for ch in "/._-@#$%&*+=~`<>{}[]|\\:;!?"):
        return word, 1.0, "pass"

    # No uppercase bonus — all uppercase letters map to Korean jamo
    # (R=ㄲ, E=ㄸ, Q=ㅃ, T=ㅆ, W=ㅉ, etc.), so uppercase is not
    # a reliable English signal. Dictionary frequency handles it.
    upper_bonus = 0.0

    # Convert to Korean candidate (preserve original case for shift-jamo like R=ㄲ, T=ㅆ)
    kr_candidate = qwerty_to_hangul(word)
    ratio = syllable_ratio(kr_candidate)

    # Gate 2: syllable ratio — if conversion produces mostly jamo, it's English
    if ratio < 0.5:
        return word, 1.0, "en"

    # Gate 3: frequency comparison
    en = en_freq()
    kr = kr_freq()

    en_score = en.get(word.lower(), 0.0) + upper_bonus
    kr_score = kr.get(kr_candidate, 0.0)

    # Compression penalty: if Korean is much shorter, it's likely coincidental
    if len(kr_candidate) > 0 and len(word) > 0:
        compression = 1.0 - len(kr_candidate) / len(word)
        if compression > 0.6:
            kr_score -= 2.0

    # Length ratio bonus: Korean typed on QWERTY is typically 2-3x longer
    if len(kr_candidate) > 0 and len(word) / len(kr_candidate) >= 2.0:
        kr_score += 1.0

    # Decision
    en_found = en_score > 0
    kr_found = kr_score > 0

    if en_found and not kr_found:
        return word, en_score, "en"
    if kr_found and not en_found:
        return kr_candidate, kr_score, "kr"
    if en_found and kr_found:
        if kr_score > en_score:
            return kr_candidate, kr_score - en_score, "kr"
        return word, en_score - kr_score, "en"

    # Neither in dictionary: fall back to syllable ratio heuristic
    if ratio >= 0.8:
        return kr_candidate, 0.5, "kr"
    return word, 0.5, "en"
