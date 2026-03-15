#!/bin/bash
# orchestrator/lib/common.sh — 공용 유틸리티

set -euo pipefail

# 오케스트레이터 루트 디렉토리 (이 파일 기준)
ORCH_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# 프로젝트 루트 디렉토리 (오케스트레이터 사용 프로젝트)
PROJECT_ROOT="${PROJECT_ROOT:-$(pwd)}"

# plan 디렉토리 (프로젝트 내)
PLAN_DIR="${PROJECT_ROOT}/docs/plan"
STATE_DIR="${PLAN_DIR}/.state"
PLAN_FILE="${PLAN_DIR}/plan.md"

# 타임스탬프
timestamp() {
  date '+%Y-%m-%d %H:%M'
}

# Unit 파일에서 ID 추출 (unit-01, unit-02, ...)
unit_id() {
  basename "$1" .md
}

# Unit ID에서 번호 추출 (01, 02, 02a, ...)
unit_num() {
  echo "$1" | sed 's/unit-//'
}

# Unit 파일에서 제목 추출
unit_title() {
  head -1 "$1" | sed 's/^# //'
}

# structured_output 추출 (claude CLI JSON 응답에서)
extract_structured_output() {
  local result="$1"
  local fallback="$2"
  local output
  output=$(echo "$result" | jq '.structured_output // empty')
  if [ -z "$output" ]; then
    echo "$fallback"
  else
    echo "$output"
  fi
}

# session ID 추출
extract_session_id() {
  echo "$1" | jq -r '.session_id // "unknown"'
}

# Unit 파일 끝에 결과 섹션 추가
append_result_section() {
  local unit_file="$1"
  local section_name="$2"
  local result_json="$3"
  local ts
  ts=$(timestamp)

  cat >> "$unit_file" << EOF

### ${section_name} (${ts})
\`\`\`json
$(echo "$result_json" | jq '.')
\`\`\`
EOF
}

# plan.md 상태 업데이트
# Usage: update_plan_status "01" "[~]" "[x]"
update_plan_status() {
  local unit_num="$1"
  local from="$2"
  local to="$3"

  # macOS/BSD sed와 GNU sed 호환
  if sed --version 2>/dev/null | grep -q GNU; then
    sed -i "s/\(^| ${unit_num} |.*\)$(echo "$from" | sed 's/\[/\\[/g; s/\]/\\]/g')/\1${to}/" "$PLAN_FILE"
  else
    sed -i '' "s/\(^| ${unit_num} |.*\)$(echo "$from" | sed 's/\[/\\[/g; s/\]/\\]/g')/\1${to}/" "$PLAN_FILE"
  fi
}

# 상태 디렉토리 초기화
ensure_state_dir() {
  mkdir -p "$STATE_DIR"
}
