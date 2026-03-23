import atexit
import json
import re
import subprocess
import sys


def start_zrok(port: int, name: str | None = None):
    args = ["zrok", "share", "public", f"http://localhost:{port}", "--headless"]
    if name:
        args.extend(["--unique-name", name])

    try:
        proc = subprocess.Popen(args, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    except FileNotFoundError:
        print("  zrok error: zrok not found in PATH", file=sys.stderr)
        return

    atexit.register(proc.kill)

    import threading

    def _read_stdout():
        started = False
        for line in proc.stdout:
            text = line.decode(errors="replace").strip()
            if not started:
                try:
                    info = json.loads(text)
                    endpoints = info.get("frontend_endpoints")
                    if endpoints:
                        print(f"\n  zrok:       {endpoints[0]}")
                        started = True
                        continue
                except (json.JSONDecodeError, KeyError):
                    pass
                m = re.search(r"https?://\S+\.zrok\.\S+", text)
                if m:
                    print(f"\n  zrok:       {m.group(0)}")
                    started = True

    def _read_stderr():
        for line in proc.stderr:
            msg = line.decode(errors="replace").strip()
            if msg:
                print(f"  zrok:       {msg}", file=sys.stderr)

    threading.Thread(target=_read_stdout, daemon=True).start()
    threading.Thread(target=_read_stderr, daemon=True).start()
