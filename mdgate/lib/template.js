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

export function htmlTemplate(title, contentHtml, mdPath, opts = {}) {
  const { reviewMode = false, slug = "" } = opts;
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
  .comment-edit {
    position: absolute;
    top: 0.4em;
    right: 2em;
    background: none;
    border: none;
    color: var(--fg-dim);
    cursor: pointer;
    font-size: 0.75rem;
    padding: 0.2em;
  }
  .comment-edit:active { color: var(--accent); }
  .comment-item .comment-edit-form { display: none; margin-top: 0.4em; }
  .comment-item .comment-edit-form.open { display: block; }
  .comment-item .comment-edit-form textarea {
    width: 100%;
    min-height: 3em;
    padding: 0.4em;
    background: var(--bg);
    color: var(--fg);
    border: 1px solid var(--border);
    border-radius: 4px;
    font-family: inherit;
    font-size: 0.85rem;
    resize: vertical;
  }
  .comment-item .comment-edit-form textarea:focus { outline: 1px solid var(--accent); border-color: var(--accent); }
  .comment-edited { color: var(--fg-dim); font-size: 0.7rem; font-style: italic; }

  /* Toolbar */
  .toolbar {
    display: flex;
    gap: 0.5em;
    margin-bottom: 1em;
    flex-wrap: wrap;
  }
  .toolbar-btn {
    padding: 0.35em 0.8em;
    background: var(--btn-bg);
    color: var(--fg-dim);
    border: 1px solid var(--border);
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.8rem;
    -webkit-tap-highlight-color: transparent;
  }
  .toolbar-btn:active { background: var(--border); }
  .toolbar-btn.active { color: var(--accent); border-color: var(--accent); }

  /* Editor */
  .editor-container { display: none; }
  .editor-container.open { display: block; }
  .editor-textarea {
    width: 100%;
    min-height: 60vh;
    padding: 1em;
    background: var(--code-bg);
    color: var(--fg);
    border: 1px solid var(--border);
    border-radius: 6px;
    font-family: "SF Mono", "Fira Code", "Cascadia Code", Menlo, monospace;
    font-size: 0.9rem;
    line-height: 1.6;
    resize: vertical;
    tab-size: 2;
  }
  .editor-textarea:focus { outline: 1px solid var(--accent); border-color: var(--accent); }
  .editor-actions {
    display: flex;
    gap: 0.5em;
    margin-top: 0.5em;
    justify-content: flex-end;
  }
  .editor-save { padding: 0.4em 1em; background: var(--accent); color: var(--bg); border: none; border-radius: 4px; cursor: pointer; font-size: 0.85rem; }
  .editor-cancel { padding: 0.4em 1em; background: var(--btn-bg); color: var(--fg-dim); border: none; border-radius: 4px; cursor: pointer; font-size: 0.85rem; }
  .editor-status { color: var(--fg-dim); font-size: 0.8rem; padding: 0.4em 0; }

  /* Review Panel */
  .review-panel { display: none; }
  .review-panel.open { display: block; margin-bottom: 2em; }
  .review-panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5em;
    gap: 0.5em;
  }
  .review-panel-actions { display: flex; gap: 0.5em; align-items: center; }
  .review-panel-title { font-size: 1rem; color: var(--accent); font-weight: 600; }
  .review-panel-count { font-size: 0.8rem; color: var(--fg-dim); }
  .review-item {
    padding: 0.6em 0.75em;
    margin: 0.3em 0;
    background: var(--comment-bg);
    border-left: 3px solid var(--comment-border);
    border-radius: 0 4px 4px 0;
    font-size: 0.85rem;
  }
  .review-item-section {
    color: var(--accent);
    font-size: 0.75rem;
    font-weight: 600;
    margin-bottom: 0.2em;
    cursor: pointer;
  }
  .review-item-section:hover { text-decoration: underline; }
  .review-item-text { white-space: pre-wrap; }
  .review-item-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 0.3em;
  }
  .review-item-time { color: var(--fg-dim); font-size: 0.7rem; }
  .clear-all-btn {
    padding: 0.3em 0.7em;
    background: none;
    color: var(--comment-border);
    border: 1px solid var(--comment-border);
    border-radius: 4px;
    font-size: 0.75rem;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .clear-all-btn:active { background: var(--comment-border); color: var(--bg); }
  .clear-all-btn:disabled { opacity: 0.4; cursor: default; }

  /* Submit Review */
  .submit-review-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 20;
    background: rgba(26, 27, 38, 0.95);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border-top: 1px solid var(--border);
    padding: 0.75em 1rem;
    display: flex;
    justify-content: center;
    gap: 0.75em;
    align-items: center;
  }
  .submit-review-btn {
    padding: 0.5em 1.5em;
    background: #9ece6a;
    color: var(--bg);
    border: none;
    border-radius: 6px;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
  }
  .submit-review-btn:active { opacity: 0.8; }
  .submit-review-status { color: var(--fg-dim); font-size: 0.85rem; }

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
  <div class="toolbar">
    <button class="toolbar-btn" id="editToggle">Edit</button>
    <button class="toolbar-btn" id="reviewToggle">Comments</button>
  </div>
  <div class="review-panel" id="reviewPanel">
    <div class="review-panel-header">
      <span class="review-panel-title">All Comments</span>
      <div class="review-panel-actions">
        <span class="review-panel-count" id="reviewCount"></span>
        <button class="clear-all-btn" id="clearAllBtn">Clear All</button>
      </div>
    </div>
    <div id="reviewList"></div>
  </div>
  <div class="editor-container" id="editorContainer">
    <textarea class="editor-textarea" id="editorTextarea" spellcheck="false"></textarea>
    <div class="editor-actions">
      <span class="editor-status" id="editorStatus"></span>
      <button class="editor-cancel" id="editorCancel">Cancel</button>
      <button class="editor-save" id="editorSave">Save (⌘S)</button>
    </div>
  </div>
  <div id="contentView">${contentHtml}</div>
