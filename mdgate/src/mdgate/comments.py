import json
import time
import random
import string
from datetime import datetime, timezone
from pathlib import Path


def _comments_path(md_abs_path: str) -> Path:
    return Path(md_abs_path + ".comments.json")


def _make_id() -> str:
    t = int(time.time() * 1000)
    rand = "".join(random.choices(string.ascii_lowercase + string.digits, k=4))
    return f"{t:x}{rand}"


def load_comments(md_abs_path: str) -> list[dict]:
    try:
        return json.loads(_comments_path(md_abs_path).read_text())
    except Exception:
        return []


def add_comment(md_abs_path: str, section: str, text: str) -> dict:
    comments = load_comments(md_abs_path)
    entry = {
        "id": _make_id(),
        "section": section,
        "text": text,
        "ts": datetime.now(timezone.utc).isoformat(),
    }
    comments.append(entry)
    _comments_path(md_abs_path).write_text(json.dumps(comments, indent=2) + "\n")
    return entry


def update_comment(md_abs_path: str, comment_id: str, new_text: str) -> dict | None:
    comments = load_comments(md_abs_path)
    comment = next((c for c in comments if c["id"] == comment_id), None)
    if not comment:
        return None
    comment["text"] = new_text
    comment["editedAt"] = datetime.now(timezone.utc).isoformat()
    _comments_path(md_abs_path).write_text(json.dumps(comments, indent=2) + "\n")
    return comment


def clear_comments(md_abs_path: str):
    _comments_path(md_abs_path).write_text("[]\n")


def resolve_comment(md_abs_path: str, comment_id: str) -> dict | None:
    comments = load_comments(md_abs_path)
    comment = next((c for c in comments if c["id"] == comment_id), None)
    if not comment:
        return None
    comment["resolved"] = True
    comment["resolvedAt"] = datetime.now(timezone.utc).isoformat()
    _comments_path(md_abs_path).write_text(json.dumps(comments, indent=2) + "\n")
    return comment


def delete_comment(md_abs_path: str, comment_id: str) -> bool:
    comments = load_comments(md_abs_path)
    filtered = [c for c in comments if c["id"] != comment_id]
    if len(filtered) == len(comments):
        return False
    _comments_path(md_abs_path).write_text(json.dumps(filtered, indent=2) + "\n")
    return True
