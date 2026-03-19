import { resolve } from "node:path";
import { existsSync, readFileSync, unlinkSync } from "node:fs";

export function run() {
  const pidFile = resolve(process.env.HOME || "/tmp", ".mdgate", "server.pid");
  if (existsSync(pidFile)) {
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
}
