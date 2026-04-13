import atexit
import json
import platform
import subprocess
import sys
import tempfile
import threading
from pathlib import Path

CF_DIR = Path.home() / ".cloudflared"


def start_tunnel(port: int, hostname: str):
    """Start cloudflared tunnel and claim the hostname via DNS route."""
    tunnel_name = f"mdgate-{platform.node()}"

    # Ensure tunnel exists (create if needed)
    tunnel_id = _ensure_tunnel(tunnel_name)
    cred_file = CF_DIR / f"{tunnel_id}.json"

    # Write temporary cloudflared config
    config_dir = Path(tempfile.mkdtemp(prefix="mdgate-tunnel-"))
    config_file = config_dir / "config.yml"
    config_file.write_text("\n".join([
        f"tunnel: {tunnel_name}",
        f"credentials-file: {cred_file}",
        "ingress:",
        f"  - hostname: {hostname}",
        f"    service: http://localhost:{port}",
        "  - service: http_status:404",
        "",
    ]))

    # Claim hostname: update CNAME to point to this tunnel
    route = subprocess.run(
        ["cloudflared", "tunnel", "route", "dns", "--overwrite-dns", tunnel_name, hostname],
        capture_output=True, text=True,
    )
    if route.returncode != 0:
        print(f"  tunnel: DNS route failed: {route.stderr.strip()}", file=sys.stderr)
    else:
        print(f"  tunnel: {hostname} → {tunnel_name}")

    # Start tunnel
    try:
        proc = subprocess.Popen(
            ["cloudflared", "tunnel", "--config", str(config_file), "run", tunnel_name],
            stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        )
    except FileNotFoundError:
        print("  tunnel error: cloudflared not found in PATH", file=sys.stderr)
        return

    atexit.register(proc.kill)

    def _read_stderr():
        for line in proc.stderr:
            msg = line.decode(errors="replace").strip()
            if msg and "INF" not in msg:
                print(f"  tunnel: {msg}", file=sys.stderr)

    threading.Thread(target=_read_stderr, daemon=True).start()


def _ensure_tunnel(tunnel_name: str) -> str:
    """Return tunnel ID, creating the tunnel if it doesn't exist."""
    # Check if tunnel already exists
    result = subprocess.run(
        ["cloudflared", "tunnel", "info", "-o", "json", tunnel_name],
        capture_output=True, text=True,
    )
    if result.returncode == 0:
        return json.loads(result.stdout)["id"]

    # Create new tunnel
    result = subprocess.run(
        ["cloudflared", "tunnel", "create", tunnel_name],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        print(f"  tunnel: create failed: {result.stderr.strip()}", file=sys.stderr)
        sys.exit(1)

    # Re-fetch to get ID
    result = subprocess.run(
        ["cloudflared", "tunnel", "info", "-o", "json", tunnel_name],
        capture_output=True, text=True,
    )
    return json.loads(result.stdout)["id"]
