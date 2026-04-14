"""Unix socket daemon for real-time word classification.

Keeps frequency dictionaries in memory for O(1) lookup.
Communicates with zsh widget via /tmp/zlqhem.sock.
"""

import asyncio
import os
import signal
import sys
from pathlib import Path

from zlqhem.classify import classify_word, classify_text

SOCK_PATH = "/tmp/zlqhem.sock"
PID_PATH = "/tmp/zlqhem.pid"


def _write_pid():
    Path(PID_PATH).write_text(str(os.getpid()))


def _cleanup():
    for p in (SOCK_PATH, PID_PATH):
        try:
            os.unlink(p)
        except FileNotFoundError:
            pass


def _check_existing():
    """Check if another daemon is already running."""
    if Path(PID_PATH).exists():
        pid = int(Path(PID_PATH).read_text().strip())
        try:
            os.kill(pid, 0)  # Check if process exists
            return pid
        except OSError:
            _cleanup()  # Stale PID file
    return None


async def _handle_client(reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
    try:
        data = await asyncio.wait_for(reader.read(4096), timeout=1.0)
        if not data:
            writer.close()
            return
        text = data.decode("utf-8").strip()
        # If single word (no spaces), classify as word; otherwise as text
        if " " in text:
            result = classify_text(text)
        else:
            result = classify_word(text)
        writer.write(result.encode("utf-8"))
        await writer.drain()
    except (asyncio.TimeoutError, ConnectionError):
        pass
    finally:
        writer.close()
        await writer.wait_closed()


async def _warmup():
    """Pre-load dictionaries into memory."""
    from zlqhem.dict_en import get_freq
    from zlqhem.dict_kr import get_freq as get_kr
    get_freq()
    get_kr()


async def run_daemon():
    """Start the daemon. Blocks until interrupted."""
    existing = _check_existing()
    if existing:
        print(f"zlqhem daemon already running (PID {existing})", file=sys.stderr)
        sys.exit(1)

    _cleanup()

    # Warm up dictionaries
    await _warmup()

    server = await asyncio.start_unix_server(_handle_client, path=SOCK_PATH)
    os.chmod(SOCK_PATH, 0o600)
    _write_pid()

    print(f"zlqhem daemon listening on {SOCK_PATH} (PID {os.getpid()})")

    loop = asyncio.get_running_loop()
    stop = loop.create_future()

    def _signal_handler():
        if not stop.done():
            stop.set_result(None)

    for sig in (signal.SIGTERM, signal.SIGINT, signal.SIGHUP):
        loop.add_signal_handler(sig, _signal_handler)

    try:
        await stop
    finally:
        server.close()
        await server.wait_closed()
        _cleanup()
        print("zlqhem daemon stopped")


def start():
    """Entry point for `zlqhem daemon`."""
    asyncio.run(run_daemon())
