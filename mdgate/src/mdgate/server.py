from __future__ import annotations

import atexit
import ipaddress
import json
import signal
import sys
import threading
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from os.path import basename, normpath
from pathlib import Path
from urllib.parse import unquote, urlparse, parse_qs

import mistune
from pygments import highlight as pygments_highlight
from pygments.formatters import HtmlFormatter
from pygments.lexers import get_lexer_by_name, guess_lexer, TextLexer

from .comments import load_comments, add_comment, update_comment, delete_comment, clear_comments, resolve_comment
from .registry import load_registry, add_entry, remove_entry, save_registry
from .template import html_template, index_template

STATE_DIR = Path.home() / ".mdgate"

_TAILSCALE_NET = ipaddress.ip_network("100.64.0.0/10")
_FORMATTER = HtmlFormatter(noclasses=True, style="monokai")

MIME_TYPES = {
    ".html": "text/html",
    ".json": "application/json",
    ".txt": "text/plain",
    ".yaml": "text/yaml",
    ".yml": "text/yaml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".css": "text/css",
    ".js": "text/javascript",
}

TEXT_MIMES = {"text/html", "application/json", "text/plain", "text/yaml", "image/svg+xml", "text/css", "text/javascript"}


def _is_tailscale_or_local(addr: str) -> bool:
    addr = addr.removeprefix("::ffff:")
    try:
        ip = ipaddress.ip_address(addr)
    except ValueError:
        return False
    return ip.is_loopback or ip in _TAILSCALE_NET


class _HighlightRenderer(mistune.HTMLRenderer):
    def block_code(self, code: str, info: str | None = None, **attrs):
        lang = (info or "").split()[0] if info else ""
        if lang == "mermaid":
            escaped = mistune.html(code)
            return f'<pre><code class="language-mermaid">{escaped}</code></pre>\n'
        if lang:
            try:
                lexer = get_lexer_by_name(lang, stripall=True)
            except Exception:
                lexer = TextLexer()
        else:
            try:
                lexer = guess_lexer(code)
            except Exception:
                lexer = TextLexer()
        return pygments_highlight(code, lexer, _FORMATTER)


_md = mistune.create_markdown(
    renderer=_HighlightRenderer(escape=False),
    plugins=["strikethrough", "table", "task_lists"],
)


def _resolve_doc(url_path: str) -> tuple[dict, str] | None:
    entries = load_registry()
    sorted_entries = sorted(entries, key=lambda e: len(e["slug"]), reverse=True)
    for entry in sorted_entries:
        prefix = "/" + entry["slug"]
        if url_path == prefix or url_path.startswith(prefix + "/"):
            rest = url_path[len(prefix):] or "/"
            return entry, rest
    return None


def _render_file(file_path: str, rel_path: str, slug: str, review_mode: bool = False) -> str:
    md = Path(file_path).read_text(encoding="utf-8")
    content_html = _md(md)
    return html_template(basename(file_path), content_html, rel_path or basename(file_path),
                         review_mode=review_mode, slug=slug)


