"""QWERTY → Hangul transliteration engine.

Converts English key sequences into composed Hangul syllable blocks
using a state-machine approach. Reimplemented from inko's FSM logic
with no external dependencies.
"""

# QWERTY key → jamo mapping (lower 26 + upper 26 = 52 entries)
_EN = "rRseEfaqQtTdwWczxvgASDFGZXCVkoiOjpuPhynbmlYUIHJKLBNM"
_KR = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎㅁㄴㅇㄹㅎㅋㅌㅊㅍㅏㅐㅑㅒㅓㅔㅕㅖㅗㅛㅜㅠㅡㅣㅛㅕㅑㅗㅓㅏㅣㅠㅜㅡ"

_KEY_TO_IDX: dict[str, int] = {_EN[i]: i for i in range(len(_EN))}
_IDX_TO_JAMO: dict[int, str] = {i: _KR[i] for i in range(len(_KR))}

_CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ"
_JUNG = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ"
_JONG = "ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ"

_FIRST_VOWEL_IDX = 28  # index threshold: >= this means vowel in _KR

_COMPOUND_CONSONANT = {
    "ㄱㅅ": "ㄳ", "ㄴㅈ": "ㄵ", "ㄴㅎ": "ㄶ",
    "ㄹㄱ": "ㄺ", "ㄹㅁ": "ㄻ", "ㄹㅂ": "ㄼ", "ㄹㅅ": "ㄽ",
    "ㄹㅌ": "ㄾ", "ㄹㅍ": "ㄿ", "ㄹㅎ": "ㅀ", "ㅂㅅ": "ㅄ",
}

_COMPOUND_VOWEL = {
    "ㅗㅏ": "ㅘ", "ㅗㅐ": "ㅙ", "ㅗㅣ": "ㅚ",
    "ㅜㅓ": "ㅝ", "ㅜㅔ": "ㅞ", "ㅜㅣ": "ㅟ", "ㅡㅣ": "ㅢ",
}

# Tense consonants that cannot start a compound jongseong
_TENSE = "ㄸㅃㅉ"


def _is_vowel_idx(idx: int) -> bool:
    return idx >= _FIRST_VOWEL_IDX


def _is_vowel(ch: str) -> bool:
    for i, c in _IDX_TO_JAMO.items():
        if c == ch:
            return _is_vowel_idx(i)
    return False


def _combine(indices: list[int]) -> str:
    """Combine a list of jamo indices into a single Hangul syllable or jamo string."""
    # Group consecutive same-type jamo (consonant vs vowel)
    groups: list[list[str]] = []
    for idx in indices:
        ch = _IDX_TO_JAMO[idx]
        if not groups or _is_vowel(groups[-1][0]) != _is_vowel(ch):
            groups.append([])
        groups[-1].append(ch)

    # Try compound jamo within each group
    def connect(group: list[str]) -> str:
        pair = "".join(group)
        return _COMPOUND_CONSONANT.get(pair) or _COMPOUND_VOWEL.get(pair) or pair

    connected = [connect(g) for g in groups]

    if len(connected) == 1:
        return connected[0]

    # Map to cho/jung/jong indices and compose
    cho_idx = _CHO.index(connected[0]) if connected[0] in _CHO else -1
    jung_idx = _JUNG.index(connected[1]) if len(connected) > 1 and connected[1] in _JUNG else -1
    jong_idx = _JONG.index(connected[2]) if len(connected) > 2 and connected[2] in _JONG else -1

    if cho_idx >= 0 and jung_idx >= 0:
        return chr(0xAC00 + cho_idx * 588 + jung_idx * 28 + jong_idx + 1)

    # Fallback: return concatenated jamo
    return "".join(connected)


# State machine transitions
# States: 0=empty, 1=자, 2=모, 3=자자, 4=자모, 5=모모, 6=자모자, 7=자모모, 8=자모자자, 9=자모모자, 10=자모모자자
# Transition inputs: 0=connectable consonant, 1=non-connectable consonant, 2=connectable vowel, 3=non-connectable vowel
_STATE_LENGTH = [0, 1, 1, 2, 2, 2, 3, 3, 4, 4, 5]
_TRANSITIONS = [
    [1, 1, 2, 2],   # 0: empty
    [3, 1, 4, 4],   # 1: 자
    [1, 1, 5, 2],   # 2: 모
    [3, 1, 4, -1],  # 3: 자자
    [6, 1, 7, 2],   # 4: 자모
    [1, 1, 2, 2],   # 5: 모모
    [9, 1, 4, 4],   # 6: 자모자
    [9, 1, 2, 2],   # 7: 자모모
    [1, 1, 4, 4],   # 8: 자모자자
    [10, 1, 4, 4],  # 9: 자모모자
    [1, 1, 4, 4],   # 10: 자모모자자
]


def qwerty_to_hangul(text: str) -> str:
    """Convert a QWERTY key sequence to composed Hangul.

    Characters not in the QWERTY→jamo mapping are passed through unchanged.

    >>> qwerty_to_hangul("gksrmf")
    '한글'
    >>> qwerty_to_hangul("dkssudgktpdy")
    '안녕하세요'
    """
    result: list[str] = []
    buf: list[int] = []
    state = 0
    last_idx = -1

    def flush():
        nonlocal buf
        if buf:
            result.append(_combine(buf))
            buf = []

    for ch in text:
        if ch not in _KEY_TO_IDX:
            state = 0
            last_idx = -1
            flush()
            result.append(ch)
            continue

        curr_idx = _KEY_TO_IDX[ch]
        curr_jamo = _IDX_TO_JAMO[curr_idx]
        curr_is_vowel = _is_vowel_idx(curr_idx)

        # Determine transition type
        if last_idx >= 0:
            last_jamo = _IDX_TO_JAMO[last_idx]
            last_is_vowel = _is_vowel_idx(last_idx)
            pair = last_jamo + curr_jamo

            if not curr_is_vowel:
                if last_is_vowel:
                    tr = 0 if curr_jamo not in _TENSE else 1
                elif state == 1:
                    tr = 1
                else:
                    tr = 0 if pair in _COMPOUND_CONSONANT else 1
            elif last_is_vowel:
                tr = 2 if pair in _COMPOUND_VOWEL else 3
            else:
                tr = 2
        else:
            tr = 2 if curr_is_vowel else 0

        next_state = _TRANSITIONS[state][tr]
        buf.append(curr_idx)

        # Flush completed syllables
        diff = len(buf) - _STATE_LENGTH[next_state]
        if diff > 0:
            result.append(_combine(buf[:diff]))
            buf = buf[diff:]

        state = next_state
        last_idx = curr_idx

    flush()
    return "".join(result)
