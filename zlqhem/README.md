# zlqhem (키보드)

한/영 전환 키 없이 영어 키보드 하나로 한글과 영어를 동시에 입력하는 터미널 입력기.

```
입력: gksrmf project wjawlswjr ghkrwkd
출력: 한글 project 점진적 확장
```

## 작동 원리

모든 입력을 영어 키보드로 받은 뒤, 단어마다 영어인지 한글인지 자동 판별한다.

**3단계 게이트:**

1. **구조 게이트** — 숫자, 특수문자, 경로 → 패스스루
2. **음절 비율 게이트** — QWERTY→한글 변환 후 완성 음절 비율 < 50% → 영어
3. **빈도 사전 비교** — 영어/한글 각 50k 단어 빈도로 확률 판별

## 설치

```bash
# uv tool로 글로벌 설치
uv tool install ~/Workspace/agent-stuffs/zlqhem

# 또는 프로젝트 내에서
cd zlqhem && uv venv && uv pip install -e .
```

## 사용법

### zsh 플러그인 (실시간 변환)

```bash
# .zshrc에 추가
source /path/to/zlqhem/shell/zlqhem.zsh
```

- `Ctrl+]` — 토글 (기본: 비활성)
- 활성 상태에서 스페이스를 누르면 직전 단어가 자동 변환
- 데몬이 꺼져 있으면 토글 시 자동 시작

```
zlqhem-start     # 데몬 수동 시작
zlqhem-stop      # 데몬 종료
zlqhem-status    # 상태 확인
```

### pty proxy (Claude Code 등 TUI 프로그램)

```bash
zlqhem wrap -- claude
```

래핑된 프로그램 안에서 `Ctrl+]`로 동일하게 토글.

### CLI 변환

```bash
# 인라인
zlqhem convert "gksrmf project"
# → 한글 project

# 파이프
echo "dkssud gktpdy" | zlqhem

# 디버그
zlqhem convert -d "go gksrmf git"
#   go               → go           [EN] conf=4.3
#   gksrmf           → 한글           [KR] conf=3.5
#   git              → git          [EN] conf=11.5
```

## 아키텍처

```
┌──────────────────────────────────────┐
│ 프론트엔드 (택 1)                     │
│  ├─ zsh widget (space 가로채기)       │
│  ├─ pty proxy (TUI 프로그램 래핑)     │
│  └─ CLI (파이프/인라인)               │
│            │                         │
│            ▼                         │
│ 코어 (Python)                        │
│  ├─ convert.py   QWERTY→한글 FSM     │
│  ├─ scorer.py    빈도 기반 스코어링    │
│  ├─ classify.py  판별 파이프라인       │
│  └─ data/        영한 50k 빈도 사전   │
└──────────────────────────────────────┘
```

zsh 플러그인은 Unix 소켓 데몬(`zlqhem daemon`)과 통신하여 사전을 메모리에 상주시킨다.
pty proxy는 코어를 직접 임포트하여 동일 프로세스에서 동작한다.

## 모호한 케이스

| 입력 | 영어 후보 | 한글 후보 | 결과 | 이유 |
|------|----------|----------|------|------|
| `go` | go (빈도 높음) | 해 (압축 페널티) | **go** | 영어 빈도 압도 |
| `gksrmf` | (미등재) | 한글 (빈도 높음) | **한글** | 영어에 없음 |
| `git` | git (개발자 용어) | 햣 (미등재) | **git** | 개발자 용어 세트 |
| `Python` | python (대문자+5) | — | **Python** | 대문자 = 영어 |

기본 바이어스: **영어 우선** (개발자 터미널 환경)

## 테스트

```bash
cd zlqhem
.venv/bin/pytest tests/ -v
```

## 로드맵

- [x] Python 코어 (convert, scorer, classify)
- [x] zsh 플러그인 (데몬 + widget)
- [x] pty proxy (TUI 프로그램 래핑)
- [ ] 오류/미인식 케이스 수집 (`zlqhem report` → `~/.zlqhem/misses.jsonl`)
- [ ] 정확도 평가 (`zlqhem eval` — 수집된 케이스 기반)
- [ ] Rust 코어 포팅 (.dylib로 다중 프론트엔드 지원)
- [ ] macOS IME (글로벌 입력기)

## 레퍼런스

- [bibim-prototype](https://codeberg.org/hongminhee/bibim-prototype) — CJK 다국어 입력기, 래티스+비터비 아키텍처
- [inko](https://github.com/738/inko) — QWERTY↔한글 변환 라이브러리
- [FrequencyWords](https://github.com/hermitdave/FrequencyWords) — 빈도 사전 데이터 소스

## 라이선스

ISC