</div>
${reviewMode ? `<div class="submit-review-bar">
  <span class="submit-review-status" id="reviewStatus">Add comments, then submit review</span>
  <button class="submit-review-btn" id="submitReviewBtn">Submit Review</button>
</div>` : ""}
<script>
const REVIEW_MODE = ${JSON.stringify(reviewMode)};
const MD_PATH = ${JSON.stringify(mdPath)};
const SLUG = ${JSON.stringify(slug)};
const COMMENTS_API = "/" + SLUG + "/_api/comments/" + MD_PATH;
const CONTENT_API = "/" + SLUG + "/_api/content/" + MD_PATH;

let allComments = [];

(async function init() {
  const headings = document.querySelectorAll("#contentView h1, #contentView h2, #contentView h3");
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
  initEditor();
  initReviewPanel();
  initCheckboxes();
  if (REVIEW_MODE) initSubmitReview();
})();

async function loadComments() {
  try {
    const res = await fetch(COMMENTS_API);
    allComments = await res.json();
    document.querySelectorAll(".comment-list").forEach((l) => { l.textContent = ""; });
    document.querySelectorAll(".comment-btn").forEach((b) => b.classList.remove("has-comments"));

    const bySec = {};
    allComments.forEach((c) => {
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

    renderReviewList();
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
  if (c.editedAt) {
    const edited = document.createElement("span");
    edited.className = "comment-edited";
    edited.textContent = " (edited)";
    timeEl.appendChild(edited);
  }

  const editBtn = document.createElement("button");
  editBtn.className = "comment-edit";
  editBtn.title = "Edit";
  editBtn.textContent = "\\u270e";
  editBtn.addEventListener("click", () => toggleEditForm(div, c));

  const delBtn = document.createElement("button");
  delBtn.className = "comment-delete";
  delBtn.title = "Delete";
  delBtn.textContent = "\\u00d7";
  delBtn.addEventListener("click", async () => {
    await fetch(COMMENTS_API + "?id=" + c.id, { method: "DELETE" });
    await loadComments();
  });

  const editForm = document.createElement("div");
  editForm.className = "comment-edit-form";
  const editTa = document.createElement("textarea");
  editTa.value = c.text;
  editTa.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      saveEdit(c.id, editTa, editForm);
    }
    if (e.key === "Escape") editForm.classList.remove("open");
  });
  const editActions = document.createElement("div");
  editActions.className = "comment-form-actions";
  const editCancelBtn = document.createElement("button");
  editCancelBtn.className = "comment-cancel";
  editCancelBtn.textContent = "Cancel";
  editCancelBtn.addEventListener("click", () => editForm.classList.remove("open"));
  const editSaveBtn = document.createElement("button");
  editSaveBtn.className = "comment-submit";
  editSaveBtn.textContent = "Save";
  editSaveBtn.addEventListener("click", () => saveEdit(c.id, editTa, editForm));
  editActions.appendChild(editCancelBtn);
  editActions.appendChild(editSaveBtn);
  editForm.appendChild(editTa);
  editForm.appendChild(editActions);

  div.appendChild(textEl);
  div.appendChild(timeEl);
  div.appendChild(editBtn);
  div.appendChild(delBtn);
  div.appendChild(editForm);
  return div;
}

