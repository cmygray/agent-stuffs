# mdgate

Serve markdown files as mobile-friendly web pages over [Tailscale](https://tailscale.com).

Built for reading documents generated during CLI sessions (e.g. Claude Code) from a mobile device connected via Tailscale.

## Features

- Dark theme optimized for mobile reading
- Directory-based serving with relative link support
- GFM markdown with syntax highlighting (highlight.js)
- Per-heading inline comments (stored as sidecar `.comments.json` files)
- Tailscale CGNAT IP filtering (localhost + `100.64.0.0/10` only)
- Path traversal protection
- Allowlisted file types only (`.md`, `.json`, `.txt`, `.yaml`)

## Install

```bash
npm install -g mdgate
```

Or clone and link:

```bash
git clone https://github.com/cmygray/mdgate.git
cd mdgate
npm install
npm link
```

## Setup

Register your Tailscale Magic DNS hostnames (stored in `~/.mdgate/config.json`):

```bash
mdgate --init myhost.tailnet-name.ts.net
```

## Usage

```bash
mdgate docs/plan.md          # serve a markdown file (port 9483)
mdgate -p 8080 notes.md      # custom port
mdgate --stop                # stop the server
mdgate --status              # check if running
```

Then open `http://<your-tailscale-host>:9483` from your mobile browser.

Linked markdown files (e.g. `[Unit 01](units/unit-01.md)`) are navigable. Comments can be added per heading section via the `[+]` button.

## Security

- Binds to `0.0.0.0` but rejects connections outside Tailscale CGNAT range and localhost
- No secrets in source code; hostnames stored only in local config (`~/.mdgate/`)
- Comment writes are restricted to `.md`-adjacent sidecar files within the served directory

## License

ISC
