import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { basename, resolve, dirname, extname, normalize } from "node:path";
import { Marked } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js";
import { htmlTemplate, indexTemplate } from "./template.js";
import { loadComments, addComment, updateComment, deleteComment, clearComments } from "./comments.js";
import { loadRegistry, addEntry, removeEntry } from "./registry.js";

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
  ".html": "text/html",
  ".json": "application/json",
  ".txt": "text/plain",
  ".yaml": "text/yaml",
  ".yml": "text/yaml",
};

function resolveDoc(urlPath) {
  const entries = loadRegistry();
  // Match longest slug first (supports multi-segment slugs like "project/readme")
  const sorted = [...entries].sort((a, b) => b.slug.length - a.slug.length);
  for (const entry of sorted) {
    const prefix = "/" + entry.slug;
    if (urlPath === prefix || urlPath.startsWith(prefix + "/")) {
      const rest = urlPath.slice(prefix.length) || "/";
      return { entry, rest };
    }
  }
  return null;
}

export function startServer(filePath, port, hosts = [], opts = {}) {
  const { reviewMode = false, daemon = false } = opts;

  let slug = null;
  let absFile = null;
  let baseDir = null;

  if (filePath) {
    absFile = resolve(filePath);
    baseDir = dirname(absFile);
    slug = addEntry(absFile, baseDir);
  }

  let reviewResolve = null;
  const reviewPromise = reviewMode
    ? new Promise((r) => { reviewResolve = r; })
    : null;

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

    // Register API — add a new document
    if (urlPath === "/_api/register" && req.method === "POST") {
      let body = "";
      req.on("data", (c) => { body += c; });
      req.on("end", () => {
        try {
          const { filePath: fp, baseDir: bd } = JSON.parse(body);
          if (!fp || !bd) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "filePath and baseDir required" }));
            return;
          }
          const newSlug = addEntry(fp, bd);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ slug: newSlug }));
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "invalid json" }));
        }
      });
      return;
    }

    // Unregister API
    if (urlPath === "/_api/unregister" && req.method === "POST") {
      let body = "";
      req.on("data", (c) => { body += c; });
      req.on("end", () => {
        try {
          const { slug: s } = JSON.parse(body);
          removeEntry(s);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "invalid json" }));
        }
      });
      return;
    }

    // Registry list
    if (urlPath === "/_api/registry" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(loadRegistry()));
      return;
    }

    // Submit review
    if (urlPath === "/_api/submit-review" && req.method === "POST" && reviewResolve) {
      const mdAbs = resolve(baseDir, basename(absFile));
      const comments = loadComments(mdAbs);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      reviewResolve(comments);
      return;
    }

    // Index page
    if (urlPath === "/") {
      const entries = loadRegistry();
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" });
      res.end(indexTemplate(entries));
      return;
    }

    // Resolve document from URL
    const doc = resolveDoc(urlPath);
    if (!doc) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }

    const { entry, rest } = doc;

    // Scoped Content API: /<slug>/_api/content/<mdfile>
    if (rest.startsWith("/_api/content/")) {
      const mdRel = rest.replace("/_api/content/", "");
      const mdAbs = resolve(entry.baseDir, normalize(mdRel));
      if (!mdAbs.startsWith(entry.baseDir) || !mdAbs.endsWith(".md")) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "invalid path" }));
        return;
      }
      return handleContentApi(req, res, mdAbs);
    }

    // Scoped Comments API: /<slug>/_api/comments/<mdfile>
    if (rest.startsWith("/_api/comments/")) {
      const mdRel = rest.replace("/_api/comments/", "");
      const mdAbs = resolve(entry.baseDir, normalize(mdRel));
      if (!mdAbs.startsWith(entry.baseDir) || !mdAbs.endsWith(".md")) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "invalid path" }));
        return;
      }
      return handleCommentsApi(req, res, mdAbs);
    }

    // Serve file
    const reqFile = rest === "/" ? entry.entryFile : rest.replace(/^\//, "");
    const absPath = resolve(entry.baseDir, normalize(reqFile));

    if (!absPath.startsWith(entry.baseDir)) {
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
      const html = renderFile(absPath, relPath, entry.slug, reviewMode);
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" });
      res.end(html);
      return;
    }

    const mime = MIME_TYPES[ext];
    if (mime) {
      const content = readFileSync(absPath, "utf8");
      res.writeHead(200, { "Content-Type": `${mime}; charset=utf-8`, "Cache-Control": "no-cache" });
      res.end(content);
      return;
    }

    res.writeHead(403, { "Content-Type": "text/plain" });
    res.end("Forbidden file type");
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`Error: Port ${port} is already in use. Is mdgate already running?`);
      console.error(`  Try: mdgate --stop   then retry`);
      process.exit(1);
    }
    throw err;
  });

  server.listen(port, "0.0.0.0", () => {
    mkdirSync(STATE_DIR, { recursive: true });
    writeFileSync(resolve(STATE_DIR, "server.pid"), String(process.pid));

    if (daemon) {
      console.log(`mdgate daemon started on port ${port}`);
      console.log(`  Local:      http://localhost:${port}/`);
      if (hosts.length) {
        for (const h of hosts) {
          console.log(`  Tailscale:  http://${h}:${port}/`);
        }
      }
      console.log(`\nWaiting for documents... (use: mdgate <file.md>)`);
    } else {
      const log = reviewMode ? console.error.bind(console) : console.log.bind(console);
      log(`mdgate serving: ${filePath}`);
      log(`  Slug:       ${slug}`);
      log(`  Local:      http://localhost:${port}/${slug}/`);
      if (hosts.length) {
        for (const h of hosts) {
          log(`  Tailscale:  http://${h}:${port}/${slug}/`);
        }
      }
      log(reviewMode ? `\nWaiting for review submission...` : `\nCtrl+C to stop.`);
    }
  });

  function cleanup() {
    try { unlinkSync(resolve(STATE_DIR, "server.pid")); } catch {}
    server.close();
    process.exit(0);
  }

  process.on("SIGTERM", cleanup);
  process.on("SIGINT", cleanup);

  return { server, reviewPromise };
}