function toggleEditForm(div, c) {
  const form = div.querySelector(".comment-edit-form");
  const isOpen = form.classList.toggle("open");
  if (isOpen) {
    const ta = form.querySelector("textarea");
    ta.value = c.text;
    ta.focus();
  }
}

async function saveEdit(id, ta, form) {
  const text = ta.value.trim();
  if (!text) return;
  await fetch(COMMENTS_API, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, text }),
  });
  form.classList.remove("open");
  await loadComments();
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
    await fetch(COMMENTS_API, {
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

/* --- Checkboxes --- */
function initCheckboxes() {
  const boxes = document.querySelectorAll('#contentView input[type="checkbox"]');
  boxes.forEach((cb, idx) => {
    cb.removeAttribute("disabled");
    cb.style.cursor = "pointer";
    cb.addEventListener("click", async (e) => {
      const res = await fetch(CONTENT_API);
      const { content } = await res.json();
      let i = 0;
      const updated = content.replace(/- \\[([ xX])\\]/g, (match, check) => {
        if (i++ === idx) {
          return cb.checked ? "- [x]" : "- [ ]";
        }
        return match;
      });
      await fetch(CONTENT_API, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: updated }),
      });
    });
  });
}

/* --- Editor --- */
function initEditor() {
  const toggle = document.getElementById("editToggle");
  const container = document.getElementById("editorContainer");
  const contentView = document.getElementById("contentView");
  const ta = document.getElementById("editorTextarea");
  const saveBtn = document.getElementById("editorSave");
  const cancelBtn = document.getElementById("editorCancel");
  const status = document.getElementById("editorStatus");

  toggle.addEventListener("click", async () => {
    const opening = !container.classList.contains("open");
    if (opening) {
      status.textContent = "Loading...";
      const res = await fetch(CONTENT_API);
      const { content } = await res.json();
      ta.value = content;
      container.classList.add("open");
      contentView.style.display = "none";
      toggle.classList.add("active");
      status.textContent = "";
      ta.focus();
    } else {
      container.classList.remove("open");
      contentView.style.display = "";
      toggle.classList.remove("active");
    }
  });

  cancelBtn.addEventListener("click", () => {
    container.classList.remove("open");
    contentView.style.display = "";
    toggle.classList.remove("active");
  });

  saveBtn.addEventListener("click", () => saveContent(ta, status));

  document.addEventListener("keydown", (e) => {
    if (e.key === "s" && (e.metaKey || e.ctrlKey) && container.classList.contains("open")) {
      e.preventDefault();
      saveContent(ta, status);
    }
  });

  // Tab key inserts spaces in editor
  ta.addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      ta.value = ta.value.substring(0, start) + "  " + ta.value.substring(end);
      ta.selectionStart = ta.selectionEnd = start + 2;
    }
  });
}

async function saveContent(ta, status) {
  status.textContent = "Saving...";
  try {
    const res = await fetch(CONTENT_API, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: ta.value }),
    });
    if (res.ok) {
      status.textContent = "Saved!";
      setTimeout(() => { status.textContent = ""; }, 1500);
      setTimeout(() => location.reload(), 500);
    } else {
      status.textContent = "Error saving";
    }
  } catch {
    status.textContent = "Error saving";
  }
}

/* --- Review Panel --- */
function initReviewPanel() {
  const toggle = document.getElementById("reviewToggle");
  const panel = document.getElementById("reviewPanel");
  const clearBtn = document.getElementById("clearAllBtn");

  toggle.addEventListener("click", () => {
    const opening = panel.classList.toggle("open");
    toggle.classList.toggle("active", opening);
    if (opening) renderReviewList();
  });

  clearBtn.addEventListener("click", async () => {
    if (allComments.length === 0) return;
    clearBtn.disabled = true;
    clearBtn.textContent = "Clearing...";
    await fetch(COMMENTS_API + "?id=_all", { method: "DELETE" });
    await loadComments();
    clearBtn.disabled = false;
    clearBtn.textContent = "Clear All";
  });
}

