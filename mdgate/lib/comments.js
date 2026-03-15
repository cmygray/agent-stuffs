import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function commentsPath(mdAbsPath) {
  return mdAbsPath + ".comments.json";
}

export function loadComments(mdAbsPath) {
  const p = commentsPath(mdAbsPath);
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return [];
  }
}

export function addComment(mdAbsPath, { section, text }) {
  const comments = loadComments(mdAbsPath);
  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    section,
    text,
    ts: new Date().toISOString(),
  };
  comments.push(entry);
  writeFileSync(commentsPath(mdAbsPath), JSON.stringify(comments, null, 2) + "\n");
  return entry;
}

export function deleteComment(mdAbsPath, commentId) {
  const comments = loadComments(mdAbsPath);
  const filtered = comments.filter((c) => c.id !== commentId);
  if (filtered.length === comments.length) return false;
  writeFileSync(commentsPath(mdAbsPath), JSON.stringify(filtered, null, 2) + "\n");
  return true;
}
