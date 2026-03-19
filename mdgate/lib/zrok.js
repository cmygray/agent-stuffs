import { spawn } from "node:child_process";

export function startZrok(port, name) {
  const args = ["share", "public", `http://localhost:${port}`, "--headless"];
  if (name) {
    args.push("--unique-name", name);
  }

  const zrok = spawn("zrok", args, { stdio: ["ignore", "pipe", "pipe"] });

  let started = false;
  zrok.stdout.on("data", (data) => {
    const line = data.toString();
    if (!started) {
      try {
        const info = JSON.parse(line);
        if (info.frontend_endpoints) {
          console.log(`\n  zrok:       ${info.frontend_endpoints[0]}`);
          started = true;
        }
      } catch {
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

  process.on("SIGTERM", () => zrok.kill());
  process.on("SIGINT", () => zrok.kill());
}
