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

# Worktree를 수동 생성
# remote default branch에서 분기, 없으면 로컬 HEAD fallback
# Usage: create_worktree <unit_id>
# Sets: WORKTREE_PATH (absolute path)
create_worktree() {
  local unit_id="$1"
  local worktree_dir="${WORKTREE_BASE}/${unit_id}-$(date +%s)"
  local branch_name="${unit_id}-branch"

  local base_ref
  base_ref=$(git rev-parse --verify origin/main 2>/dev/null \
    || git rev-parse --verify origin/master 2>/dev/null \
    || git rev-parse HEAD)

  local base_label
  if git rev-parse --verify origin/main >/dev/null 2>&1; then
    base_label="origin/main"
  elif git rev-parse --verify origin/master >/dev/null 2>&1; then
    base_label="origin/master"
  else
    base_label="local HEAD"
  fi
  echo "Base ref: ${base_ref} (${base_label})"

  mkdir -p "$WORKTREE_BASE"
  git worktree add -b "$branch_name" "$worktree_dir" "$base_ref"

  WORKTREE_PATH=$(cd "$worktree_dir" && pwd)
  save_worktree_path "$unit_id" "$WORKTREE_PATH"
  echo "Worktree: ${WORKTREE_PATH}"
}
