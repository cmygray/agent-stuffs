"""Tests for the classification pipeline."""

from zlqhem.classify import classify_text, classify_word


class TestClassifyText:
    def test_mixed_sentence(self):
        result = classify_text("gksrmf project wjawlswjr ghkrwkd")
        assert result == "한글 project 점진적 확장"

    def test_pure_english(self):
        result = classify_text("hello world")
        assert result == "hello world"

    def test_pure_korean(self):
        result = classify_text("dkssud gktpdy")
        assert result == "안녕 하세요"

    def test_with_numbers(self):
        result = classify_text("123 gksrmf 456")
        assert result == "123 한글 456"

    def test_empty(self):
        assert classify_text("") == ""

    def test_preserves_spaces(self):
        # Multiple tokens separated by single spaces
        result = classify_text("git gksrmf commit")
        assert result == "git 한글 commit"


class TestClassifyWord:
    def test_korean(self):
        assert classify_word("gksrmf") == "한글"

    def test_english(self):
        assert classify_word("project") == "project"

    def test_passthrough(self):
        assert classify_word("123") == "123"
