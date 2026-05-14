import json
from datetime import datetime, timezone
from pathlib import Path


def _interactions_path(abs_path: str) -> Path:
    return Path(abs_path + ".interactions.jsonl")


def append_interaction(abs_path: str, kind: str, payload) -> dict:
    entry = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "kind": kind,
        "payload": payload,
    }
    p = _interactions_path(abs_path)
    with p.open("a") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    return entry


def read_interactions(abs_path: str, since: str | None = None) -> list[dict]:
    p = _interactions_path(abs_path)
    if not p.exists():
        return []
    out = []
    for line in p.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            entry = json.loads(line)
        except Exception:
            continue
        if since and entry.get("ts", "") <= since:
            continue
        out.append(entry)
    return out
