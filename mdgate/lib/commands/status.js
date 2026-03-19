import { resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";

export function run() {
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
}
