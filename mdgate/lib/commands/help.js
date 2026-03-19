import { loadConfig } from "../config.js";

export function run() {
  const config = loadConfig();
  console.log(`mdgate — Serve markdown files as mobile-friendly web pages

Usage:
  mdgate <file.md>                  Register and serve a markdown file
  mdgate review <file.md>           Serve for review, block until submitted
  mdgate --daemon                   Start server without a document (background mode)
  mdgate --init <host1> [host2...]  Set Tailscale hostnames
  mdgate --stop                     Stop the running server
  mdgate --status                   Check server status

Options:
  -p, --port <port>        Port to listen on (default: ${config.port})
  --share[=name]           Expose via zrok (optional fixed name)
  -h, --help               Show this help

Documents persist across server restarts.
Remove documents from the web dashboard at http://localhost:${config.port}/

Config: ~/.mdgate/config.json`);
}
