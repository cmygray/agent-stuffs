"""PTY proxy for wrapping terminal programs with bilingual input.

Sits between the user's terminal and a child process (e.g. claude),
intercepting space keystrokes to convert the last typed word.

Usage: zlqhem wrap -- claude
"""

import os
import pty
import select
import signal
import struct
import sys
import termios
import tty
import fcntl

from zlqhem.classify import classify_word

# Toggle key: Ctrl+] (0x1d)
TOGGLE_KEY = b"\x1d"


def _get_terminal_size():
    try:
        cols, rows = os.get_terminal_size()
        return rows, cols
    except OSError:
        return 24, 80


def _set_winsize(fd, rows, cols):
    winsize = struct.pack("HHHH", rows, cols, 0, 0)
    fcntl.ioctl(fd, termios.TIOCSWINSZ, winsize)


def run_proxy(argv: list[str]):
    """Spawn a child process in a pty and proxy I/O with word conversion."""
    if not argv:
        print("Usage: zlqhem wrap -- <command> [args...]", file=sys.stderr)
        sys.exit(1)

    # Pre-load dictionaries before forking
    from zlqhem.dict_en import get_freq
    from zlqhem.dict_kr import get_freq as get_kr
    get_freq()
    get_kr()

    # Save original terminal settings
    old_attrs = termios.tcgetattr(sys.stdin.fileno())

    # Open a new pty
    master_fd, slave_fd = pty.openpty()

    # Set child pty size to match current terminal
    rows, cols = _get_terminal_size()
    _set_winsize(slave_fd, rows, cols)

    pid = os.fork()
    if pid == 0:
        # ── Child process ──
        os.close(master_fd)
        os.setsid()
        fcntl.ioctl(slave_fd, termios.TIOCSCTTY, 0)
        os.dup2(slave_fd, 0)
        os.dup2(slave_fd, 1)
        os.dup2(slave_fd, 2)
        os.close(slave_fd)
        os.execvp(argv[0], argv)
    else:
        # ── Parent process (proxy) ──
        os.close(slave_fd)

        # Forward SIGWINCH to child
        def _handle_winch(signum, frame):
            rows, cols = _get_terminal_size()
            _set_winsize(master_fd, rows, cols)
            os.kill(pid, signal.SIGWINCH)

        signal.signal(signal.SIGWINCH, _handle_winch)

        # Put terminal in raw mode
        tty.setraw(sys.stdin.fileno())

        active = False
        word_buf = bytearray()  # Buffer for current word being typed

        try:
            _proxy_loop(master_fd, pid, active, word_buf)
        finally:
            termios.tcsetattr(sys.stdin.fileno(), termios.TCSADRAIN, old_attrs)
            os.close(master_fd)


def _proxy_loop(master_fd: int, child_pid: int, active: bool, word_buf: bytearray):
    stdin_fd = sys.stdin.fileno()
    stdout_fd = sys.stdout.fileno()

    while True:
        try:
            rlist, _, _ = select.select([stdin_fd, master_fd], [], [], 0.1)
        except (select.error, OSError):
            break

        # Check if child is still alive
        try:
            wpid, status = os.waitpid(child_pid, os.WNOHANG)
            if wpid != 0:
                break
        except ChildProcessError:
            break

        if stdin_fd in rlist:
            data = os.read(stdin_fd, 1024)
            if not data:
                break

            active, word_buf = _handle_input(
                data, master_fd, stdout_fd, active, word_buf
            )

        if master_fd in rlist:
            try:
                data = os.read(master_fd, 4096)
                if not data:
                    break
                os.write(stdout_fd, data)
            except OSError:
                break


def _handle_input(
    data: bytes,
    master_fd: int,
    stdout_fd: int,
    active: bool,
    word_buf: bytearray,
) -> tuple[bool, bytearray]:
    """Process input bytes, applying conversion when active."""

    for i in range(len(data)):
        byte = data[i : i + 1]

        # Toggle check
        if byte == TOGGLE_KEY:
            active = not active
            # Show indicator
            indicator = b"\x1b[s\x1b[999C\x1b[10D"  # save cursor, go far right, back 10
            if active:
                indicator += b"\x1b[32m" + "[키]".encode("utf-8") + b"\x1b[0m"
            else:
                indicator += b"     "
            indicator += b"\x1b[u"  # restore cursor
            os.write(stdout_fd, indicator)
            continue

        if not active:
            # Pass through directly
            os.write(master_fd, byte)
            word_buf.clear()
            continue

        # Space or Enter: convert the buffered word
        if byte in (b" ", b"\r", b"\n"):
            if word_buf:
                try:
                    word = word_buf.decode("utf-8")
                    converted = classify_word(word)
                    if converted != word:
                        # Send backspaces to delete original word
                        backspaces = b"\x7f" * len(word_buf)
                        os.write(master_fd, backspaces)
                        # Send converted text
                        os.write(master_fd, converted.encode("utf-8"))
                except (UnicodeDecodeError, Exception):
                    pass  # On any error, original is already in the terminal
                word_buf.clear()
            os.write(master_fd, byte)

        # Backspace: remove from buffer
        elif byte in (b"\x7f", b"\x08"):
            if word_buf:
                word_buf.pop()
            os.write(master_fd, byte)

        # Regular printable ASCII: buffer it
        elif 0x20 < byte[0] < 0x7F:
            word_buf.extend(byte)
            os.write(master_fd, byte)

        # Control characters / escape sequences: pass through, clear buffer
        else:
            word_buf.clear()
            # Forward remaining bytes as a chunk (likely escape sequence)
            os.write(master_fd, data[i:])
            break

    return active, word_buf