function handleContentApi(req, res, mdAbs) {
  if (req.method === "GET") {
    if (!existsSync(mdAbs)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "not found" }));
      return;
    }
    const content = readFileSync(mdAbs, "utf8");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ content }));
    return;
  }

  if (req.method === "PUT") {
    let body = "";
    req.on("data", (c) => { body += c; });
    req.on("end", () => {
      try {
        const { content } = JSON.parse(body);
        if (content == null) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "content required" }));
          return;
        }
        writeFileSync(mdAbs, content);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "invalid json" }));
      }
    });
    return;
  }

  res.writeHead(405, { "Content-Type": "text/plain" });
  res.end("Method not allowed");
}

function handleCommentsApi(req, res, mdAbs) {
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
    if (id) {
      if (id === "_all") {
        clearComments(mdAbs);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } else if (deleteComment(mdAbs, id)) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } else {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "not found" }));
      }
    } else {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "id required" }));
    }
    return;
  }

  if (req.method === "PATCH") {
    let body = "";
    req.on("data", (c) => { body += c; });
    req.on("end", () => {
      try {
        const { id, text } = JSON.parse(body);
        if (!id || !text || !text.trim()) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "id and text required" }));
          return;
        }
        const updated = updateComment(mdAbs, id, text.trim());
        if (updated) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(updated));
        } else {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "not found" }));
        }
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "invalid json" }));
      }
    });
    return;
  }

  res.writeHead(405, { "Content-Type": "text/plain" });
  res.end("Method not allowed");
}

function renderFile(filePath, relPath, slug, reviewMode = false) {
  const md = readFileSync(filePath, "utf8");
  const contentHtml = marked.parse(md);
  return htmlTemplate(basename(filePath), contentHtml, relPath || basename(filePath), { reviewMode, slug });
}