class _Handler(BaseHTTPRequestHandler):
    slug: str | None
    abs_file: str | None
    base_dir: str | None
    review_mode: bool
    review_event: threading.Event | None

    def log_message(self, format, *args):
        pass  # suppress default logging

    def _check_ip(self) -> bool:
        addr = self.client_address[0]
        if not _is_tailscale_or_local(addr):
            self._send(403, "text/plain", b"Forbidden")
            return False
        return True

    def _send(self, code: int, content_type: str, body: bytes, extra_headers: dict | None = None):
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-cache")
        if extra_headers:
            for k, v in extra_headers.items():
                self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def _send_json(self, code: int, data):
        self._send(code, "application/json; charset=utf-8", json.dumps(data).encode())

    def _read_body(self) -> bytes:
        length = int(self.headers.get("Content-Length", 0))
        return self.rfile.read(length)

    def do_GET(self):
        if not self._check_ip():
            return
        url_path = unquote(self.path.split("?")[0])

        if url_path == "/_events":
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self.end_headers()
            self.wfile.write(b": connected\n\n")
            return

        if url_path == "/health":
            self._send_json(200, {"status": "ok"})
            return

        if url_path == "/_api/registry":
            self._send_json(200, load_registry())
            return

        if url_path.startswith("/_api/poll-review"):
            parsed = urlparse(self.path)
            qs = parse_qs(parsed.query)
            s = qs.get("slug", [None])[0]
            if not s:
                self._send_json(400, {"error": "slug required"})
                return
            if s in self.server._review_results:
                comments = self.server._review_results.pop(s)
                self.server._review_slugs.discard(s)
                self.server._review_events.pop(s, None)
                self._send_json(200, {"submitted": True, "comments": comments})
            else:
                self._send_json(200, {"submitted": False})
            return

        if url_path.startswith("/_api/pending-comments"):
            parsed = urlparse(self.path)
            qs = parse_qs(parsed.query)
            s = qs.get("slug", [None])[0]
            if not s:
                self._send_json(400, {"error": "slug required"})
                return
            entry = next((e for e in load_registry() if e["slug"] == s), None)
            if not entry:
                self._send_json(404, {"error": "slug not found"})
                return
            md_abs = str(Path(entry["baseDir"]) / normpath(entry["entryFile"]))
            all_comments = load_comments(md_abs)
            pending = [c for c in all_comments if not c.get("resolved")]
            self._send_json(200, {"pending": pending, "total": len(all_comments), "resolved": len(all_comments) - len(pending)})
            return

        if url_path == "/":
            html = index_template(load_registry())
            self._send(200, "text/html; charset=utf-8", html.encode())
            return

        doc = _resolve_doc(url_path)
        if not doc:
            self._send(404, "text/plain", b"Not found")
            return

        entry, rest = doc
        self._handle_doc_get(entry, rest)

    def _handle_doc_get(self, entry: dict, rest: str):
        if rest.startswith("/_api/content/"):
            md_rel = rest.removeprefix("/_api/content/")
            md_abs = str(Path(entry["baseDir"]) / normpath(md_rel))
            if not md_abs.startswith(entry["baseDir"]) or not md_abs.endswith(".md"):
                self._send_json(400, {"error": "invalid path"})
                return
            p = Path(md_abs)
            if not p.exists():
                self._send_json(404, {"error": "not found"})
                return
            self._send_json(200, {"content": p.read_text(encoding="utf-8")})
            return

        if rest.startswith("/_api/comments/"):
            md_rel = rest.removeprefix("/_api/comments/")
            md_abs = str(Path(entry["baseDir"]) / normpath(md_rel))
            if not md_abs.startswith(entry["baseDir"]) or not md_abs.endswith(".md"):
                self._send_json(400, {"error": "invalid path"})
                return
            self._send_json(200, load_comments(md_abs))
            return

        req_file = entry["entryFile"] if rest == "/" else rest.lstrip("/")
        abs_path = str(Path(entry["baseDir"]) / normpath(req_file))

        if not abs_path.startswith(entry["baseDir"]):
            self._send(403, "text/plain", b"Forbidden")
            return

        p = Path(abs_path)
        if not p.exists():
            self._send(404, "text/plain", b"Not found")
            return

        ext = p.suffix.lower()

        if ext == ".md":
            is_review = self.server._review_mode or entry["slug"] in self.server._review_slugs
            html = _render_file(abs_path, req_file, entry["slug"], is_review)
            self._send(200, "text/html; charset=utf-8", html.encode())
            return

        mime = MIME_TYPES.get(ext)
        if mime:
            if mime in TEXT_MIMES:
                content = p.read_text(encoding="utf-8")
                self._send(200, f"{mime}; charset=utf-8", content.encode())
            else:
                self._send(200, mime, p.read_bytes())
            return

        self._send(403, "text/plain", b"Forbidden file type")

    def do_POST(self):
        if not self._check_ip():
            return
        url_path = unquote(self.path.split("?")[0])

        if url_path == "/_api/register":
            body = json.loads(self._read_body())
            fp = body.get("filePath")
            bd = body.get("baseDir")
            if not fp or not bd:
                self._send_json(400, {"error": "filePath and baseDir required"})
                return
            new_slug = add_entry(fp, bd)
            self._send_json(200, {"slug": new_slug})
            return

        if url_path == "/_api/unregister":
            body = json.loads(self._read_body())
            s = body.get("slug")
            remove_entry(s)
            self._send_json(200, {"ok": True})
            return

        if url_path == "/_api/start-review":
            body = json.loads(self._read_body())
            s = body.get("slug")
            if not s:
                self._send_json(400, {"error": "slug required"})
                return
            self.server._review_slugs.add(s)
            self.server._review_events[s] = threading.Event()
            self._send_json(200, {"ok": True})
            return

        if url_path == "/_api/submit-review":
            raw = self._read_body()
            body = json.loads(raw) if raw else {}
            s = body.get("slug")
            # Per-slug review (daemon mode)
            if s and s in self.server._review_slugs:
                entry = next((e for e in load_registry() if e["slug"] == s), None)
                if entry:
                    md_abs = str(Path(entry["baseDir"]) / normpath(entry["entryFile"]))
                    comments = load_comments(md_abs)
                    self.server._review_results[s] = comments
                    evt = self.server._review_events.get(s)
                    if evt:
                        evt.set()
                self._send_json(200, {"ok": True})
                return
            # Legacy single-file review
            if self.server._review_event:
                md_abs = self.server._abs_file
                comments = load_comments(md_abs)
                self._send_json(200, {"ok": True})
                self.server._review_comments = comments
                self.server._review_event.set()
                return
            self._send_json(400, {"error": "no active review"})
            return

        doc = _resolve_doc(url_path)
        if not doc:
            self._send(404, "text/plain", b"Not found")
            return

        entry, rest = doc
        if rest.startswith("/_api/comments/"):
            md_rel = rest.removeprefix("/_api/comments/")
            md_abs = str(Path(entry["baseDir"]) / normpath(md_rel))
            if not md_abs.startswith(entry["baseDir"]) or not md_abs.endswith(".md"):
                self._send_json(400, {"error": "invalid path"})
                return
            body = json.loads(self._read_body())
            section = body.get("section", "")
            text = (body.get("text") or "").strip()
            if not text:
                self._send_json(400, {"error": "text required"})
                return
            entry_data = add_comment(md_abs, section, text)
            self._send_json(201, entry_data)
            return

        self._send(404, "text/plain", b"Not found")

    def do_PUT(self):
        if not self._check_ip():
            return
        url_path = unquote(self.path.split("?")[0])

        doc = _resolve_doc(url_path)
        if not doc:
            self._send(404, "text/plain", b"Not found")
            return

        entry, rest = doc
        if rest.startswith("/_api/content/"):
            md_rel = rest.removeprefix("/_api/content/")
            md_abs = str(Path(entry["baseDir"]) / normpath(md_rel))
            if not md_abs.startswith(entry["baseDir"]) or not md_abs.endswith(".md"):
                self._send_json(400, {"error": "invalid path"})
                return
            body = json.loads(self._read_body())
            content = body.get("content")
            if content is None:
                self._send_json(400, {"error": "content required"})
                return
            Path(md_abs).write_text(content, encoding="utf-8")
            self._send_json(200, {"ok": True})
            return

        self._send(405, "text/plain", b"Method not allowed")

    def do_PATCH(self):
        if not self._check_ip():
            return
        url_path = unquote(self.path.split("?")[0])

        doc = _resolve_doc(url_path)
        if not doc:
            self._send(404, "text/plain", b"Not found")
            return

        entry, rest = doc
        if rest.startswith("/_api/comments/"):
            md_rel = rest.removeprefix("/_api/comments/")
            md_abs = str(Path(entry["baseDir"]) / normpath(md_rel))
            if not md_abs.startswith(entry["baseDir"]) or not md_abs.endswith(".md"):
                self._send_json(400, {"error": "invalid path"})
                return
            body = json.loads(self._read_body())
            cid = body.get("id")
            if not cid:
                self._send_json(400, {"error": "id required"})
                return
            # Resolve
            if body.get("resolved") and not body.get("text"):
                result = resolve_comment(md_abs, cid)
                if result:
                    self._send_json(200, result)
                else:
                    self._send_json(404, {"error": "not found"})
                return
            text = (body.get("text") or "").strip()
            if not text:
                self._send_json(400, {"error": "id and text required"})
                return
            updated = update_comment(md_abs, cid, text)
            if updated:
                self._send_json(200, updated)
            else:
                self._send_json(404, {"error": "not found"})
            return

        self._send(405, "text/plain", b"Method not allowed")

    def do_DELETE(self):
        if not self._check_ip():
            return
        url_path = unquote(self.path.split("?")[0])

        doc = _resolve_doc(url_path)
        if not doc:
            self._send(404, "text/plain", b"Not found")
            return

        entry, rest = doc
        if rest.startswith("/_api/comments/"):
            parsed = urlparse(self.path)
            qs = parse_qs(parsed.query)
            cid = qs.get("id", [None])[0]
            if not cid:
                self._send_json(400, {"error": "id required"})
                return
            md_rel = rest.removeprefix("/_api/comments/")
            md_abs = str(Path(entry["baseDir"]) / normpath(md_rel))
            if not md_abs.startswith(entry["baseDir"]) or not md_abs.endswith(".md"):
                self._send_json(400, {"error": "invalid path"})
                return
            if cid == "_all":
                clear_comments(md_abs)
                self._send_json(200, {"ok": True})
            elif delete_comment(md_abs, cid):
                self._send_json(200, {"ok": True})
            else:
                self._send_json(404, {"error": "not found"})
            return

        self._send(405, "text/plain", b"Method not allowed")


