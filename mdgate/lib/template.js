function buildBreadcrumb(mdPath) {
  const parts = mdPath.split("/");
  if (parts.length <= 1) return "";
  const crumbs = [];
  // Link to root
  crumbs.push('<a href="/">root</a>');
  // Intermediate dirs (no links — just labels)
  for (let i = 0; i < parts.length - 1; i++) {
    crumbs.push(`<span>${escapeHtml(parts[i])}</span>`);
  }
  // Current file (no link)
  crumbs.push(`<span>${escapeHtml(parts[parts.length - 1])}</span>`);
  return crumbs.join(' <span class="breadcrumb-sep">/</span> ');
}

export function htmlTemplate(title, contentHtml, mdPath) {
  const breadcrumbHtml = buildBreadcrumb(mdPath);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5">
<title>${escapeHtml(title)}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }

  :root {
    --bg: #1a1b26;
    --fg: #c0caf5;
    --fg-dim: #565f89;
    --accent: #7aa2f7;
    --border: #292e42;
    --code-bg: #24283b;
    --block-bg: #1e2030;
    --link: #7dcfff;
    --comment-bg: #1e1e2e;
    --comment-border: #f7768e;
    --btn-bg: #292e42;
  }

  html { font-size: 16px; }

  body {
    margin: 0;
    padding: 1rem;
    background: var(--bg);
    color: var(--fg);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    line-height: 1.7;
    -webkit-text-size-adjust: 100%;
    overflow-wrap: break-word;
    word-break: break-word;
  }

  .container {
    max-width: 48rem;
    margin: 0 auto;
    padding: 0.5rem 0 3rem;
  }

  h1, h2, h3, h4, h5, h6 {
    color: var(--accent);
    margin: 1.5em 0 0.5em;
    line-height: 1.3;
    position: relative;
  }
  h1 { font-size: 1.6rem; border-bottom: 1px solid var(--border); padding-bottom: 0.3em; }
  h2 { font-size: 1.35rem; }
  h3 { font-size: 1.15rem; }

  a { color: var(--link); text-decoration: none; }
  a:hover { text-decoration: underline; }

  p { margin: 0.8em 0; }

  pre {
    background: var(--code-bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 1em;
    overflow-x: auto;
    font-size: 0.85rem;
    line-height: 1.5;
    -webkit-overflow-scrolling: touch;
  }

  code {
    font-family: "SF Mono", "Fira Code", "Cascadia Code", Menlo, monospace;
    font-size: 0.9em;
  }

  :not(pre) > code {
    background: var(--code-bg);
    padding: 0.15em 0.35em;
    border-radius: 3px;
  }

  blockquote {
    margin: 1em 0;
    padding: 0.5em 1em;
    border-left: 3px solid var(--accent);
    background: var(--block-bg);
    border-radius: 0 4px 4px 0;
  }
  blockquote p { margin: 0.3em 0; }

  table {
    width: 100%;
    border-collapse: collapse;
    margin: 1em 0;
    font-size: 0.9rem;
    display: block;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  th, td {
    padding: 0.5em 0.75em;
    border: 1px solid var(--border);
    text-align: left;
  }
  th { background: var(--code-bg); color: var(--accent); }

  ul, ol { padding-left: 1.5em; }
  li { margin: 0.25em 0; }
  li > ul, li > ol { margin: 0.2em 0; }

  input[type="checkbox"] { margin-right: 0.4em; }

  hr {
    border: none;
    border-top: 1px solid var(--border);
    margin: 2em 0;
  }

  img { max-width: 100%; height: auto; border-radius: 4px; }

  .meta {
    color: var(--fg-dim);
    font-size: 0.8rem;
    border-bottom: 1px solid var(--border);
    padding-bottom: 0.5em;
    margin-bottom: 1em;
  }

  .hljs { background: transparent; }

  /* Comment UI */
  .comment-btn {
    display: inline-block;
    margin-left: 0.5em;
    padding: 0.1em 0.4em;
    font-size: 0.7em;
    background: var(--btn-bg);
    color: var(--fg-dim);
    border: 1px solid var(--border);
    border-radius: 4px;
    cursor: pointer;
    vertical-align: middle;
    -webkit-tap-highlight-color: transparent;
  }
  .comment-btn:active { background: var(--border); }
  .comment-btn.has-comments { color: var(--comment-border); border-color: var(--comment-border); }

  .comment-form {
    display: none;
    margin: 0.5em 0 1em;
    padding: 0.75em;
    background: var(--comment-bg);
    border: 1px solid var(--border);
    border-radius: 6px;
  }
  .comment-form.open { display: block; }

  .comment-form textarea {
    width: 100%;
    min-height: 5em;
    padding: 0.5em;
    background: var(--bg);
    color: var(--fg);
    border: 1px solid var(--border);
    border-radius: 4px;
    font-family: inherit;
    font-size: 0.9rem;
    resize: vertical;
  }
  .comment-form textarea:focus { outline: 1px solid var(--accent); border-color: var(--accent); }

  .comment-form-actions {
    display: flex;
    gap: 0.5em;
    margin-top: 0.5em;
    justify-content: flex-end;
  }

  .comment-submit, .comment-cancel {
    padding: 0.4em 1em;
    border: none;
    border-radius: 4px;
    font-size: 0.85rem;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .comment-submit { background: var(--accent); color: var(--bg); }
  .comment-submit:active { opacity: 0.8; }
  .comment-cancel { background: var(--btn-bg); color: var(--fg-dim); }

  .comment-list {
    margin: 0.3em 0 0.8em;
  }

  .comment-item {
    padding: 0.5em 0.75em;
    margin: 0.3em 0;
    background: var(--comment-bg);
    border-left: 3px solid var(--comment-border);
    border-radius: 0 4px 4px 0;
    font-size: 0.85rem;
    position: relative;
  }
  .comment-item .comment-text { white-space: pre-wrap; }
  .comment-item .comment-time {
    color: var(--fg-dim);
    font-size: 0.75rem;
    margin-top: 0.3em;
  }
  .comment-delete {
    position: absolute;
    top: 0.4em;
    right: 0.5em;
    background: none;
    border: none;
    color: var(--fg-dim);
    cursor: pointer;
    font-size: 0.8rem;
    padding: 0.2em;
  }
  .comment-delete:active { color: var(--comment-border); }

  /* Breadcrumb */
  .breadcrumb {
    position: sticky;
    top: 0;
    z-index: 10;
    background: var(--bg);
    padding: 0.5em 0;
    margin: -1rem -1rem 0;
    padding: 0.5em 1rem;
    border-bottom: 1px solid var(--border);
    font-size: 0.8rem;
    color: var(--fg-dim);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    background: rgba(26, 27, 38, 0.9);
  }
  .breadcrumb a { color: var(--link); }
  .breadcrumb-sep { margin: 0 0.2em; opacity: 0.5; }
</style>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/tokyo-night-dark.min.css">
</head>
<body>
<div class="container">
  ${breadcrumbHtml ? `<nav class="breadcrumb">${breadcrumbHtml}</nav>` : ""}
  <div class="meta">${escapeHtml(title)}</div>
  ${contentHtml}
</div>
<script>
const MD_PATH = ${JSON.stringify(mdPath)};
const API = "/_api/comments/" + MD_PATH;

(async function init() {
  const headings = document.querySelectorAll("h1, h2, h3");
  headings.forEach((h) => {
    const section = h.textContent.trim();
    h.dataset.section = section;

    const btn = document.createElement("span");
    btn.className = "comment-btn";
    btn.textContent = "+";
    btn.setAttribute("role", "button");
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      toggleForm(h);
    });
    h.appendChild(btn);

    const list = document.createElement("div");
    list.className = "comment-list";
    list.dataset.section = section;
    h.after(list);

    const form = document.createElement("div");
    form.className = "comment-form";
    form.dataset.section = section;

    const ta = document.createElement("textarea");
    ta.placeholder = "Comment... (Cmd+Enter to submit)";
    ta.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        submitComment(section, form);
      }
    });
    form.appendChild(ta);

    const actions = document.createElement("div");
    actions.className = "comment-form-actions";

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "comment-cancel";
    cancelBtn.type = "button";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", () => form.classList.remove("open"));

    const submitBtn = document.createElement("button");
    submitBtn.className = "comment-submit";
    submitBtn.type = "button";
    submitBtn.textContent = "Add";
    submitBtn.addEventListener("click", () => submitComment(section, form));

    actions.appendChild(cancelBtn);
    actions.appendChild(submitBtn);
    form.appendChild(actions);

    list.after(form);
  });

  await loadComments();
})();

