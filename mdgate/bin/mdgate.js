#!/usr/bin/env node

import { resolve, dirname, basename } from "node:path";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { spawn } from "node:child_process";
import { startServer } from "../lib/server.js";
import { loadConfig, initConfig } from "../lib/config.js";
import { clearRegistry } from "../lib/registry.js";

const args = process.argv.slice(2);

const config = loadConfig();

if (args.includes("--help") || args.includes("-h") || args.length === 0) {
  console.log(`mdgate — Serve markdown files as mobile-friendly web pages

Usage:
  mdgate <file.md>                  Serve / register a markdown file
  mdgate review <file.md>           Serve for review, block until submitted
  mdgate --init <host1> [host2...]  Set Tailscale hostnames
  mdgate --stop                     Stop the running server
  mdgate --status                   Check server status

Options:
  -p, --port <port>        Port to listen on (default: ${config.port})
  --share[=name]           Expose via zrok (optional fixed name)
  -h, --help               Show this help

Config: ~/.mdgate/config.json`);
  process.exit(0);
}

if (args.includes("--init")) {
  const hosts = args.filter((a) => !a.startsWith("-") && args.indexOf(a) > args.indexOf("--init"));
  if (hosts.length === 0) {
    console.error("Usage: mdgate --init <host1> [host2...]");
    process.exit(1);
  }
  initConfig(hosts);
  process.exit(0);
}

if (args.includes("--stop")) {
  const pidFile = resolve(process.env.HOME || "/tmp", ".mdgate", "server.pid");
  if (existsSync(pidFile)) {
    const pid = parseInt(readFileSync(pidFile, "utf8").trim(), 10);
    try {
      process.kill(pid, "SIGTERM");
      unlinkSync(pidFile);
      clearRegistry();
      console.log(`Stopped mdgate server (pid ${pid})`);
    } catch {
      unlinkSync(pidFile);
      clearRegistry();
      console.log("Server was not running (stale pid file removed)");
    }
  } else {
    console.log("No mdgate server is running");
  }
  process.exit(0);
}

if (args.includes("--status")) {
  const pidFile = resolve(process.env.HOME || "/tmp", ".mdgate", "server.pid");
  if (existsSync(pidFile)) {
    const pid = parseInt(readFileSync(pidFile, "utf8").trim(), 10);
    try {
      process.kill(pid, 0);
      console.log(`mdgate server is running (pid ${pid})`);
    } catch {
      console.log("mdgate server is not running (stale pid file)");
    }
  } else {
    console.log("No mdgate server is running");
  }
  process.exit(0);
}

const isReview = args[0] === "review";
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

if (!filePath) {
  console.error("Error: No markdown file specified");
  process.exit(1);
}

if (!existsSync(filePath)) {
  console.error(`Error: File not found: ${filePath}`);
  process.exit(1);
}

// Check if server is already running
async function isServerRunning() {
  try {
    const res = await fetch(`http://localhost:${port}/health`);
    const data = await res.json();
    return data.status === "ok";
  } catch {
    return false;
  }
}

async function registerWithRunningServer() {
  const absFile = resolve(filePath);
  const baseDir = dirname(absFile);
  const res = await fetch(`http://localhost:${port}/_api/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filePath: absFile, baseDir }),
  });
  const data = await res.json();
  return data.slug;
}

if (isReview) {
  const { server, reviewPromise } = startServer(filePath, port, config.hosts, { reviewMode: true });
  const comments = await reviewPromise;
  console.log(JSON.stringify(comments, null, 2));
  server.close();
  process.exit(0);
} else if (await isServerRunning()) {
  // Server already running — just register the new doc
  const slug = await registerWithRunningServer();
  console.log(`Registered: http://localhost:${port}/${slug}/`);
  if (config.hosts.length) {
    for (const h of config.hosts) {
      console.log(`            http://${h}:${port}/${slug}/`);
    }
  }
} else {
  // Start new server
  startServer(filePath, port, config.hosts);

  if (shareEnabled) {
    startZrok(port, shareName);
  }
}

function startZrok(port, name) {
  const args = ["share", "public", `http://localhost:${port}`, "--headless"];
  if (name) {
    args.push("--unique-name", name);
  }

  const zrok = spawn("zrok", args, { stdio: ["ignore", "pipe", "pipe"] });

  let started = false;
  zrok.stdout.on("data", (data) => {
    const line = data.toString();
    // zrok headless outputs JSON with the share URL
    if (!started) {
      try {
        const info = JSON.parse(line);
        if (info.frontend_endpoints) {
          console.log(`\n  zrok:       ${info.frontend_endpoints[0]}`);
          started = true;
        }
      } catch {
        // Not JSON yet, try to extract URL
        const urlMatch = line.match(/https?:\/\/[^\s]+\.zrok\.[^\s]+/);
        if (urlMatch) {
          console.log(`\n  zrok:       ${urlMatch[0]}`);
          started = true;
        }
      }
    }
  });

  zrok.stderr.on("data", (data) => {
    const msg = data.toString().trim();
    if (msg) console.error(`  zrok:       ${msg}`);
  });

  zrok.on("error", (err) => {
    console.error(`  zrok error: ${err.message}`);
  });

  zrok.on("close", (code) => {
    if (code !== 0 && code !== null) {
      console.error(`  zrok exited with code ${code}`);
    }
  });

  // Clean up zrok on process exit
  process.on("SIGTERM", () => zrok.kill());
  process.on("SIGINT", () => zrok.kill());
}