class _MDGateServer(ThreadingHTTPServer):
    _review_mode: bool = False
    _review_event: threading.Event | None = None
    _review_comments: list | None = None
    _abs_file: str | None = None

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._review_slugs: set = set()
        self._review_results: dict = {}
        self._review_events: dict = {}  # slug -> threading.Event


def start_server(file_path: str | None, port: int, hosts: list[str] = (),
                 *, review_mode: bool = False, daemon: bool = False):
    slug = None
    abs_file = None
    base_dir = None

    if file_path:
        abs_file = str(Path(file_path).resolve())
        base_dir = str(Path(abs_file).parent)
        slug = add_entry(abs_file, base_dir)

    review_event = threading.Event() if review_mode else None

    server = _MDGateServer(("0.0.0.0", port), _Handler)
    server._review_mode = review_mode
    server._review_event = review_event
    server._abs_file = abs_file

    STATE_DIR.mkdir(parents=True, exist_ok=True)
    (STATE_DIR / "server.pid").write_text(str(server.server_address[1]) and str(__import__("os").getpid()))

    def _cleanup(*_):
        try:
            (STATE_DIR / "server.pid").unlink(missing_ok=True)
        except Exception:
            pass
        server.shutdown()

    signal.signal(signal.SIGTERM, _cleanup)
    atexit.register(lambda: (STATE_DIR / "server.pid").unlink(missing_ok=True))

    if daemon:
        print(f"mdgate daemon started on port {port}")
        print(f"  Local:      http://localhost:{port}/")
        for h in hosts:
            print(f"  Tailscale:  http://{h}:{port}/")
        print(f"\nWaiting for documents... (use: mdgate <file.md>)")
    else:
        log = (lambda *a, **kw: print(*a, file=sys.stderr, **kw)) if review_mode else print
        log(f"mdgate serving: {file_path}")
        log(f"  Slug:       {slug}")
        log(f"  Local:      http://localhost:{port}/{slug}/")
        for h in hosts:
            log(f"  Tailscale:  http://{h}:{port}/{slug}/")
        log(f"\n{'Waiting for review submission...' if review_mode else 'Ctrl+C to stop.'}")

    if review_mode:
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        review_event.wait()
        comments = server._review_comments
        server.shutdown()
        return comments
    else:
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            _cleanup()
