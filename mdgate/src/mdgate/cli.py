from __future__ import annotations

import json
import os
import signal
import sys
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import URLError

from .config import load_config, init_config


def main():
    args = sys.argv[1:]
    config = load_config()

    if not args or "--help" in args or "-h" in args:
        _cmd_help(config)
        return

    if "--init" in args:
        _cmd_init(args)
        return

    if "--stop" in args:
        _cmd_stop()
        return

    if "--status" in args:
        _cmd_status()
        return

    if "--setup-claude" in args:
        _cmd_setup_claude()
        return

    is_review = args[0] == "review"
    is_daemon = "--daemon" in args
    effective_args = args[1:] if is_review else args

    port = config["port"]
    file_path = None
    share_name = None
    share_enabled = False

    i = 0
    while i < len(effective_args):
        arg = effective_args[i]
        if arg in ("-p", "--port") and i + 1 < len(effective_args):
            port = int(effective_args[i + 1])
            i += 2
            continue
        elif arg == "--share":
            share_enabled = True
        elif arg.startswith("--share="):
            share_enabled = True
            share_name = arg.removeprefix("--share=")
        elif not arg.startswith("-"):
            file_path = str(Path(arg).resolve())
        i += 1

    if is_daemon:
        from .server import start_server
        start_server(None, port, config["hosts"], daemon=True)
        if share_enabled:
            from .zrok import start_zrok
            start_zrok(port, share_name)
    elif not file_path:
        print("Error: No markdown file specified", file=sys.stderr)
        sys.exit(1)
    elif not Path(file_path).exists():
        print(f"Error: File not found: {file_path}", file=sys.stderr)
        sys.exit(1)
    elif is_review:
        if _is_server_running(port):
            comments = _review_via_running_server(file_path, port, config["hosts"])
        else:
            from .server import start_server
            comments = start_server(file_path, port, config["hosts"], review_mode=True)
        print(json.dumps(comments, indent=2))
        sys.exit(0)
    else:
        _cmd_serve(file_path, port, config["hosts"], share_enabled, share_name)


def _cmd_serve(file_path: str, port: int, hosts: list[str], share_enabled: bool, share_name: str | None):
    if _is_server_running(port):
        slug = _register_with_running_server(file_path, port)
        print(f"Registered: http://localhost:{port}/{slug}/")
        for h in hosts:
            print(f"            http://{h}:{port}/{slug}/")
    else:
        from .server import start_server
        if share_enabled:
            from .zrok import start_zrok
            start_zrok(port, share_name)
        start_server(file_path, port, hosts)


def _is_server_running(port: int) -> bool:
    try:
        req = Request(f"http://127.0.0.1:{port}/health")
        with urlopen(req, timeout=2) as resp:
            data = json.loads(resp.read())
            return data.get("status") == "ok"
    except Exception:
        return False


def _register_with_running_server(file_path: str, port: int) -> str:
    abs_file = str(Path(file_path).resolve())
    base_dir = str(Path(abs_file).parent)
    body = json.dumps({"filePath": abs_file, "baseDir": base_dir}).encode()
    req = Request(f"http://127.0.0.1:{port}/_api/register", data=body,
                  headers={"Content-Type": "application/json"}, method="POST")
    with urlopen(req, timeout=5) as resp:
        data = json.loads(resp.read())
        return data["slug"]


def _review_via_running_server(file_path: str, port: int, hosts: list[str]) -> list:
    import time
    slug = _register_with_running_server(file_path, port)
    body = json.dumps({"slug": slug}).encode()
    req = Request(f"http://127.0.0.1:{port}/_api/start-review", data=body,
                  headers={"Content-Type": "application/json"}, method="POST")
    urlopen(req, timeout=5)

    print(f"mdgate serving: {file_path}", file=sys.stderr)
    print(f"  Slug:       {slug}", file=sys.stderr)
    print(f"  Local:      http://localhost:{port}/{slug}/", file=sys.stderr)
    for h in hosts:
        print(f"  Tailscale:  http://{h}:{port}/{slug}/", file=sys.stderr)
    print(f"\nWaiting for review submission...", file=sys.stderr)

    while True:
        time.sleep(1)
        try:
            poll_req = Request(f"http://127.0.0.1:{port}/_api/poll-review?slug={slug}")
            with urlopen(poll_req, timeout=5) as resp:
                data = json.loads(resp.read())
                if data.get("submitted"):
                    return data["comments"]
        except Exception:
            pass


def _cmd_help(config: dict):
    print(f"""mdgate — Serve markdown files as mobile-friendly web pages

Usage:
  mdgate <file.md>                  Register and serve a markdown file
  mdgate review <file.md>           Serve for review, block until submitted
  mdgate --daemon                   Start server without a document (background mode)
  mdgate --init <host1> [host2...]  Set Tailscale hostnames
  mdgate --stop                     Stop the running server
  mdgate --status                   Check server status
  mdgate --setup-claude             Install Claude Code review skill

Options:
  -p, --port <port>        Port to listen on (default: {config['port']})
  --share[=name]           Expose via zrok (optional fixed name)
  -h, --help               Show this help

Documents persist across server restarts.
Remove documents from the web dashboard at http://localhost:{config['port']}/

Config: ~/.mdgate/config.json""")


def _cmd_init(args: list[str]):
    idx = args.index("--init")
    hosts = [a for a in args[idx + 1:] if not a.startswith("-")]
    if not hosts:
        print("Usage: mdgate --init <host1> [host2...]", file=sys.stderr)
        sys.exit(1)
    init_config(hosts)


def _cmd_stop():
    pid_file = Path.home() / ".mdgate" / "server.pid"
    if pid_file.exists():
        pid = int(pid_file.read_text().strip())
        try:
            os.kill(pid, signal.SIGTERM)
            pid_file.unlink(missing_ok=True)
            print(f"Stopped mdgate server (pid {pid})")
        except ProcessLookupError:
            pid_file.unlink(missing_ok=True)
            print("Server was not running (stale pid file removed)")
    else:
        print("No mdgate server is running")


def _cmd_setup_claude():
    import importlib.resources
    source = importlib.resources.files("mdgate").joinpath("skill_review.md")
    dest = Path.home() / ".claude" / "commands" / "mdgate-review.md"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(source.read_text(encoding="utf-8"), encoding="utf-8")
    print(f"Installed: {dest}")
    print("Usage: /mdgate-review <file.md>")


def _cmd_status():
    pid_file = Path.home() / ".mdgate" / "server.pid"
    if pid_file.exists():
        pid = int(pid_file.read_text().strip())
        try:
            os.kill(pid, 0)
            print(f"mdgate server is running (pid {pid})")
        except ProcessLookupError:
            print("mdgate server is not running (stale pid file)")
    else:
        print("No mdgate server is running")
