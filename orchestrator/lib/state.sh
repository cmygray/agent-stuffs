#!/bin/bash
# orchestrator/lib/state.sh — worktree 경로 등 런타임 상태 관리

# common.sh가 먼저 source 되어 있어야 함

# worktree 경로 저장
save_worktree_path() {
  local unit_id="$1"
  local worktree_path="$2"
  echo "$worktree_path" > "${STATE_DIR}/${unit_id}.worktree"
}

# worktree 경로 읽기
# Returns: worktree path or empty string
load_worktree_path() {
  local unit_id="$1"
  local state_file="${STATE_DIR}/${unit_id}.worktree"
  if [ -f "$state_file" ]; then
    cat "$state_file"
  fi
}

# worktree 상태 파일 삭제
remove_worktree_state() {
  local unit_id="$1"
  rm -f "${STATE_DIR}/${unit_id}.worktree"
}

# Worker 실행 전후 worktree 스냅샷 비교로 새 worktree 탐지
# Usage:
#   before=$(snapshot_worktrees)
#   ... run worker ...
#   detect_new_worktree "$before"
snapshot_worktrees() {
  ls -d .claude/worktrees/*/ 2>/dev/null | sort || true
}

detect_new_worktree() {
  local before="$1"
  local after
  after=$(snapshot_worktrees)
  if [ -n "$after" ]; then
    if [ -n "$before" ]; then
      comm -13 <(echo "$before") <(echo "$after") | head -1
    else
      echo "$after" | head -1
    fi
  fi
}
