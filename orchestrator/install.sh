#!/bin/bash
set -euo pipefail

# orchestrator 설치 스크립트
#
# Usage:
#   curl -sL <raw-url>/orchestrator/install.sh | bash
#   curl -sL <raw-url>/orchestrator/install.sh | bash -s -- [options]
#
# Options:
#   --dir <path>      설치 디렉토리 (기본: .orchestrator)
#   --plan <path>     plan scaffold 경로 (기본: docs/plan)
#   --no-scaffold     plan scaffold 생략
#   --branch <name>   다운로드할 브랜치 (기본: main)

REPO="cmygray/agentic-tools"
BRANCH="main"
INSTALL_DIR=".orchestrator"
PLAN_DIR="docs/plan"
SCAFFOLD=true

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dir)      INSTALL_DIR="$2"; shift 2 ;;
    --plan)     PLAN_DIR="$2"; shift 2 ;;
    --no-scaffold) SCAFFOLD=false; shift ;;
    --branch)   BRANCH="$2"; shift 2 ;;
    *)          echo "Unknown option: $1"; exit 1 ;;
  esac
done

echo "=== orchestrator install ==="

# 1. 이미 설치된 경우 확인
if [ -d "$INSTALL_DIR" ]; then
  echo "ERROR: ${INSTALL_DIR}/ already exists. Remove it first or use --dir to specify a different path."
  exit 1
fi

# 2. 다운로드
echo "Downloading from ${REPO}@${BRANCH}..."
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

curl -sL "https://github.com/${REPO}/archive/${BRANCH}.tar.gz" -o "${TMPDIR}/archive.tar.gz"

# 3. orchestrator 디렉토리만 추출
REPO_NAME=$(echo "$REPO" | cut -d'/' -f2)
mkdir -p "$INSTALL_DIR"
tar xzf "${TMPDIR}/archive.tar.gz" \
  --strip-components=2 \
  -C "$INSTALL_DIR" \
  "${REPO_NAME}-${BRANCH}/orchestrator"

# 4. 실행 권한 부여
chmod +x "${INSTALL_DIR}/bin/"*

echo "Installed to ${INSTALL_DIR}/"

# 5. plan scaffold
if [ "$SCAFFOLD" = true ]; then
  if [ -f "${PLAN_DIR}/plan.md" ]; then
    echo "Skipping scaffold: ${PLAN_DIR}/plan.md already exists."
  else
    "${INSTALL_DIR}/bin/orch-init" "$PLAN_DIR"
  fi
fi

# 6. 안내
cat << EOF

=== Setup complete ===

Add to your shell rc (~/.zshrc, ~/.bashrc):
  export PATH="\$(pwd)/${INSTALL_DIR}/bin:\$PATH"

Or use absolute path:
  export PATH="$(cd "$INSTALL_DIR" && pwd)/bin:\$PATH"

Quick start:
  1. Edit ${PLAN_DIR}/plan.md
  2. Create unit files in ${PLAN_DIR}/units/
  3. orch-worker ${PLAN_DIR}/units/unit-01.md

Configuration (environment variables):
  WORKER_MODEL=opus        VERIFIER_MODEL=sonnet
  FINALIZER_MODEL=sonnet   WORKTREE_BASE=.claude/worktrees
  PLAN_DIR=${PLAN_DIR}

EOF
