#!/usr/bin/env node

import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { loadConfig } from "../lib/config.js";

const args = process.argv.slice(2);
const config = loadConfig();

// --- Route to command ---

if (args.includes("--help") || args.includes("-h") || args.length === 0) {
  const { run } = await import("../lib/commands/help.js");
  run();
  process.exit(0);
}

if (args.includes("--init")) {
  const { run } = await import("../lib/commands/init.js");
  run(args);
  process.exit(0);
}

if (args.includes("--stop")) {
  const { run } = await import("../lib/commands/stop.js");
  run();
  process.exit(0);
}

if (args.includes("--status")) {
  const { run } = await import("../lib/commands/status.js");
  run();
  process.exit(0);
}

// --- Parse shared options ---

const isReview = args[0] === "review";
const isDaemon = args.includes("--daemon");
const effectiveArgs = isReview ? args.slice(1) : args;

let port = config.port;
let filePath = null;
let shareName = null;
let shareEnabled = false;

for (let i = 0; i < effectiveArgs.length; i++) {
  if ((effectiveArgs[i] === "-p" || effectiveArgs[i] === "--port") && effectiveArgs[i + 1]) {
    port = parseInt(effectiveArgs[i + 1], 10);
    i++;
  } else if (effectiveArgs[i] === "--share") {
    shareEnabled = true;
  } else if (effectiveArgs[i].startsWith("--share=")) {
    shareEnabled = true;
    shareName = effectiveArgs[i].replace("--share=", "");
  } else if (!effectiveArgs[i].startsWith("-")) {
    filePath = resolve(effectiveArgs[i]);
  }
}

// --- Dispatch ---

if (isDaemon) {
  const { run } = await import("../lib/commands/daemon.js");
  run(port, config.hosts, { shareEnabled, shareName });
} else if (!filePath) {
  console.error("Error: No markdown file specified");
  process.exit(1);
} else if (!existsSync(filePath)) {
  console.error(`Error: File not found: ${filePath}`);
  process.exit(1);
} else if (isReview) {
  const { run } = await import("../lib/commands/review.js");
  await run(filePath, port, config.hosts);
} else {
  const { run } = await import("../lib/commands/serve.js");
  await run(filePath, port, config.hosts, { shareEnabled, shareName });
}
