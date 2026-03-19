# Orchestrator v2 — Python Agent SDK POC

## 목표

기존 bash 스크립트 하네스의 한 사이클(Worker → Verifier → Finalizer)을 Python으로 재현하여 Claude Agent SDK의 실용성을 검증한다.

## 참고 사례

### Ouroboros (Q00/ouroboros)
- **제어권**: Claude Code 에이전트 세션 (MCP skill로 호출)
- **상태 관리**: Event Sourcing (SQLAlchemy + aiosqlite)
- **서브에이전트**: Claude Agent SDK로 dispatch
- **병렬**: dependency analyzer → parallel executor → coordinator (충돌 해결)
- **적용**: Event Sourcing 패턴, 상태의 stateless reconstruction

### Open SWE (langchain-ai/open-swe)
- **미들웨어 패턴**: 에이전트 루프를 감싸는 결정론적 훅 (에러 처리, safety net)
- **AGENTS.md**: 프로젝트 레벨 컨벤션을 시스템 프롬프트에 주입 (= 우리의 CLAUDE.md)
- **도구 큐레이션**: 15개 이하로 제한, 양보다 질
- **결정론적 safety net**: `open_pr_if_needed` — 에이전트가 안 해도 미들웨어가 보장 (= 우리의 Finalizer 결정론화)
- **적용**: 미들웨어 패턴으로 Worker/Verifier 전후에 결정론적 검증/정리 삽입

## 설계 원칙

| 원칙 | 설명 | 출처 |
|------|------|------|
| 오케스트레이터를 상태 관리에서 배제 | LLM은 상태를 기억하지 못함. 코드가 상태의 단일 진실 원천 | 세션 회고 |
| 결정론적 safety net | 에이전트가 안 해도 코드가 보장하는 동작 (커밋, 정리) | Open SWE |
| 미들웨어 패턴 | 에이전트 실행 전후에 결정론적 훅 삽입 | Open SWE |
| Event append-only | 상태 변경은 이벤트 추가만, 덮어쓰기 없음 | Ouroboros |
| 도구 큐레이션 | Worker에게 필요한 도구만 명시적으로 허용 | Open SWE |

## 검증 항목

| # | 항목 | 성공 기준 |
|---|------|----------|
| 1 | `query()`로 Worker 실행 | structured output 수신, 파일 생성 확인 |
| 2 | 실시간 로그 | Worker 실행 중 체크포인트 로그가 콘솔에 출력 |
| 3 | `query()`로 Verifier 실행 | tsc/lint/test 결과를 structured output으로 수신 |
| 4 | Finalizer (순수 Python) | git add → commit → rebase → merge, 에이전트 없이 |
| 5 | JSONL 이벤트 기록 | 각 단계 이벤트가 파일에 append |
| 6 | 미들웨어 훅 | Worker 전: worktree 생성, Worker 후: 결과 검증 |

## 기술 스택

- Python 3.12+
- `claude-agent-sdk` (`pip install claude-agent-sdk`)
- `subprocess`로 git CLI 호출 (gitpython 불필요)
- JSONL (표준 라이브러리만)

## 디렉토리 구조

```
orchestrator/
  src/
    __init__.py
    worker.py           — query() 기반 Worker dispatch
    verifier.py          — query() 기반 Verifier dispatch
    finalizer.py         — 순수 Python git 조작
    event_store.py       — JSONL append + 상태 조회
    middleware.py        — 에이전트 실행 전후 결정론적 훅
    logger.py            — 체크포인트 로그 (print 기반)
  cli.py                 — CLI 엔트리포인트 (dispatch 명령)
  pyproject.toml
  PLAN.md
  README.md
```

## 구현 순서

### Step 1: 프로젝트 셋업
- pyproject.toml, 의존성 선언
- 기본 디렉토리 구조

### Step 2: event_store.py + logger.py
- JSONL append: `{"ts": "...", "unit": "...", "event": "...", "data": {...}}`
- 상태 조회: JSONL에서 특정 unit의 마지막 이벤트
- 로거: `[HH:MM:SS] unit-id | phase | message`

### Step 3: middleware.py
- `pre_worker(unit_id)` — worktree 생성, 의존성 체크, 상태를 in_progress로 기록
- `post_worker(unit_id, result)` — 결과 검증, 상태 기록
- `pre_verifier(unit_id)` — worktree 경로 전달
- `post_verifier(unit_id, result)` — 실패 시 상태를 failed로 기록
- `post_finalize(unit_id)` — worktree 정리, 고아 브랜치 삭제, 상태를 done으로 기록

### Step 4: worker.py
- `query()` 호출, `ClaudeAgentOptions` 구성
  - `cwd`: worktree 경로
  - `allowed_tools`: ["Read", "Write", "Edit", "Bash", "Glob", "Grep"]
  - `permission_mode`: "bypassPermissions"
  - `output_format`: worker output JSON schema
- async iterator에서 메시지 수신 → 로그 출력
- `ResultMessage`에서 structured output 파싱

### Step 5: verifier.py
- worker.py와 동일 패턴
- `allowed_tools`: ["Bash", "Read", "Glob", "Grep"] (Write/Edit 없음)
- 검증 결과를 structured output으로 수신

### Step 6: finalizer.py
- subprocess로 git CLI 호출
- rebase → ff-only merge → worktree remove → branch delete
- plan 문서 변경 커밋
- 에이전트 호출 없음

### Step 7: cli.py
- `python -m orchestrator dispatch <unit-file>` — middleware → Worker → middleware → Verifier → middleware → Finalizer → middleware
- `python -m orchestrator status` — JSONL에서 현재 상태 표시

## 미들웨어 흐름

```
dispatch(unit)
  │
  ├── middleware.pre_worker()      ← worktree 생성, 의존성 체크
  │
  ├── worker.run()                 ← query() + 실시간 로그
  │
  ├── middleware.post_worker()     ← 결과 검증, 이벤트 기록
  │
  ├── middleware.pre_verifier()    ← worktree 경로 전달
  │
  ├── verifier.run()               ← query() + 실시간 로그
  │
  ├── middleware.post_verifier()   ← 실패 시 중단 또는 계속
  │
  ├── [👤 Human Gate]              ← 병합 승인 (선택적)
  │
  ├── finalizer.run()              ← git 조작 (에이전트 없음)
  │
  └── middleware.post_finalize()   ← worktree 정리, 상태 done
```

## bash 하네스와의 대응

| bash | Python | 개선점 |
|------|--------|--------|
| `dispatch-worker.sh` | `worker.py` | streaming 실시간 로그 |
| `dispatch-verifier.sh` | `verifier.py` | Write/Edit 도구 차단 |
| `dispatch-finalizer.sh` | `finalizer.py` | 에이전트 제거, 결정론적 |
| `sed` plan.md 상태 변경 | `event_store.py` | append-only, 동시 쓰기 안전 |
| `jq` structured_output | `json.loads()` | 네이티브 파싱 |
| 백그라운드 + 완료 대기 | `async for` | 실시간 메시지 수신 |
| 없음 | `middleware.py` | 결정론적 전후 처리 |

## 범위 밖 (POC 이후)

- plan.md 렌더링 (JSONL → markdown)
- 병렬 실행 (asyncio.gather)
- 의존성 그래프 분석
- bootstrap (Planner 에이전트)
- worktree 사전 생성
- 에러 복구 (recover 명령)
- AGENTS.md / CLAUDE.md 자동 주입
- 서브에이전트 spawn (Agent SDK의 `agents={}`)
