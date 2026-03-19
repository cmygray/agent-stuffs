# Quick Start

## 셋업 (1회)

```bash
# 1. PATH에 추가 (shell rc에)
echo 'export PATH="$HOME/Workspace/agent-stuffs/orchestrator/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# 2. 의존성 확인
claude --version   # Claude Code CLI
jq --version       # JSON 처리
git --version
```

## 새 프로젝트에서 사용

```bash
cd your-project

# 1. plan 구조 생성
orch-init

# 2. plan.md 편집 — TOC 작성
vi .orch/plan/plan.md

# 3. unit 문서 작성 (템플릿 참고)
cp ~/Workspace/agent-stuffs/orchestrator/templates/unit.md.tmpl .orch/plan/units/unit-01.md
vi .orch/plan/units/unit-01.md

# 4. 실행
orch-worker .orch/plan/units/unit-01.md     # 구현
orch-verify .orch/plan/units/unit-01.md     # 검증
orch-finalize .orch/plan/units/unit-01.md   # 커밋 + 병합
```

## 사이클 요약

```
orch-worker   →  worktree에서 코드 구현 (opus)
orch-verify   →  tsc/lint/test 검증 (sonnet)
orch-finalize →  커밋 + rebase + ff-only merge + plan 업데이트
```

## 실패 시

```bash
# plan.md에서 해당 unit 상태를 [ ]로 되돌리고 재실행
# (vi로 [!] → [ ] 수정)
orch-worker .orch/plan/units/unit-XX.md
```

## feature 브랜치에서 작업

```bash
git checkout -b feature/my-feature
# orch-finalize가 현재 브랜치로 병합 (main 아닌 feature 브랜치)
```

## 환경변수

```bash
# Worker를 sonnet으로 변경
WORKER_MODEL=sonnet orch-worker .orch/plan/units/unit-01.md

# plan 디렉토리 변경
PLAN_DIR=docs/plan orch-worker docs/plan/units/unit-01.md
```
