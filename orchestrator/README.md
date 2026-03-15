# orchestrator

Claude Code CLI 기반 3단계 에이전트 오케스트레이션 도구.

큰 작업을 Unit으로 분해하고, **Worker → Verifier → Finalizer** 파이프라인으로 실행합니다. 각 Unit은 격리된 git worktree에서 구현되며, 검증을 거쳐 main 브랜치에 병합됩니다.

## 핵심 개념

### Unit

하나의 독립적인 구현 단위입니다. 충분히 작아서 에이전트가 한 번에 구현할 수 있고, 충분히 커서 의미 있는 기능 단위가 되어야 합니다.

각 Unit은 마크다운 문서(`unit-XX.md`)로 정의되며, 다음 섹션으로 구성됩니다:

| 섹션 | 목적 |
|------|------|
| **Meta** | 범위(Scope), 의존성(Deps), 브랜치명 |
| **Spec** | Worker에게 전달할 구현 명세. 무엇을 만들어야 하는지 구체적으로 기술 |
| **Verification** | Verifier가 실행할 검증 커맨드 목록 (tsc, lint, test 등) |
| **Context Files** | Worker가 구현 전에 읽어야 할 파일 경로 |
| **Constraints** | 지켜야 할 제약 조건 (수정 금지 파일, 패턴 등) |
| **Result / Verify** | 오케스트레이터가 자동으로 채우는 실행 결과 |

### Plan

전체 작업의 로드맵입니다. `plan.md` 파일에 의존성 그래프와 TOC(상태 테이블)가 정의됩니다. 오케스트레이터 스크립트가 이 파일의 상태 마커를 자동으로 업데이트합니다.

### Decisions

Worker가 구현 중 내린 기술적 결정들입니다. `.state/decisions.log`에 Unit별로 누적되며, 후속 Unit의 Worker에게 컨텍스트로 전달됩니다. 이를 통해 선행 Unit의 기술적 맥락이 유실되지 않습니다.

## 구조

```
orchestrator/
├── bin/                  # 실행 스크립트
│   ├── orch-worker       # Unit spec 구현 (격리된 worktree)
│   ├── orch-verify       # 구현 결과 검증 (코드 수정 없음)
│   └── orch-finalize     # 커밋, rebase, ff-only merge, 정리
├── schemas/              # 에이전트 출력 JSON Schema
│   ├── worker-output.json
│   ├── verifier-output.json
│   └── finalizer-output.json
├── templates/            # plan/unit 문서 템플릿
│   ├── plan.md.tmpl
│   └── unit.md.tmpl
└── lib/                  # 공용 셸 라이브러리
    ├── common.sh         # 유틸리티 (경로, 타임스탬프, 결과 추출)
    ├── deps.sh           # 의존성 그래프 파싱 및 검증
    └── state.sh          # worktree 경로 등 런타임 상태 관리
```

## 파이프라인

```
Worker (opus)           Verifier (sonnet)        Finalizer (sonnet)
┌───────────────┐      ┌───────────────┐        ┌───────────────┐
│ Unit spec을    │      │ Verification  │        │ git commit    │
│ worktree에서   │ ──→  │ 테이블의 체크  │  ──→   │ rebase main   │
│ 구현           │      │ 커맨드 실행    │        │ ff-only merge │
└───────────────┘      └───────────────┘        └───────────────┘
  ↓ 출력                  ↓ 출력                   ↓ 출력
  worker-output.json      verifier-output.json     finalizer-output.json
```

각 에이전트는 `claude -p`로 실행되며, `--json-schema`로 구조화된 출력을 강제합니다. `--output-format json` 응답에서 `.structured_output` 필드를 추출하여 파이프라인 상태를 관리합니다.

## 의존성

