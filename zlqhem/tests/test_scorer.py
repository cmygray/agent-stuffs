"""Tests for the scoring engine."""

from zlqhem.scorer import score, syllable_ratio


class TestSyllableRatio:
    def test_full_syllables(self):
        assert syllable_ratio("한글") == 1.0

    def test_only_jamo(self):
        assert syllable_ratio("ㅎㅏㄴ") == 0.0

    def test_mixed(self):
        # 1 syllable + 1 jamo = 0.5
        assert syllable_ratio("가ㄱ") == 0.5

    def test_no_hangul(self):
        assert syllable_ratio("hello") == 0.0


class TestScoreClassification:
    """Test that the scorer correctly classifies words."""

    def test_obvious_korean(self):
        # gksrmf → 한글, not in English dictionary
        text, _, lang = score("gksrmf")
        assert lang == "kr"
        assert text == "한글"

    def test_obvious_english(self):
        text, _, lang = score("project")
        assert lang == "en"
        assert text == "project"

    def test_english_go(self):
        # "go" is a very common English word, should not convert to Korean
        text, _, lang = score("go")
        assert lang == "en"
        assert text == "go"

    def test_english_git(self):
        text, _, lang = score("git")
        assert lang == "en"

    def test_english_dir(self):
        text, _, lang = score("dir")
        assert lang == "en"

    def test_uppercase_english(self):
        text, _, lang = score("Python")
        assert lang == "en"
        assert text == "Python"

    def test_passthrough_numbers(self):
        text, _, lang = score("123")
        assert lang == "pass"

    def test_passthrough_path(self):
        text, _, lang = score("./src/main.py")
        assert lang == "pass"

    def test_passthrough_empty(self):
        text, _, lang = score("")
        assert lang == "pass"

    def test_korean_sentence_words(self):
        text, _, lang = score("wjawlswjr")
        assert lang == "kr"
        assert text == "점진적"

    def test_korean_dkssud(self):
        text, _, lang = score("dkssud")
        assert lang == "kr"
        assert text == "안녕"
