import { resolve } from "node:path";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const CONFIG_DIR = resolve(process.env.HOME || "/tmp", ".mdgate");
const CONFIG_FILE = resolve(CONFIG_DIR, "config.json");

const DEFAULTS = {
  port: 9483,
  hosts: [],
};

export function loadConfig() {
  try {
    const raw = JSON.parse(readFileSync(CONFIG_FILE, "utf8"));
    return { ...DEFAULTS, ...raw };
  } catch {
    return { ...DEFAULTS };
  }
}

export function initConfig(hosts) {
  mkdirSync(CONFIG_DIR, { recursive: true });
  const config = { ...DEFAULTS, hosts };
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n");
  console.log(`Config written to ${CONFIG_FILE}`);
  return config;
}
