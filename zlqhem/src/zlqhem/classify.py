"""Pipeline orchestrator: classify each word in a text as English or Korean."""

from zlqhem.scorer import score


def classify_text(text: str) -> str:
    """Classify and convert each whitespace-delimited token."""
    tokens = text.split(" ")
    return " ".join(score(token)[0] for token in tokens)


def classify_word(word: str) -> str:
    """Classify and convert a single word."""
    return score(word)[0]
