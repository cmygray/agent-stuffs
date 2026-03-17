import { resolve, basename } from "node:path";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const STATE_DIR = resolve(process.env.HOME || "/tmp", ".mdgate");
const REGISTRY_FILE = resolve(STATE_DIR, "registry.json");

export function loadRegistry() {
  try {
    return JSON.parse(readFileSync(REGISTRY_FILE, "utf8"));
  } catch {
    return [];
  }
}

export function saveRegistry(entries) {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(REGISTRY_FILE, JSON.stringify(entries, null, 2) + "\n");
}

export function addEntry(filePath, baseDir) {
  const entries = loadRegistry();
  const name = basename(filePath, ".md");

  // Check if already registered (same absolute path)
  const absPath = resolve(filePath);
  const existing = entries.find((e) => e.filePath === absPath);
  if (existing) return existing.slug;

  // Generate unique slug
  let slug = name;
  let i = 2;
  while (entries.some((e) => e.slug === slug)) {
    slug = `${name}-${i++}`;
  }

  entries.push({
    slug,
    filePath: absPath,
    baseDir: resolve(baseDir),
    entryFile: basename(filePath),
    registeredAt: new Date().toISOString(),
  });
  saveRegistry(entries);
  return slug;
}

export function removeEntry(slug) {
  const entries = loadRegistry();
  const filtered = entries.filter((e) => e.slug !== slug);
  if (filtered.length === entries.length) return false;
  saveRegistry(filtered);
  return true;
}

export function clearRegistry() {
  saveRegistry([]);
}