function renderReviewList() {
  const list = document.getElementById("reviewList");
  const count = document.getElementById("reviewCount");
  if (!list) return;
  list.textContent = "";
  count.textContent = allComments.length + " comments";

  if (allComments.length === 0) {
    const empty = document.createElement("div");
    empty.style.cssText = "color:var(--fg-dim);font-size:0.85rem;padding:0.5em 0;";
    empty.textContent = "No comments yet.";
    list.appendChild(empty);
    return;
  }

  allComments.forEach((c) => {
    const item = document.createElement("div");
    item.className = "review-item";

    const sec = document.createElement("div");
    sec.className = "review-item-section";
    sec.textContent = "\\u00a7 " + c.section;
    sec.addEventListener("click", () => {
      const heading = document.querySelector('#contentView [data-section="' + CSS.escape(c.section) + '"]');
      if (heading) heading.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    const text = document.createElement("div");
    text.className = "review-item-text";
    text.textContent = c.text;

    const meta = document.createElement("div");
    meta.className = "review-item-meta";
    const time = document.createElement("span");
    time.className = "review-item-time";
    const d = new Date(c.ts);
    time.textContent = d.toLocaleDateString("ko-KR", { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" });
    if (c.editedAt) time.textContent += " (edited)";
    meta.appendChild(time);

    item.appendChild(sec);
    item.appendChild(text);
    item.appendChild(meta);
    list.appendChild(item);
  });
}

/* --- Submit Review --- */
function initSubmitReview() {
  const btn = document.getElementById("submitReviewBtn");
  const status = document.getElementById("reviewStatus");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    status.textContent = "Submitting...";
    try {
      await fetch("/_api/submit-review", { method: "POST" });
      status.textContent = "Review submitted! You can close this tab.";
      btn.textContent = "Done";
    } catch {
      status.textContent = "Error submitting review";
      btn.disabled = false;
    }
  });
}

/* --- Auto Refresh --- */
(function autoRefresh() {
  let lastHash = null;
  async function check() {
    try {
      const res = await fetch(CONTENT_API);
      const { content } = await res.json();
      const hash = content.length + ":" + content.slice(0, 200) + content.slice(-200);
      if (lastHash === null) { lastHash = hash; return; }
      if (hash !== lastHash) {
        const scrollY = window.scrollY;
        sessionStorage.setItem("mdgate-scroll", scrollY);
        location.reload();
      }
    } catch {}
  }
  // Restore scroll position after reload
  const saved = sessionStorage.getItem("mdgate-scroll");
  if (saved) { window.scrollTo(0, parseInt(saved, 10)); sessionStorage.removeItem("mdgate-scroll"); }
  setInterval(check, 3000);
})();
</script>
</body>
</html>`;
}

export function indexTemplate(entries) {
  const items = entries.map((e) => {
    const dir = escapeHtml(e.baseDir);
    const slug = escapeHtml(e.slug);
    const file = escapeHtml(e.entryFile);
    const time = new Date(e.registeredAt).toLocaleString("ko-KR", { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" });
    return `<a href="/${slug}/" class="doc-card">
      <div class="doc-title">${file}</div>
      <div class="doc-dir">${dir}</div>
      <div class="doc-time">${time}</div>
    </a>`;
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5">
<title>mdgate</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  :root {
    --bg: #1a1b26; --fg: #c0caf5; --fg-dim: #565f89;
    --accent: #7aa2f7; --border: #292e42; --code-bg: #24283b;
    --link: #7dcfff;
  }
  html { font-size: 16px; }
  body {
    margin: 0; padding: 1rem; background: var(--bg); color: var(--fg);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    line-height: 1.7;
  }
  .container { max-width: 48rem; margin: 0 auto; padding: 0.5rem 0 3rem; }
  h1 { color: var(--accent); font-size: 1.4rem; margin-bottom: 0.3em; }
  .subtitle { color: var(--fg-dim); font-size: 0.85rem; margin-bottom: 1.5em; }
  .doc-list { display: flex; flex-direction: column; gap: 0.5em; }
  .doc-card {
    display: block; padding: 0.8em 1em;
    background: var(--code-bg); border: 1px solid var(--border);
    border-radius: 6px; text-decoration: none;
    transition: border-color 0.15s;
  }
  .doc-card:hover { border-color: var(--accent); }
  .doc-title { color: var(--link); font-size: 1rem; font-weight: 600; }
  .doc-dir { color: var(--fg-dim); font-size: 0.8rem; margin-top: 0.2em; }
  .doc-time { color: var(--fg-dim); font-size: 0.75rem; margin-top: 0.2em; }
  .empty { color: var(--fg-dim); font-size: 0.9rem; padding: 2em 0; text-align: center; }
</style>
</head>
<body>
<div class="container">
  <h1>mdgate</h1>
  <div class="subtitle">${entries.length} document${entries.length !== 1 ? "s" : ""} registered</div>
  <div class="doc-list">
    ${entries.length > 0 ? items : '<div class="empty">No documents registered. Run mdgate &lt;file.md&gt; to add one.</div>'}
  </div>
</div>
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