async function loadComments() {
  try {
    const res = await fetch(API);
    const comments = await res.json();
    document.querySelectorAll(".comment-list").forEach((l) => { l.textContent = ""; });
    document.querySelectorAll(".comment-btn").forEach((b) => b.classList.remove("has-comments"));

    const bySec = {};
    comments.forEach((c) => {
      (bySec[c.section] = bySec[c.section] || []).push(c);
    });

    for (const [section, items] of Object.entries(bySec)) {
      const list = document.querySelector('.comment-list[data-section="' + CSS.escape(section) + '"]');
      if (!list) continue;
      const h = list.previousElementSibling;
      if (h) {
        const btn = h.querySelector(".comment-btn");
        if (btn) btn.classList.add("has-comments");
      }
      items.forEach((c) => list.appendChild(renderComment(c)));
    }
  } catch {}
}

function renderComment(c) {
  const div = document.createElement("div");
  div.className = "comment-item";

  const textEl = document.createElement("div");
  textEl.className = "comment-text";
  textEl.textContent = c.text;

  const timeEl = document.createElement("div");
  timeEl.className = "comment-time";
  const time = new Date(c.ts);
  timeEl.textContent = time.toLocaleDateString("ko-KR", { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" });

  const delBtn = document.createElement("button");
  delBtn.className = "comment-delete";
  delBtn.title = "Delete";
  delBtn.textContent = "\\u00d7";
  delBtn.addEventListener("click", async () => {
    await fetch(API + "?id=" + c.id, { method: "DELETE" });
    await loadComments();
  });

  div.appendChild(textEl);
  div.appendChild(timeEl);
  div.appendChild(delBtn);
  return div;
}

function toggleForm(h) {
  const section = h.dataset.section;
  const form = document.querySelector('.comment-form[data-section="' + CSS.escape(section) + '"]');
  if (!form) return;
  const isOpen = form.classList.toggle("open");
  if (isOpen) {
    const ta = form.querySelector("textarea");
    ta.value = "";
    ta.focus();
  }
}

async function submitComment(section, form) {
  const ta = form.querySelector("textarea");
  const text = ta.value.trim();
  if (!text) return;

  const btn = form.querySelector(".comment-submit");
  btn.disabled = true;
  try {
    await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section, text }),
    });
    form.classList.remove("open");
    await loadComments();
  } finally {
    btn.disabled = false;
  }
}
</script>
</body>
</html>`;
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
