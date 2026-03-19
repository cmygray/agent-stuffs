#!/bin/bash
# orchestrator/lib/deps.sh — 의존성 그래프 파싱 및 검증

# common.sh가 먼저 source 되어 있어야 함

# Unit 파일에서 의존성 목록 추출
# Returns: comma-separated dep numbers (e.g., "01,02") or "-" if none
parse_deps() {
  local unit_file="$1"
  local deps
  deps=$(grep "^| Deps |" "$unit_file" | sed 's/.*| //' | sed 's/ |$//' | tr -d ' ')
  echo "${deps:--}"
}

# 선행 Unit 의존성 충족 여부 확인
# 충족되지 않으면 에러 메시지 출력 후 exit 1
check_deps() {
  local unit_file="$1"
  local unit_id
  unit_id=$(unit_id "$unit_file")

  local deps
  deps=$(parse_deps "$unit_file")

  if [ "$deps" = "-" ] || [ -z "$deps" ]; then
    return 0
  fi

  local unit_num
  unit_num=$(unit_num "$unit_id")

  if [ "$deps" = "all" ]; then
    # "all"이면 현재 unit 제외 모든 unit이 [x]인지 확인
    local not_done
    not_done=$(grep "^| [0-9]" "$PLAN_FILE" | grep -v "| ${unit_num} |" | grep -v '\[x\]' | head -1 || true)
    if [ -n "$not_done" ]; then
      echo "ERROR: Not all units completed. Blocked by: ${not_done}"
      exit 1
    fi
    return 0
  fi

  IFS=',' read -ra DEP_LIST <<< "$deps"
  for dep in "${DEP_LIST[@]}"; do
    dep=$(echo "$dep" | tr -d ' ' | sed 's/Unit//')
    local dep_status
    dep_status=$(grep "^| ${dep} |" "$PLAN_FILE" | grep -o '\[.\]' | tail -1)
    if [ "$dep_status" != "[x]" ]; then
      echo "ERROR: Dependency Unit ${dep} is not completed (status: ${dep_status}). Cannot start ${unit_id}."
      exit 1
    fi
  done
}

# 선행 Unit들의 decisions를 수집
# Returns: decisions 텍스트 (비어 있으면 빈 문자열)
collect_prior_decisions() {
  if [ -f "${STATE_DIR}/decisions.log" ]; then
    echo "
---
Prior Unit Decisions (선행 Unit에서 내린 기술적 결정들):
$(cat "${STATE_DIR}/decisions.log")
---"
  fi
}

# decisions를 축적 로그에 기록
record_decisions() {
  local unit_id="$1"
  local result_json="$2"
  local decisions
  decisions=$(echo "$result_json" | jq -r '.decisions[]' 2>/dev/null)
  if [ -n "$decisions" ]; then
    echo "" >> "${STATE_DIR}/decisions.log"
    echo "## ${unit_id}" >> "${STATE_DIR}/decisions.log"
    echo "$decisions" | while read -r line; do
      echo "- ${line}" >> "${STATE_DIR}/decisions.log"
    done
  fi
}

# 특정 unit의 decisions 읽기 (커밋 메시지용)
# Returns: decisions 텍스트 (없으면 빈 문자열)
read_unit_decisions() {
  local unit_id="$1"
  if [ ! -f "${STATE_DIR}/decisions.log" ]; then
    return
  fi
  # unit_id 헤더부터 다음 헤더(또는 EOF)까지 추출
  sed -n "/^## ${unit_id}$/,/^## /{ /^## ${unit_id}$/d; /^## /d; p; }" "${STATE_DIR}/decisions.log"
}
