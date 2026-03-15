#!/usr/bin/env node

import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { startServer } from "../lib/server.js";
import { loadConfig, initConfig } from "../lib/config.js";

const args = process.argv.slice(2);

const config = loadConfig();

if (args.includes("--help") || args.includes("-h") || args.length === 0) {
  console.log(`mdgate — Serve markdown files as mobile-friendly web pages

Usage:
  mdgate <file.md>                  Serve a markdown file
  mdgate --init <host1> [host2...]  Set Tailscale hostnames
  mdgate --stop                     Stop the running server
  mdgate --status                   Check server status

Options:
  -p, --port <port>        Port to listen on (default: ${config.port})
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
  const pidFile = resolve(
    process.env.HOME || "/tmp",
    ".mdgate",
    "server.pid",
  );
  if (existsSync(pidFile)) {
    const { readFileSync, unlinkSync } = await import("node:fs");
    const pid = parseInt(readFileSync(pidFile, "utf8").trim(), 10);
    try {
      process.kill(pid, "SIGTERM");
      unlinkSync(pidFile);
      console.log(`Stopped mdgate server (pid ${pid})`);
    } catch {
      unlinkSync(pidFile);
      console.log("Server was not running (stale pid file removed)");
    }
  } else {
    console.log("No mdgate server is running");
  }
  process.exit(0);
}

if (args.includes("--status")) {
  const pidFile = resolve(
    process.env.HOME || "/tmp",
    ".mdgate",
    "server.pid",
  );
  if (existsSync(pidFile)) {
    const { readFileSync } = await import("node:fs");
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

let port = config.port;
let filePath = null;

for (let i = 0; i < args.length; i++) {
  if ((args[i] === "-p" || args[i] === "--port") && args[i + 1]) {
    port = parseInt(args[i + 1], 10);
    i++;
  } else if (!args[i].startsWith("-")) {
    filePath = resolve(args[i]);
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

startServer(filePath, port, config.hosts);
