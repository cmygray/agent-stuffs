"""English frequency dictionary loader."""

import math
from pathlib import Path

_DATA = Path(__file__).parent / "data" / "en_50k.txt"

# Common dev/CLI terms that must be recognized as English
_TECH_TERMS = {
    "git", "npm", "ssh", "api", "sql", "css", "url", "cli", "vim", "pip",
    "dev", "log", "bug", "fix", "run", "cmd", "env", "dir", "bin", "lib",
    "src", "doc", "def", "nil", "hub", "pod", "map", "set", "get", "put",
    "del", "zip", "tar", "sed", "awk", "cat", "pid", "tcp", "http", "json",
    "yaml", "toml", "async", "await", "sudo", "chmod", "grep", "curl",
    "bash", "zsh", "node", "rust", "java", "ruby", "perl", "lua",
    "docker", "nginx", "redis", "kafka", "flask", "django", "react", "vue",
    "cd", "ls", "mv", "cp", "rm", "pwd", "man", "apt", "yum", "brew",
}

_freq: dict[str, float] | None = None


def _load() -> dict[str, float]:
    freq: dict[str, float] = {}
    with open(_DATA, encoding="utf-8") as f:
        for line in f:
            parts = line.rstrip().split(" ", 1)
            if len(parts) == 2:
                word, count = parts[0].lower(), int(parts[1])
                freq[word] = math.log1p(count)
    # Ensure tech terms have a minimum score
    tech_score = math.log1p(100_000)
    for term in _TECH_TERMS:
        if term not in freq or freq[term] < tech_score:
            freq[term] = tech_score
    return freq


def get_freq() -> dict[str, float]:
    global _freq
    if _freq is None:
        _freq = _load()
    return _freq
