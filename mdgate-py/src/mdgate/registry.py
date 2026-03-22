import json
from datetime import datetime, timezone
from pathlib import Path

STATE_DIR = Path.home() / ".mdgate"
REGISTRY_FILE = STATE_DIR / "registry.json"


def load_registry() -> list[dict]:
    try:
        return json.loads(REGISTRY_FILE.read_text())
    except Exception:
        return []


def save_registry(entries: list[dict]):
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    REGISTRY_FILE.write_text(json.dumps(entries, indent=2) + "\n")


def _make_slug(file_path: str) -> str:
    p = Path(file_path)
    parent = p.parent.name
    name = p.stem
    return f"{parent}/{name}"


def add_entry(file_path: str, base_dir: str) -> str:
    entries = load_registry()
    abs_path = str(Path(file_path).resolve())

    existing = next((e for e in entries if e["filePath"] == abs_path), None)
    if existing:
        return existing["slug"]

    base = _make_slug(abs_path)
    slug = base
    i = 2
    while any(e["slug"] == slug for e in entries):
        slug = f"{base}-{i}"
        i += 1

    entries.append({
        "slug": slug,
        "filePath": abs_path,
        "baseDir": str(Path(base_dir).resolve()),
        "entryFile": Path(file_path).name,
        "registeredAt": datetime.now(timezone.utc).isoformat(),
    })
    save_registry(entries)
    return slug


def remove_entry(slug: str) -> bool:
    entries = load_registry()
    filtered = [e for e in entries if e["slug"] != slug]
    if len(filtered) == len(entries):
        return False
    save_registry(filtered)
    return True
