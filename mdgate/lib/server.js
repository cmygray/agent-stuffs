import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { basename, resolve, dirname, extname, normalize, relative } from "node:path";
import { Marked } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js";
import { htmlTemplate } from "./template.js";
import { loadComments, addComment, deleteComment } from "./comments.js";

const STATE_DIR = resolve(process.env.HOME || "/tmp", ".mdgate");

// Tailscale CGNAT range: 100.64.0.0/10
function isTailscaleOrLocal(ip) {
  const addr = ip.replace(/^::ffff:/, "");
  if (addr === "127.0.0.1" || addr === "::1") return true;
  const parts = addr.split(".");
  if (parts.length !== 4) return false;
  const first = parseInt(parts[0], 10);
  const second = parseInt(parts[1], 10);
  return first === 100 && second >= 64 && second <= 127;
}

const marked = new Marked(
  markedHighlight({
    langPrefix: "hljs language-",
    highlight(code, lang) {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      return hljs.highlightAuto(code).value;
    },
  }),
);

marked.setOptions({ gfm: true, breaks: true });

const MIME_TYPES = {
  ".json": "application/json",
  ".txt": "text/plain",
  ".yaml": "text/yaml",
  ".yml": "text/yaml",
};

export function startServer(filePath, port, hosts = []) {
  const baseDir = dirname(resolve(filePath));
  const entryFile = basename(filePath);

  const server = createServer((req, res) => {
    const clientIp = req.socket.remoteAddress || "";
    if (!isTailscaleOrLocal(clientIp)) {
      res.writeHead(403, { "Content-Type": "text/plain" });
      res.end("Forbidden");
      return;
    }

    const urlPath = decodeURIComponent(req.url.split("?")[0]);

    if (urlPath === "/_events") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write(": connected\n\n");
      return;
    }

    if (urlPath === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    // Comments API
    if (urlPath.startsWith("/_api/comments/")) {
      const mdRel = urlPath.replace("/_api/comments/", "");
      const mdAbs = resolve(baseDir, normalize(mdRel));
      if (!mdAbs.startsWith(baseDir) || !mdAbs.endsWith(".md")) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "invalid path" }));
        return;
      }

      if (req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(loadComments(mdAbs)));
        return;
      }

      if (req.method === "POST") {
        let body = "";
        req.on("data", (c) => { body += c; });
        req.on("end", () => {
          try {
            const { section, text } = JSON.parse(body);
            if (!text || !text.trim()) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "text required" }));
              return;
            }
            const entry = addComment(mdAbs, { section: section || "", text: text.trim() });
            res.writeHead(201, { "Content-Type": "application/json" });
            res.end(JSON.stringify(entry));
          } catch {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "invalid json" }));
          }
        });
        return;
      }

      if (req.method === "DELETE") {
        const url = new URL(req.url, "http://localhost");
        const id = url.searchParams.get("id");
        if (id && deleteComment(mdAbs, id)) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
        } else {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "not found" }));
        }
        return;
      }

      res.writeHead(405, { "Content-Type": "text/plain" });
      res.end("Method not allowed");
      return;
    }

    // Resolve requested file
    const reqFile = urlPath === "/" ? entryFile : urlPath.replace(/^\//, "");
    const absPath = resolve(baseDir, normalize(reqFile));

    // Path traversal guard: must stay within baseDir
    if (!absPath.startsWith(baseDir)) {
      res.writeHead(403, { "Content-Type": "text/plain" });
      res.end("Forbidden");
      return;
    }

    if (!existsSync(absPath)) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }

    const ext = extname(absPath).toLowerCase();

    if (ext === ".md") {
      const relPath = reqFile;
      const html = renderFile(absPath, relPath);
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache",
      });
      res.end(html);
      return;
    }

    // Serve other allowed file types as-is
    const mime = MIME_TYPES[ext];
    if (mime) {
      const content = readFileSync(absPath, "utf8");
      res.writeHead(200, {
        "Content-Type": `${mime}; charset=utf-8`,
        "Cache-Control": "no-cache",
      });
      res.end(content);
      return;
    }

    res.writeHead(403, { "Content-Type": "text/plain" });
    res.end("Forbidden file type");
  });

  server.listen(port, "0.0.0.0", () => {
    mkdirSync(STATE_DIR, { recursive: true });
    writeFileSync(resolve(STATE_DIR, "server.pid"), String(process.pid));

    console.log(`mdgate serving: ${filePath}`);
    console.log(`  Root dir:   ${baseDir}`);
    console.log(`  Local:      http://localhost:${port}`);
    if (hosts.length) {
      for (const h of hosts) {
        console.log(`  Tailscale:  http://${h}:${port}`);
      }
    }
    console.log(`\nCtrl+C to stop.`);
  });

  function cleanup() {
    try { unlinkSync(resolve(STATE_DIR, "server.pid")); } catch {}
    server.close();
    process.exit(0);
  }

  process.on("SIGTERM", cleanup);
  process.on("SIGINT", cleanup);
}

function renderFile(filePath, relPath) {
  const md = readFileSync(filePath, "utf8");
  const contentHtml = marked.parse(md);
  return htmlTemplate(basename(filePath), contentHtml, relPath || basename(filePath));
}