- [claude](https://docs.anthropic.com/en/docs/claude-code) — Claude Code CLI
- [jq](https://jqlang.github.io/jq/) — JSON 처리
- git — worktree, rebase, merge

## 사용법

### 1. 프로젝트에 plan 구조 생성

`templates/`를 참고하여 프로젝트에 아래 구조를 만듭니다:

```
your-project/
└── docs/plan/
    ├── plan.md              # plan.md.tmpl 기반
    ├── units/
    │   ├── unit-01.md       # unit.md.tmpl 기반
    │   ├── unit-02.md
    │   └── ...
    └── .state/              # 자동 생성됨
        ├── decisions.log    # 기술적 결정 누적
        └── unit-XX.worktree # worktree 경로 (실행 중에만 존재)
```

### 2. Unit spec 작성

좋은 Unit spec은 에이전트가 질문 없이 구현을 완료할 수 있을 만큼 구체적이어야 합니다.

**Spec 섹션 작성 요령:**
- 생성할 파일 경로와 내용을 명시
- 코드 스니펫으로 기대하는 인터페이스/시그니처를 제시
- 모호한 표현("적절히", "필요에 따라") 대신 구체적 명세 사용

**Verification 섹션 작성 요령:**
- 프로젝트에 맞는 검증 커맨드를 정의 (tsc, lint, test, e2e 등)
- 해당 Unit에서 검증할 수 없는 항목은 `skip` 표기
- 커맨드는 Verifier가 그대로 실행할 수 있도록 정확하게 기재

**Context Files 섹션:**
- Worker가 구현 전에 반드시 읽어야 할 파일을 나열
- 아키텍처 문서, 디자인 시스템, 관련 기존 코드 등

### 3. plan.md TOC 작성

TOC는 아래 형식을 **정확히** 따라야 합니다. 오케스트레이터가 정규식으로 상태를 파싱합니다:

```markdown
| # | Unit | Scope | Deps | Status |
|---|------|-------|------|--------|
| 01 | Project Scaffold | docker, backend, frontend | - | [ ] |
| 02 | Backend Domain | domain layer | 01 | [ ] |
| 03 | Backend Infra | ORM, repository | 02 | [ ] |
```

**형식 규칙:**
- `#` 컬럼은 Unit 번호 (`01`, `02`, `03a` 등)
- `Deps` 컬럼은 선행 Unit 번호를 쉼표로 구분 (`01,02`), 없으면 `-`
- `Status`는 `[ ]`로 시작 — 스크립트가 자동 업데이트

### 4. 파이프라인 실행

```bash
# orchestrator/bin을 PATH에 추가
export PATH="/path/to/agentic-tools/orchestrator/bin:$PATH"

# 프로젝트 루트에서 실행
cd your-project

# 1) Worker — Unit spec 구현
orch-worker docs/plan/units/unit-01.md

# 2) Verifier — 검증
orch-verify docs/plan/units/unit-01.md

# 3) Finalizer — 커밋 + main 병합
orch-finalize docs/plan/units/unit-01.md
```

## 상태 추적

### plan.md 상태 마커

| 마커 | 의미 | 전이 |
|------|------|------|
| `[ ]` | 미시작 | → `[~]` (worker 시작 시) |
| `[~]` | 진행중 | → `[x]` (worker 성공) 또는 `[!]` (worker 실패) |
| `[x]` | 완료 | → `[!]` (verifier 실패 시) |
| `[!]` | 실패 | 수동 복구 후 `[ ]`로 되돌려 재실행 |

### decisions.log

Worker가 구현 중 내린 기술적 결정이 Unit별로 누적됩니다:

```markdown
## unit-01
- Tailwind CSS v4 @theme directive 사용
- ESLint flat config (eslint.config.mjs) 사용

## unit-02
- Id VO는 제네릭 클래스 + 팩토리 함수 패턴
- 모든 VO는 private constructor + static parse() factory 패턴
```

후속 Unit의 Worker에게 이 내용이 "Prior Unit Decisions" 컨텍스트로 주입되어, 선행 Unit에서 내린 결정과 일관된 구현을 유도합니다.

### worktree 경로

Worker 실행 시 Claude Code CLI의 `--worktree` 플래그로 격리된 worktree가 생성됩니다. 스크립트는 실행 전후 `.claude/worktrees/` 디렉토리 스냅샷을 비교하여 새로 생성된 worktree를 탐지하고, 경로를 `.state/<unit-id>.worktree`에 저장합니다. Verifier와 Finalizer는 이 경로를 읽어 동일한 worktree에서 작업합니다.

## 에이전트 상세

### Worker

| 항목 | 값 |
|------|---|
| 모델 | opus |
| CLI 플래그 | `--worktree --dangerously-skip-permissions` |
| 입력 | Unit spec 전문 + Prior Decisions |
| 출력 스키마 | `worker-output.json` |

Worker는 Unit spec 전체를 프롬프트로 받아 코드를 구현합니다. `--worktree` 플래그로 격리된 브랜치에서 작업하므로 main 브랜치에 영향을 주지 않습니다.

**출력 필드:**

| 필드 | 타입 | 설명 |
|------|------|------|
| `status` | `"done" \| "failed"` | 구현 성공 여부 |
| `files_created` | `string[]` | 새로 생성한 파일 목록 |
| `files_modified` | `string[]` | 수정한 파일 목록 |
| `decisions` | `string[]` | 구현 중 내린 기술적 결정 |
| `issues` | `string[]` | 발생한 문제나 주의사항 |

### Verifier

| 항목 | 값 |
|------|---|
| 모델 | sonnet |
| CLI 플래그 | `--dangerously-skip-permissions --add-dir <worktree>` |
| 입력 | 검증 프롬프트 + Unit spec 전문 |
| 출력 스키마 | `verifier-output.json` |

Verifier는 코드를 수정하지 않습니다. Unit spec의 Verification 테이블에 정의된 커맨드를 실행하고 결과만 보고합니다.

**출력 필드:**

| 필드 | 타입 | 설명 |
|------|------|------|
| `status` | `"pass" \| "fail"` | 전체 검증 결과 |
| `checks.tsc` | `"pass" \| "fail" \| "skip"` | 타입 체크 |
| `checks.lint` | `"pass" \| "fail" \| "skip"` | 린트 |
| `checks.unit_test` | `"pass" \| "fail" \| "skip"` | 단위 테스트 |
| `checks.e2e` | `"pass" \| "fail" \| "skip"` | E2E 테스트 |
| `errors` | `string[]` | 실패한 체크의 에러 출력 |

### Finalizer

| 항목 | 값 |
|------|---|
| 모델 | sonnet |
| CLI 플래그 | `--dangerously-skip-permissions` |
| 입력 | 커밋 지시 프롬프트 |
| 출력 스키마 | `finalizer-output.json` |

Finalizer는 소스 코드를 수정하지 않습니다. 에이전트가 worktree에서 커밋을 생성한 후, 스크립트가 rebase → ff-only merge → worktree 정리를 수행합니다.

**실행 순서:**
1. 에이전트: `git add` + `git commit` (docs/plan/ 제외)
2. 스크립트: `git rebase main` (worktree 브랜치)
3. 스크립트: `git merge --ff-only` (main에서)
4. 스크립트: worktree 제거, 브랜치 삭제
5. 스크립트: plan 문서 변경사항 커밋

**출력 필드:**

| 필드 | 타입 | 설명 |
|------|------|------|
| `status` | `"done" \| "failed"` | 커밋 성공 여부 |
| `commit_hash` | `string` | 생성된 커밋 해시 |
| `branch_merged` | `string` | 병합된 브랜치명 |
| `commit_message` | `string` | 커밋 메시지 |

## 실패 처리

| 실패 지점 | 상태 마커 | 조치 |
|-----------|----------|------|
| Worker 실패 | `[!]` | spec 수정 후 `[!]` → `[ ]`로 되돌려 재실행 |
| Verifier 실패 | `[!]` | worktree에서 수동 수정 또는 Worker 재실행 |
| Rebase 충돌 | 변경 없음 | worktree에서 수동 충돌 해결 후 Finalizer 재실행 |
| ff-only merge 실패 | 변경 없음 | main에 다른 커밋이 있음 — rebase 재실행 필요 |

실패 후 재실행 시, plan.md의 해당 Unit 상태를 수동으로 `[ ]`로 되돌린 후 `orch-worker`부터 다시 실행합니다.

## 커스터마이징

| 항목 | 위치 | 방법 |
|------|------|------|
| 검증 항목 | `unit.md` Verification 테이블 | 프로젝트 체크 커맨드로 교체 |
| 커밋 메시지 형식 | `orch-finalize` FINALIZE_PROMPT | 프롬프트 내 메시지 템플릿 수정 |
| 에이전트 모델 | 각 스크립트의 `--model` 플래그 | `opus` / `sonnet` / `haiku` 변경 |
| 에이전트 지시 | `--append-system-prompt` 플래그 | 역할별 system prompt 조정 |
| plan 디렉토리 경로 | `lib/common.sh` PLAN_DIR | 기본값 `docs/plan` 변경 |
