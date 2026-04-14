# zlqhem — Terminal bilingual input (키보드)
# Usage: source /path/to/zlqhem.zsh
# Toggle: Ctrl+] to activate/deactivate
# Default: inactive (space key works normally)

export ZLQHEM_ACTIVE=0
ZLQHEM_SOCK="/tmp/zlqhem.sock"
ZLQHEM_PID="/tmp/zlqhem.pid"

# ── Daemon lifecycle ──────────────────────────────────────────

zlqhem-start() {
  if [[ -S "$ZLQHEM_SOCK" ]]; then
    echo "zlqhem daemon already running"
    return 0
  fi
  python3 -m zlqhem daemon &>/dev/null &
  disown
  # Wait for socket
  local i=0
  while [[ ! -S "$ZLQHEM_SOCK" ]] && (( i < 30 )); do
    sleep 0.1
    (( i++ ))
  done
  if [[ -S "$ZLQHEM_SOCK" ]]; then
    echo "zlqhem daemon started"
  else
    echo "zlqhem daemon failed to start" >&2
  fi
}

zlqhem-stop() {
  if [[ -f "$ZLQHEM_PID" ]]; then
    kill "$(cat "$ZLQHEM_PID")" 2>/dev/null
    echo "zlqhem daemon stopped"
  else
    echo "zlqhem daemon not running"
  fi
}

zlqhem-status() {
  if [[ -S "$ZLQHEM_SOCK" ]]; then
    echo "daemon: running ($(cat "$ZLQHEM_PID" 2>/dev/null || echo '?'))"
  else
    echo "daemon: stopped"
  fi
  if (( ZLQHEM_ACTIVE )); then
    echo "input:  active [키]"
  else
    echo "input:  inactive"
  fi
}

# ── Socket communication ─────────────────────────────────────

zlqhem-convert-word() {
  local result
  # socat with 100ms timeout; fall back to original on failure
  if command -v socat &>/dev/null; then
    result=$(echo -n "$1" | socat -t0.1 - UNIX-CONNECT:"$ZLQHEM_SOCK" 2>/dev/null)
  else
    # Fallback: use python directly (slower, ~100ms)
    result=$(python3 -c "from zlqhem.classify import classify_word; print(classify_word('$1'), end='')" 2>/dev/null)
  fi
  if [[ $? -ne 0 || -z "$result" ]]; then
    echo -n "$1"  # Safety: return original on any failure
  else
    echo -n "$result"
  fi
}

# ── ZLE widgets ──────────────────────────────────────────────

zlqhem-space() {
  if (( ! ZLQHEM_ACTIVE )); then
    zle self-insert
    return
  fi

  # Extract last word from LBUFFER
  local last_word="${LBUFFER##* }"
  local prefix="${LBUFFER% *}"

  if [[ -n "$last_word" && "$last_word" != "$LBUFFER" ]]; then
    # There's a prefix before the last word
    local converted=$(zlqhem-convert-word "$last_word")
    LBUFFER="$prefix $converted"
  elif [[ -n "$last_word" ]]; then
    # Only one word in buffer
    local converted=$(zlqhem-convert-word "$last_word")
    LBUFFER="$converted"
  fi

  LBUFFER+=" "
}
zle -N zlqhem-space

zlqhem-toggle() {
  if (( ZLQHEM_ACTIVE )); then
    export ZLQHEM_ACTIVE=0
    bindkey ' ' self-insert
  else
    # Auto-start daemon if not running
    if [[ ! -S "$ZLQHEM_SOCK" ]]; then
      zlqhem-start
    fi
    export ZLQHEM_ACTIVE=1
    bindkey ' ' zlqhem-space
  fi
  zle reset-prompt
}
zle -N zlqhem-toggle
bindkey $'\x1d' zlqhem-toggle

# ── Prompt indicator ─────────────────────────────────────────

zlqhem-prompt-info() {
  if (( ZLQHEM_ACTIVE )); then
    echo -n "[키]"
  fi
}
