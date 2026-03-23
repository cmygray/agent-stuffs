import json
from pathlib import Path

CONFIG_DIR = Path.home() / ".mdgate"
CONFIG_FILE = CONFIG_DIR / "config.json"

DEFAULTS = {"port": 9483, "hosts": []}


def load_config() -> dict:
    try:
        raw = json.loads(CONFIG_FILE.read_text())
        return {**DEFAULTS, **raw}
    except Exception:
        return {**DEFAULTS}


def init_config(hosts: list[str]) -> dict:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    config = {**DEFAULTS, "hosts": hosts}
    CONFIG_FILE.write_text(json.dumps(config, indent=2) + "\n")
    print(f"Config written to {CONFIG_FILE}")
    return config
