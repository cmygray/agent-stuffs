import { resolve, dirname } from "node:path";
import { startServer } from "../server.js";
import { startZrok } from "../zrok.js";

export async function run(filePath, port, hosts, { shareEnabled, shareName }) {
  const running = await isServerRunning(port);

  if (running) {
    const slug = await registerWithRunningServer(filePath, port);
    console.log(`Registered: http://localhost:${port}/${slug}/`);
    for (const h of hosts) {
      console.log(`            http://${h}:${port}/${slug}/`);
    }
  } else {
    startServer(filePath, port, hosts);
    if (shareEnabled) {
      startZrok(port, shareName);
    }
  }
}

async function isServerRunning(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    const data = await res.json();
    return data.status === "ok";
  } catch {
    return false;
  }
}

async function registerWithRunningServer(filePath, port) {
  const absFile = resolve(filePath);
  const baseDir = dirname(absFile);
  const res = await fetch(`http://127.0.0.1:${port}/_api/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filePath: absFile, baseDir }),
  });
  const data = await res.json();
  return data.slug;
}
