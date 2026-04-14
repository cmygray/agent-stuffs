"""Korean frequency dictionary loader."""

import math
from pathlib import Path

_DATA = Path(__file__).parent / "data" / "kr_50k.txt"

_freq: dict[str, float] | None = None


def _load() -> dict[str, float]:
    freq: dict[str, float] = {}
    with open(_DATA, encoding="utf-8") as f:
        for line in f:
            parts = line.rstrip().split(" ", 1)
            if len(parts) == 2:
                word, count = parts[0], int(parts[1])
                freq[word] = math.log1p(count)
    return freq


def get_freq() -> dict[str, float]:
    global _freq
    if _freq is None:
        _freq = _load()
    return _freq
