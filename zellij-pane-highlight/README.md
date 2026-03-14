# zellij-pane-highlight

Claude Code 세션이 사용자 입력을 기다릴 때 해당 pane 테두리를 하이라이트하는 Zellij WASM 플러그인.

## How it works

1. Claude Code의 `Notification` hook이 `zellij pipe`로 하이라이트 요청
2. 플러그인이 `highlight_and_unhighlight_panes` API로 pane 테두리 강조
3. 사용자가 해당 pane에 포커스하면 자동으로 하이라이트 해제

## Protocol

```bash
# 하이라이트
zellij pipe --name "zellij-pane-highlight::highlight::$ZELLIJ_PANE_ID"

# 하이라이트 해제
zellij pipe --name "zellij-pane-highlight::unhighlight::$ZELLIJ_PANE_ID"
```

## Build

```bash
rustup target add wasm32-wasip1
cargo build --release --target wasm32-wasip1
```

## Install

```bash
cp target/wasm32-wasip1/release/zellij-pane-highlight.wasm ~/.local/share/zellij/plugins/
```

`config.kdl`에 추가:

```kdl
load_plugins {
    "file:~/.local/share/zellij/plugins/zellij-pane-highlight.wasm"
}
```

## Claude Code hooks

```json
{
  "hooks": {
    "Notification": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "sh -c 'test -n \"$ZELLIJ\" && zellij pipe --name \"zellij-pane-highlight::highlight::$ZELLIJ_PANE_ID\"'"
      }]
    }],
    "Stop": [{
      "hooks": [{
        "type": "command",
        "command": "sh -c 'test -n \"$ZELLIJ\" && zellij pipe --name \"zellij-pane-highlight::unhighlight::$ZELLIJ_PANE_ID\"'"
      }]
    }]
  }
}
```
