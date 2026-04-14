"""Tests for QWERTY→Hangul conversion, verified against inko-py."""

from zlqhem.convert import qwerty_to_hangul


class TestBasicConversion:
    def test_simple_words(self):
        assert qwerty_to_hangul("gksrmf") == "한글"
        assert qwerty_to_hangul("dkssud") == "안녕"
        assert qwerty_to_hangul("gktpdy") == "하세요"
        assert qwerty_to_hangul("dkssudgktpdy") == "안녕하세요"

    def test_sentence(self):
        assert qwerty_to_hangul("wjawlswjr") == "점진적"
        assert qwerty_to_hangul("ghkrwkd") == "확장"
        assert qwerty_to_hangul("tkfkd") == "사랑"

    def test_single_jamo(self):
        assert qwerty_to_hangul("r") == "ㄱ"
        assert qwerty_to_hangul("k") == "ㅏ"

    def test_compound_consonant(self):
        assert qwerty_to_hangul("dksgdk") == "않아"  # ㅇ+ㅏ+ㄴ+ㅎ+ㅇ+ㅏ
        assert qwerty_to_hangul("tkfaql") == "삶비"  # ㅅ+ㅏ+ㄹ+ㅁ+ㅂ+ㅣ

    def test_compound_vowel(self):
        # ㅘ = ㅗ+ㅏ
        assert qwerty_to_hangul("dhk") == "와"
        # ㅝ = ㅜ+ㅓ
        assert qwerty_to_hangul("dnj") == "워"
        # ㅢ = ㅡ+ㅣ
        assert qwerty_to_hangul("dml") == "의"

    def test_tense_consonants(self):
        # ㄲ = R, ㄸ = E, ㅃ = Q, ㅆ = T, ㅉ = W
        assert qwerty_to_hangul("Rkfl") == "까리"  # might be different, verify


class TestPassthrough:
    def test_numbers(self):
        assert qwerty_to_hangul("123") == "123"

    def test_punctuation(self):
        assert qwerty_to_hangul("!@#") == "!@#"

    def test_spaces(self):
        assert qwerty_to_hangul("dkssud gktpdy") == "안녕 하세요"

    def test_mixed_with_numbers(self):
        # "hello" keys all map to jamo, so they convert to Korean
        assert qwerty_to_hangul("hello123") == "ㅗ디ㅣㅐ123"
        # abc = ㅁ+ㅠ+ㅊ → 뮻 (composed)
        assert qwerty_to_hangul("123abc") == "123뮻"

    def test_empty(self):
        assert qwerty_to_hangul("") == ""


class TestInkoParity:
    """Verify parity with inko-py for known test cases."""

    def test_parity(self):
        try:
            from inko import Inko
        except ImportError:
            import pytest
            pytest.skip("inko-py not installed")

        inko = Inko()
        test_cases = [
            "gksrmf",
            "dkssudgktpdy",
            "wjawlswjr ghkrwkd",
            "tkfkd",
            "dhk",
            "dnj",
            "dml",
            "rkskekfk",
            "answkdgkwl",
        ]
        for case in test_cases:
            assert qwerty_to_hangul(case) == inko.en2ko(case), f"Mismatch for {case!r}"
