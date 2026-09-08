# 📋 GitRoast 실시간 인수인계 문서 (HANDOVER.md)

> **최종 갱신 시각**: 2026-09-08 17:20:00 (KST)  
> **프로젝트 위치**: `c:\aiffel_work\git-roast` (NTFS Junction: `c:\aiffel_work\business`)  
> **현재 서버 상태**: 운영은 Vercel 에서 상시 가동. 로컬 서버는 떠 있지 않다 — 필요하면 `npm run build && npm start` (프로덕션 빌드를 http 로 볼 때는 `COOKIE_SECURE=false`)  
> **현재 DB**: **PostgreSQL 17** (로컬 5432, `gitroast` DB) — 관리자 콘솔에 `🐘 PostgreSQL 활성화` 표시  
> **원격 저장소**: [`github.com/rome777/git-roast`](https://github.com/rome777/git-roast) (main)  
> **운영 URL**: **https://git-roast-three.vercel.app** (Vercel `somsaps-projects/git-roast`)  
> **운영 DB**: **Neon** (ap-southeast-1, pooled) — 2026-09-08 배포 완료. 상세는 6절 마지막 항목

---

## 1. 🚀 프로젝트 개요 및 아키텍처

- **서비스명**: **GitRoast (깃로스트)**
- **핵심 기능**:
  1. **GitHub 개발자 계정 & 단일 리포지토리 AI 심층 분석**:
     - 💼 **순한맛 (Review)**: 시니어 아키텍트 시선의 스펙 주도 아키텍처 진단, 기술 스택 타당성, 개선점 제안
     - 🔥 **매운맛 (Roast)**: 실제 커밋 메시지, 방치된 문서, AI 대필 흔적, 테스트 부재를 촌철살인으로 풍자
  2. **개인 히스토리 보관함 (`/dashboard`)**:
     - 일반 회원은 **자신이 분석한 기록만** 격리되어 조회 및 즐겨찾기/삭제 가능
  3. **슈퍼 관리자 콘솔 (`/admin`)**:
     - 모든 사용자가 저장한 분석 내역 일괄 모니터링
     - **순한맛/매운맛 모드 필터**, **리포/유저 대상 필터**, **작성자별 원클릭 필터**, **실시간 키워드 검색**, **DB 영구 삭제**
- **기술 스택**:
  - **Framework**: Next.js 14.2.15 (App Router), React 18, TypeScript
  - **Styling**: Tailwind CSS, Lucide React
  - **AI Engine**: Google Gemini 2.5 Flash (`gemini-2.5-flash`)
  - **Database Dual Engine**:
    - `DATABASE_URL` 존재 시: **PostgreSQL** (`pg.Pool`)
    - `DATABASE_URL` 부재 시: **SQLite** (`data/gitroast.db` 내장) 무중단 자동 Fallback

---

## 2. 🔑 접속 계정 및 환경 설정

### 1) 인증 방식 (2026-09-08 전면 교체)

비밀번호를 **실제로 검증**하며, 세션 쿠키는 **HMAC-SHA256 서명**으로 위조를 막는다.
`role` 은 쿠키에 들어 있어도 신뢰하지 않고, 권한 판정 시마다 DB 에서 다시 읽는다.

> 🚨 **이 문서는 공개 저장소(`github.com/rome777/git-roast`)에 있다. 비밀번호를 여기 적지 않는다.**
> 아래 표는 계정의 **존재와 권한**만 기록한다. 실제 값은 `.env.local` 처럼 저장소 밖에만 둔다.

| 권한 | 로그인 이메일 | 비밀번호 | 비고 |
| :--- | :--- | :--- | :--- |
| **최고 관리자 (ADMIN)** | `rome777@gmail.com` | *(문서에 적지 않음)* | 전체 사용자 내역 모니터링 & 관리자 콘솔 |
| **최고 관리자 (ADMIN)** | `admin@gitroast.dev` | *(문서에 적지 않음)* | 전체 사용자 내역 모니터링 & 관리자 콘솔 |
| **일반 사용자 (USER)** | `rookie@example.com` | *(문서에 적지 않음)* | 일반 개발자 테스트 계정 (개인 대시보드 격리) |
| **일반 사용자 (USER)** | `/signup` 에서 가입한 이메일 | 가입 시 정한 값 (8자 이상) | 본인 저장 내역만 격리 표출 |
| **데모 계정** | `demo@gitroast.dev` | 없음 (`/api/auth/demo` 원클릭) | 운영 배포 시 `DISABLE_DEMO_LOGIN=true` 로 차단 |

> 💡 **비밀번호 변경/설정 방법**:
> 비밀번호를 새로 설정하거나 변경하려면 서버에서 다음 명령을 실행합니다:
> ```bash
> node --env-file=.env.local scripts/set-password.mjs <이메일> <비밀번호>
> ```

### 2) 환경 변수 (`.env.local` — git 에 올라가지 않음)

**실제 키 값은 이 문서에 적지 않는다.** 항목과 용도만 기록한다.
전체 목록과 설명은 [`.env.example`](.env.example) 참조.

| 변수 | 필수 | 용도 |
| :--- | :---: | :--- |
| `SESSION_SECRET` | ✅ | 세션 쿠키 HMAC 서명 키(32자 이상). **없으면 모든 인증이 실패한다.** 값을 바꾸면 기존 로그인 세션이 전부 무효화된다. |
| `GEMINI_API_KEY` | ✅ | Google Gemini 2.5 Flash 추론. 미설정 시 내장 목업 제너레이터로 폴백 |
| `DATABASE_URL` | ⬜ | 설정 시 PostgreSQL, 미설정 시 SQLite(`data/gitroast.db`) 자동 전환 |
| `GITHUB_TOKEN` | ⬜ | **미설정 시 GitHub API 가 비인증(시간당 60회)으로 동작한다.** 분석량이 늘면 반드시 설정 |
| `VERTEX_AI_API_KEY`, `GOOGLE_PROJECT_ID` | ⬜ | Vertex AI 경유 시 |
| `NEXT_PUBLIC_SITE_URL` | ⬜ | 공유 링크 메타태그의 기준 주소. **`NEXT_PUBLIC_` 접두사는 빌드 시점에 값이 코드에 박힌다** — 배포 후 대시보드에서 바꿔도 재배포 전에는 반영되지 않는다. |
| `DISABLE_DEMO_LOGIN` | ⬜ | `true` 로 두면 데모 원클릭 로그인 차단 (운영 권장) |
| `RATE_LIMIT_*` | ⬜ | `/api/analyze` 요청량 상한 5종. 미설정 시 기본값(게스트 3/시간·10/일, 계정 30/일, 전역 500/일). `.env.example` 8번 참조 |
| `COOKIE_SECURE` | ⬜ | 세션 쿠키 secure 플래그 강제 지정. **미설정 시 `NODE_ENV=production` 이면 자동으로 켜진다.** 로컬에서 프로덕션 빌드를 http 로 확인할 때만 `false` |

`SESSION_SECRET` 생성:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

---

## 3. 🛠️ 최근 완료된 주요 작업 내역

1. **Google Gemini 2.5 Flash 실시간 추론 연동**:
   - `gemini-2.5-flash` 모델을 메인으로 채택 (기존 1.5-flash 404 이슈 해결).
   - 리포지토리의 `README.md` 전문(최대 2,500자), 패키지 설정(`package.json`, `wrangler.toml` 등 1,500자), 실제 커밋 로그를 LLM 컨텍스트에 주입하여 심층 기술 분석 구현.
2. **관리자 콘솔 (/admin) 오류 해결 및 다중 필터 탑재**:
   - `app/api/admin/evaluations/route.ts`의 비동기 DB 호출 시 누락되었던 `await` 수정 완료.
   - **순한맛 / 매운맛 모드 필터 탭** (`전체 모드`, `🔥 매운맛 팩폭만`, `💼 순한맛 리뷰만`) 신설.
   - **대상 필터 탭** (`전체`, `📦 리포지토리`, `👤 개발자`) 및 **작성자별 필터 탭** 통합.
3. **1200x1920 (세로형 / 피벗 모니터) 전 페이지 UI 최적화**:
   > ⚠️ 이때 붙인 `xl:` 클래스들은 **1280px 미만에서 켜지지 않아 대상 화면에서 무효**였다.
   > 2026-09-08 에 `xl` 브레이크포인트를 1200px 로 낮춰서야 실제로 적용됐다 (6절 참조).
   - 메인 페이지 검색창 및 히어로 섹션 확대 (`max-w-3xl`, `text-7xl` 타이틀).
   - 분석 결과 카드 (`EvaluationCard.tsx`): `max-w-4xl`로 확장, 레이더 차트 및 팩폭/강점 2열 배치 최적화.
   - 관리자 페이지 (`app/admin/page.tsx`): `max-w-7xl` 컨테이너 및 최소 높이 확보로 세로 화면에서도 시원한 여백 유지.
   - 대시보드 (`app/dashboard/page.tsx`): `max-w-6xl` 반응형 2열 카드 그리드 적용.
4. **특정 파일 URL 입력 시 정밀 타깃 분석 메커니즘 (`subPath`)**:
   - 예: `https://github.com/rome777/aiffel_test/blob/main/SPEC.md` 입력 시
   - `lib/github/parser.ts`: `owner(rome777)`, `repo(aiffel_test)`, `subPath(SPEC.md)` 추출.
   - `lib/github/api.ts`: 리포 전체(커밋, 구조, 언어, README, 의존성)를 기본 수집함과 동시에 GitHub API로 `SPEC.md` 내용(최대 1,500자)을 `targetFile`로 직접 다운로드.
   - `lib/ai/prompts.ts`: 프롬프트에 `SPEC.md` 원문과 리포 전체 메타데이터를 동시 주입하여 **기획문서(SPEC)와 실제 리포 코드/커밋 간의 괴리 및 완성도를 대조 심층 분석**.
5. **Gemini 2.5 Flash Thinking 토큰 예산 및 JSON 파싱 안정화 (`lib/ai/evaluator.ts`)**:
   - **원인 분석**: Gemini 2.5 Flash 모델은 내부 추론 과정에서 약 2,200개의 사고 토큰(`thoughtsTokenCount`)을 소모하며, 이 토큰이 `maxOutputTokens` 예산에 산입됨. 기존 2,500 토큰 설정 시 실제 JSON 응답이 중간에 끊겨 `SyntaxError: Unterminated string in JSON` 발생.
   - **조치 완료**:
     1. `maxOutputTokens`를 **8192**로 상향.
     2. `generationConfig`에 **`responseMimeType: "application/json"`**을 명시하여 순수 무결성 JSON 출력 강제.
     3. 원문 파싱 실패 시 정규식 및 코드펜스 제거를 거치는 3중 방어 파싱 로직 적용.
     4. 실제 `rome777/aiffel_test` (`SPEC.md`) 대상 실시간 AI 분석 및 DB 저장 정상 동작 검증 완료.


6. **인증·권한 체계 전면 재구축 및 공유 링크 실동작화 (2026-09-08)**:
   자세한 내역은 아래 **6. 작업 이력**의 2026-09-08 항목 참조. 요약하면:
   - 비밀번호 **실검증**(scrypt) + 세션 쿠키 **HMAC 서명** + 관리자 API **서버측 권한 게이트** 도입.
   - `/api/analyze` 의 `saveEvaluationToDb` **`await` 누락 수정** — 공유 링크 ID 가 비로소 실제 값이 됨.
   - `/result/[id]` 가 **DB 를 실제로 조회**하도록 변경 (기존에는 항상 목업 카드 표시).
   - Gemini 2.5 Flash **thinking 토큰 예산 차단** — 1차 호출이 매번 실패하던 문제 실제 해결.

---

## 4. 📂 핵심 파일 구조 및 역할

```text
c:\aiffel_work\git-roast\
├── app/
│   ├── page.tsx                        # 메인 분석기 (1200x1920 최적화, 모드 토글)
│   ├── admin/page.tsx                  # 관리자 콘솔 (401/403 시 권한 없음 화면)
│   ├── dashboard/page.tsx              # 개인 히스토리 (비로그인 시 로그인 안내 화면)
│   ├── login/page.tsx                  # 로그인 (→ /api/auth/login)
│   ├── signup/page.tsx                 # 회원가입 (→ /api/auth/signup)
│   ├── result/[id]/page.tsx            # 공유 카드 — DB 실조회, 없으면 404 화면
│   ├── docs/page.tsx                   # 🆕 개발 문서 목록 (공개)
│   ├── docs/[slug]/page.tsx            # 🆕 마크다운 문서 뷰어
│   ├── not-found.tsx                   # 🆕 404 페이지
│   ├── api/
│   │   ├── analyze/route.ts            # 실시간 AI 분석 (세션 있으면 그 계정에 귀속)
│   │   ├── evaluations/[id]/route.ts   # 🆕 공개 단건 조회 (공유 링크용, 이메일 미노출)
│   │   ├── admin/evaluations/route.ts  # 관리자 전용 — requireAdmin 게이트
│   │   ├── history/route.ts            # 개인 히스토리 CRUD — requireUser 게이트
│   │   └── auth/
│   │       ├── login/route.ts          # 비밀번호 실검증 + 세션 발급
│   │       ├── signup/route.ts         # 🆕 가입 (중복 409, 약한 비밀번호 400)
│   │       ├── logout/route.ts         # 🆕 세션 만료 (httpOnly 라 서버만 지울 수 있음)
│   │       ├── demo/route.ts           # 🆕 데모 계정 원클릭 (비밀번호 서버 생성)
│   │       └── me/route.ts             # 현재 세션 조회 (role 은 DB 에서 재확인)
├── components/
│   ├── evaluation/
│   │   ├── EvaluationCard.tsx          # 분석 결과 카드 (PNG 다운로드, 공유)
│   │   ├── RadarChart.tsx              # 5대 역량 SVG 레이더 차트
│   │   └── TierBadge.tsx               # SSS~F 등급 뱃지
│   └── layout/
│       ├── Navbar.tsx                  # 서버 세션만 신뢰 (localStorage/Supabase 경로 제거)
│       └── Footer.tsx
├── lib/
│   ├── docs.ts                         # 🆕 공개 문서 화이트리스트 + 마크다운 렌더
│   ├── auth/                           # 🆕 인증 레이어
│   │   ├── password.ts                 # scrypt 해싱/검증, 레거시 자리표시자 판별
│   │   └── session.ts                  # HMAC 서명 쿠키, requireUser / requireAdmin
│   ├── ai/
│   │   ├── evaluator.ts                # Gemini 호출 (thinkingBudget:0, 3중 파싱 방어)
│   │   └── prompts.ts                  # 순한맛/매운맛 프롬프트
│   ├── github/api.ts                   # GitHub API (README, 의존성, 커밋 수집)
│   └── db/database.ts                  # PostgreSQL & SQLite 듀얼 엔진 레이어
├── scripts/
│   ├── verify-auth.mjs                 # 인증·권한 회귀 검증 (npm run verify:auth, 32건)
│   ├── set-password.mjs                # 🆕 계정 비밀번호 설정 (유일한 설정 경로)
│   └── migrate-sqlite-to-postgres.mjs  # 🆕 SQLite → PostgreSQL 이관
├── data/gitroast.db                    # 로컬 SQLite (.gitignore 로 제외됨)
├── .gitignore                          # 🆕 .env.local / *.db / .next 제외
└── HANDOVER.md                         # 본 인수인계 문서
```

---

## 5. ⚠️ 다음 AI 작업자를 위한 주의사항 (Must-Read)

1. **`SESSION_SECRET` 이 없으면 로그인이 전부 실패한다.**
   - 새 환경에 배포하거나 `.env.local` 을 새로 만들 때 반드시 넣는다. 32자 미만이면 거부된다.
   - 값을 교체하면 **발급된 세션이 전부 무효화**되어 모든 사용자가 재로그인해야 한다.

2. **권한 판정은 반드시 서버에서 한다.**
   - 클라이언트에서 이메일 문자열을 비교해 관리자를 판별하던 코드는 전부 제거했다.
   - 새 보호 API 를 만들 때는 `lib/auth/session.ts` 의 `requireUser` / `requireAdmin` 을 쓴다.
     ```ts
     const auth = await requireAdmin(req);
     if (isSessionResponse(auth)) return auth;   // 401/403 응답을 그대로 반환
     ```
   - 요청 본문·쿼리스트링의 `email` / `userId` 를 **소유자 판정에 쓰지 않는다.** 세션만 신뢰한다.

3. **DB 함수 호출 시 비동기 처리** *(재발 사례 있음 — 반드시 확인)*
   - `lib/db/database.ts` 의 함수는 대부분 `async` 다. `await` 를 빠뜨리면 **에러 없이 조용히**
     `Promise` 가 JSON 으로 직렬화되어 `{}` 가 응답에 나간다.
   - 실제로 `/api/analyze` 에서 이 버그로 공유 링크 ID 가 `{}` 였고, `/result/[id]` 가 목업으로
     폴백하고 있어 **아무도 눈치채지 못했다.**

4. **Gemini 2.5 계열은 thinking 토큰이 출력 예산을 먹는다.**
   - `maxOutputTokens` 만 올려서는 해결되지 않는다. `generationConfig.thinkingConfig.thinkingBudget: 0`
     을 반드시 함께 준다. 없으면 JSON 이 중간에 잘려 `Unterminated string in JSON` 이 나고,
     **조용히 다음 모델로 폴백**해 매 분석마다 호출 1회가 낭비된다.
   - `gemini-1.5-flash` 는 본 계정에서 404. `gemini-2.5-flash` 또는 `gemini-flash-latest` 를 쓴다.

5. **서버 재시작 절차 — 빌드 직후 바로 start 하지 말 것.**
   ```powershell
   # 1) 기존 프로세스 정리
   Get-NetTCPConnection -LocalPort 3000 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
   # 2) 빌드
   npm run build
   # 3) 파일 flush 를 기다린 뒤 시작 (중요)
   Start-Sleep -Seconds 3
   npm start
   ```
   - `next build` 직후 즉시 `npm start` 하면 `.next` 쓰기가 끝나기 전에 서버가 뜨면서
     `Cannot find module '.next/server/app/result/[id]/page.js'` 로 **페이지만 500** 이 난다.
     (API 라우트는 정상 동작해서 더 헷갈린다.) 2026-09-08 실제 발생. 서버 재시작으로 해결.

6. **`xl` 브레이크포인트는 1200px 로 재정의되어 있다.**
   - `tailwind.config.ts` 의 `screens.xl = "1200px"` (Tailwind 기본값 1280px 아님).
   - 대상 환경이 1200x1920 세로형 모니터라서다. 이 값을 기본값으로 되돌리면
     **전 페이지의 대화면 대응이 한꺼번에 죽는다.**
   - 한국어 줄바꿈은 `app/globals.css` 의 `word-break: keep-all` 에 의존한다. 지우면
     제목이 어절 중간에서 끊긴다.

7. **`/docs` 는 공개 페이지다 — 공개 목록을 함부로 늘리지 않는다.**
   - 공개 문서는 `lib/docs.ts` 의 `PUBLIC_DOCS` 배열에 **명시된 것만**이다.
   - `HANDOVER.md` 는 관리자 로그인 정보를 담고 있어 절대 여기에 추가하지 않는다.
   - `docs/FINAL_CHECKLIST.md` 에는 **미구현 보안 항목(Rate Limit 부재 등)이 적혀 있다.**
     현재 공개 상태이므로, 외부 배포 시에는 이 문서만이라도 뺄지 검토한다.

8. **DB 전환 시 확인 순서**
   - `.env.local` 의 `DATABASE_URL` → 재빌드·재시작 → **관리자 콘솔 배지 확인**.
     `🐘 PostgreSQL 활성화` 여야 한다. `🗄️ SQLite 로컬 모드` 로 뜨면 접속이 안 되고 있는 것이다.
   - 기존 데이터는 자동으로 따라가지 않는다. `npm run db:migrate` 를 돌린다(멱등, 원본 보존).
   - CLI 스크립트는 `npm run` 으로 실행해야 `.env.local` 이 로드된다.

9. **비밀값을 문서에 적지 않는다.**
   - API 키·토큰·비밀번호는 `.env.local` 에만 둔다. 본 문서에는 **변수명과 용도만** 적는다.

10. **인증 로직을 건드렸으면 반드시 회귀 검증을 돌린다.**
   ```bash
   npm run verify:auth
   ```
   - 서버가 뜬 상태에서 실행한다. 미인증 차단·쿠키 위조 차단·권한 분리·데이터 격리·
     공유 링크·로그아웃 **31건**을 실제 HTTP 요청으로 확인한다. 전부 PASS 여야 한다.

11. **인수인계 원칙**
   - 모든 작업의 끝에 본 `HANDOVER.md` 를 최신 상태로 갱신한다.
   - **앞부분(1~5절)은 현재 상태**이므로 덮어쓰고, **6절 작업 이력은 날짜를 붙여 덧붙이기만** 한다.

---

## 6. 🗓️ 작업 이력 (날짜순 덧붙이기 — 덮어쓰지 않는다)

### 2026-09-08 — 인증·권한 재구축, 공유 링크 실동작화

**착수 배경**: 현황 점검 중 인증이 사실상 없는 상태임을 실측으로 확인.
쿠키 없이 `GET /api/admin/evaluations` 가 200 + 전체 DB(18KB) 를 반환했다.

**고친 것 (8건)**

| # | 문제 | 조치 |
| :-: | :--- | :--- |
| 1 | 관리자 API·페이지에 인증 전무 | `requireAdmin` 게이트. role 은 토큰이 아니라 **DB 에서 재조회**해 판정 |
| 2 | `/api/history` 가 비로그인 요청에 `rome777@gmail.com` 하드코딩 폴백 | 폴백 제거, `requireUser` 로 401. 소유자는 세션에서만 결정 |
| 3 | 로그인이 비밀번호를 검사하지 않음 | scrypt 해싱 + `timingSafeEqual` 검증 (`lib/auth/password.ts`) |
| 4 | 세션 쿠키가 서명 없는 평문 JSON (role 위조 가능) | HMAC-SHA256 서명 + `httpOnly` + 7일 만료 (`lib/auth/session.ts`) |
| 5 | `/api/analyze` 의 `saveEvaluationToDb` **`await` 누락** | `await` 추가. 응답 `data.id` 가 `{}` → 실제 ID 문자열로 |
| 6 | `/result/[id]` 가 DB 를 조회하지 않고 목업(`rookie-dev`)으로 폴백 | `/api/evaluations/[id]` 신설, 페이지가 DB 실조회. 없으면 404 화면 |
| 7 | `HANDOVER.md` 에 Gemini/Vertex 키 평문 노출 | 문서에서 제거, 변수명·용도만 기록 |
| 8 | git 미적용 + `.gitignore` 부재 | `.gitignore` 작성 (`.env.local`, `*.db`, `.next` 제외) |

**검증 중 추가로 발견해 고친 것**

- **Gemini 2.5 Flash 1차 호출이 매번 실패하고 있었다.** 서버 로그에
  `SyntaxError: Unterminated string in JSON at position 227` 이 찍히고 조용히 다음 모델로
  폴백 중이었다. §3-5 의 `maxOutputTokens: 8192` 상향만으로는 해결되지 않았던 것 —
  thinking 토큰이 예산을 먼저 소진했기 때문. `thinkingConfig: { thinkingBudget: 0 }` 추가로
  **폴백 경고 로그가 완전히 사라진 것을 확인**했다. 파싱 실패 시 예외를 삼키지 않고
  다음 모델로 넘어가도록 3중 파싱 방어도 보강.

**실측 검증 결과 (2026-09-08 기준)**

- 자동 검증 스크립트 **31건 전부 통과** — 미인증 차단 5건, 쿠키 위조 차단 4건,
  비밀번호 검증 5건, 권한 분리 7건, 데이터 격리 3건, 공유 링크 4건, 로그아웃 2건.
- 위조 시도 4종(`gitroast_user` 평문 쿠키 / 서명 없는 토큰 / 서명 위조 토큰 / `?email=` 우회)
  전부 **401**.
- 일반 사용자 세션으로 관리자 API 조회·삭제 → 전부 **403**.
- 실제 분석 1건(`rome777/aiffel_test`, review) 실행 → ID `eval-1788841956566-znzm1`(문자열),
  **비로그인 상태에서 공유 링크 조회 200**, 로그인 계정 히스토리에 정상 귀속.
- 빌드: `npx tsc --noEmit` 무오류, `next build` 성공(16 페이지).

**하지 않은 것과 그 이유**

- **`git init` / 최초 커밋**: 저장소 채택 여부는 사용자 결정 사항이라 `.gitignore` 만 준비했다.
  실행하려면 `git init; git add .; git commit -m "chore: initial commit"`.
- **노출된 API 키 폐기·재발급**: Google Cloud 콘솔 접근이 필요해 사용자만 할 수 있다.
  문서에서 키를 지웠어도 **이미 노출된 값이므로 재발급을 권장**한다.
- **Supabase 연동 경로**: `lib/supabase/*` 와 `/api/analyze` 의 Supabase 저장 블록은
  현재 환경 변수 미설정으로 동작하지 않는다(`createClient()` 가 null 반환). 손대지 않았다.
  자체 세션 체계로 일원화됐으므로, 쓰지 않을 것이면 정리 대상.
- **게스트 분석 제한**: 비로그인 사용자도 분석이 가능해 Gemini 호출 비용이 열려 있다.
  기존 동작을 유지했으나 운영 전 검토 필요.

**후속 수정 — 카드 보기 / 공유 링크 (2026-09-08)**

- `카드 보기` 버튼이 대시보드·관리자 콘솔 양쪽에서 `/?username=<이름>&mode=<모드>` 로,
  즉 **메인 페이지로** 링크되어 있었다. 게다가 `app/page.tsx` 는 `useSearchParams` 를 쓰지 않아
  그 쿼리를 **아무도 읽지 않는다.** 눌러도 빈 검색창의 메인 페이지만 떴다 — 처음부터 동작한 적 없는 링크.
  → 양쪽 다 `/result/<평가 ID>` 로 교체. 관리자 콘솔은 목록 필터 상태가 날아가지 않도록 새 탭으로 연다.
- `EvaluationCard` 의 **공유 링크 복사 버튼이 `window.location.href` 를 복사**하고 있었다.
  메인 페이지에서 분석한 직후 누르면 `/` 가 복사돼 받는 사람은 아무것도 못 봤다.
  → `${origin}/result/<평가 ID>` 를 만들어 복사하도록 수정. 클립보드 권한이 없는 환경용 폴백도 추가.
  ID 가 없는 카드에서는 버튼을 비활성화한다.
- `EvaluationResult.id` 는 타입상 optional 이므로 링크 렌더 시 반드시 존재 여부를 확인한다.

**후속 수정 — 1200x1920 세로형 모니터 UI (2026-09-08)**

- **근본 원인**: Tailwind 기본 브레이크포인트에서 `xl` 은 **1280px** 이다.
  대상 화면은 폭이 **1200px** 이라 `xl:` 이 단 한 번도 켜지지 않았다.
  §3-3 의 "1200x1920 전 페이지 UI 최적화"에서 붙인 `xl:max-w-6xl`, `xl:text-7xl` 등
  **23곳이 전부 죽은 코드**였다. 실측: 메인·대시보드 콘텐츠 폭이 1200px 화면에서 1024px.
  → `tailwind.config.ts` 에서 `screens.xl` 을 **1200px** 로 재정의해 기존 의도를 살렸다.
  (`sm`/`md`/`lg`/`2xl` 은 기본값 유지. 1200~1279 구간이 새로 `xl` 에 포함될 뿐이라
  더 좁은 화면에는 영향이 없다.)

- **한국어 줄바꿈**: `xl:text-7xl` 이 켜지자 히어로 타이틀이 "인가/요" 로 어절 중간에서
  끊겼다. `app/globals.css` 의 `body` 에 `word-break: keep-all` 을 넣어 어절을 보존하고,
  URL·리포지토리명 같은 긴 영문 토큰을 위해 `overflow-wrap: anywhere` 를 함께 준다.

- **페이지별 조치**:
  - `/result/[id]`, `/login`, `/signup` 은 `xl:` 대응이 **아예 없었다.** 컨테이너 폭·여백·
    글자 크기를 추가 (`xl:max-w-5xl`, `xl:max-w-lg`, `xl:p-10` 등).
  - `/admin`, `/dashboard` 의 빽빽한 `text-xs`(12px)/`text-[11px]` 를 xl 에서 한 단계 확대
    (표 본문 12px → **14px**). 행 높이·통계 숫자·검색창도 함께 키움.
  - 메인 페이지는 세로 1920px 에서 콘텐츠가 상단에만 몰렸다. `xl:pt-[9vh]` 로 눈높이까지
    내렸다. `justify-center` 는 콘텐츠가 길어질 때 위쪽이 잘려 스크롤로 못 보게 되므로 쓰지 않았다.

- **실측 결과 (1200x1920)**: 메인·대시보드 1024 → **1152px**, 관리자 1152 → **1185px**,
  결과 카드 896 → 1152px, 로그인 카드 448 → **512px**. 표 글자 12 → 14px.
  가로 스크롤은 375px / 1200px / 1440px 어디서도 발생하지 않음. 인증 회귀 31건 전부 통과.

**후속 수정 — UI 정리 및 개발 문서 공개 (2026-09-08)**

- **대시보드**: "카드 보기" 버튼만 눌리던 것을 **카드 영역 전체 클릭**으로 바꿨다.
  카드를 통째로 `<Link>` 로 감싸면 안쪽 즐겨찾기 `<button>` 이 `<a>` 안에 들어가므로,
  `absolute inset-0 z-10` 오버레이 링크 + 버튼 `z-20` 방식을 썼다.
  (검증: 카드 중앙 클릭 → 상세 이동 / 즐겨찾기 클릭 → 이동 없이 토글만)

- **관리자 목록**: 2줄짜리 행(작성자 ID, 대상 유형, 한줄평이 별도 줄)을 **1행 1줄**로 압축.
  잘리는 값은 `title` 속성(툴팁)으로 옮겼다. 행 높이 **68px → 35px 균일**, 15행이 한눈에 들어온다.
  대상명 링크도 죽어 있던 `/?username=...` 에서 `/result/<id>` 로 교체.

- **메인 페이지 단순화**: 상단 필 배지, 하단 기능 소개 카드 3장, 결과 섹션 중복 안내를 제거하고
  설명 문구를 두 줄 → 한 줄로, 모드 토글 라벨을 "매운맛 팩폭 모드 (Roast)" → "매운맛 팩폭" 으로 줄였다.
  첫 화면에 남은 것은 제목 · 한 줄 설명 · 모드 토글 · 검색창 · 샘플 칩뿐이다.

- **개발 문서 공개 (`/docs`)**: 푸터 링크가 라우트 없이 404 였다.
  `docs/*.md` 5종을 렌더링하는 페이지를 만들었다 (`marked` 18 사용, 목록 + 개별 문서).
  - 공개 대상은 `lib/docs.ts` 의 `PUBLIC_DOCS` **화이트리스트**로 관리한다.
    `docs/` 에 파일을 넣는다고 자동 공개되지 않는다 — 내부 메모의 실수 노출을 막기 위함.
  - **`HANDOVER.md` 는 공개 대상에서 제외**했다. 관리자 계정 로그인 정보가 들어 있다.
  - 마크다운 본문 스타일은 `app/globals.css` 의 `.markdown-body` 에 직접 정의
    (`@tailwindcss/typography` 미설치). 넓은 표는 페이지가 아니라 **표 자체가 가로 스크롤**된다
    (실측: 1896px 표가 832px 본문 안에서 스크롤, 페이지 가로 넘침 0).

- **404 페이지 추가**: `app/not-found.tsx` 가 없어 잘못된 주소는 Next 기본 화면이 떴다.
  사이트 톤에 맞춘 404 를 추가했다.

- **푸터 문구 정정**: "Supabase RLS 보안 준수" → "세션 기반 접근 제어 적용".
  Supabase Auth 를 쓰지 않으므로 사실이 아니었다.

**후속 수정 — 관리자 계정 탈취 구멍 차단 + PostgreSQL 전환 (2026-09-08)**

**① 비밀번호 미설정 계정 자동 선점 (심각 — 공개 배포 시 즉시 탈취)**

- 앞서 도입한 "레거시 계정은 첫 로그인 값으로 비밀번호 확정" 로직이 그대로 남아 있어,
  `admin@gitroast.dev` 에 **아무 비밀번호나 넣으면 관리자가 되는** 상태였다.
  실제 재현 확인: `whatever12345` 로 HTTP 200 → 그 세션으로 전체 DB(평가 16건, 사용자 12명) 열람 성공.
- **조치**: 비밀번호가 설정되지 않은 계정(`mock_pw_hash`)은 **로그인 자체를 차단**한다.
  설정 경로는 서버 측 스크립트 하나뿐이다:
  ```bash
  npm run set-password -- <이메일> <비밀번호>
  ```
- 검증 시연 과정에서 해당 계정이 실제로 선점됐던 것은 **미설정 상태로 되돌려 놓았다.**
  현재 `admin@gitroast.dev` 는 로그인 불가 상태이며, 쓰려면 위 스크립트로 비밀번호를 정해야 한다.
- 회귀 스크립트에 **"미설정 계정은 어떤 값으로도 로그인 불가"** 검사를 추가했다 (총 32건).

**② PostgreSQL 전환 완료**

- Docker 는 필요 없었다 — **PostgreSQL 17 이 이미 로컬에 설치·구동 중**(5432, `scram-sha-256`)이었다.
- `gitroast` 데이터베이스를 만들고 `DATABASE_URL` 을 `.env.local` 에 넣었다.
  **접속 문자열과 비밀번호는 `.env.local` 에만 있다. 이 문서에는 적지 않는다.**
- `npm run db:migrate` 로 SQLite → PostgreSQL 이관: **users 16 / evaluations 16 / favorites 0**,
  건수 대조 전부 OK. 원본 `data/gitroast.db` 는 그대로 두었다(롤백용).
- **쓰기 경로 실증**: 앱으로 신규 가입(201) → PostgreSQL 에서 조회됨, SQLite 에서는 0건.
  즉 실제로 PostgreSQL 에만 쓰고 있다. 관리자 콘솔 배지도 `🐘 PostgreSQL 활성화`.
- 검증에 쓴 임시 계정(`tester-*`, `pgtest-*`) 14개는 정리했다. 현재 users 3명.

**③ 운영에서 조용한 폴백 금지**

- 기존에는 `DATABASE_URL` 이 설정돼 있어도 접속에 실패하면 **말없이 SQLite 로 넘어가** 200 을 반환했다.
  (실험으로 확인: 접속 불가 URL을 넣어도 로그인 200, 화면에는 "SQLite 로컬 모드")
  원격 배포에서 이러면 데이터가 인스턴스 로컬에 쌓이다 재배포 때 사라진다.
- `shouldFallbackToSqlite()` 도입 — `NODE_ENV=production` 이면 폴백하지 않고 에러를 그대로 올린다.
  `DB_STRICT=true`/`false` 로 강제 지정 가능. PostgreSQL 경로의 catch 9곳에 적용.

**④ 배포 준비**

- `package.json` 에 `engines: { node: ">=22.5.0" }` — `node:sqlite` 는 22.5+ 에서만 있다.
  호스팅이 Node 20 을 고르면 import 단계에서 앱 전체가 죽는다.
- CLI 스크립트(`set-password`, `db:migrate`)는 `@next/env` 로 `.env.local` 을 읽는다.
  (`@next/env` 는 CommonJS 라 default import 필요 — named import 하면 SyntaxError)

**아직 배포하지 않은 이유 (사용자 조치 필요)**

1. **호스팅 계정 로그인** — Vercel 등은 계정 생성·로그인이 필요하고, 대신 해 줄 수 없다.
   `npx vercel` 로 브라우저 로그인 한 번이면 되고, 환경 변수 3개(`DATABASE_URL`,
   `SESSION_SECRET`, `GEMINI_API_KEY`)를 대시보드에 넣어야 한다.
   **로컬 `DATABASE_URL` 은 localhost 라 원격에서 못 쓴다** — 클라우드 DB 를 따로 붙여야 한다.
2. **API 키 재발급** — 과거 이 문서에 평문 노출됐던 Gemini/Vertex 키가 아직 그대로다.
3. **Rate Limit 부재** — 비로그인 분석이 가능하고 횟수 제한이 없어, 공개 URL 이 되면
   누구나 Gemini 호출 비용을 태울 수 있다. **공개 배포 전 필수.**

**알려진 함정 (재현 조건 포함)**

- `next build` 직후 즉시 `npm start` → 페이지 라우트만 500 (§5-5 참조). 서버 재시작으로 해결.
- 레거시 시드 계정(`mock_pw_hash`)은 **첫 로그인 시 입력한 비밀번호가 그대로 확정**된다.
  관리자 계정을 남이 먼저 선점하지 않도록 주의 (§2-1 참조).

---

### 2026-09-08 — Private(비공개) 리포지토리 분석 지원 현황 및 구현 방안

**질의**: Private 리포는 못 보는가?  
**현재 상태**: **Public 리포지토리만 분석 가능** (비공개 리포지토리는 GitHub API 정책상 존재 자체를 숨기기 위해 `404 Not Found` 반환).

**현재 코드 구조 ([`lib/github/api.ts`](file:///c:/aiffel_work/git-roast/lib/github/api.ts))**:
- 이미 `process.env.GITHUB_TOKEN`이 존재할 경우 `Authorization: Bearer <token>` 헤더를 탑재하도록 구현되어 있음.
- 단, 현재 `.env.local`에는 `GITHUB_TOKEN`이 미설정 상태임.

**Private 리포지토리 지원을 위한 3가지 구현 경로**:
1. **관리자 개인용 빠른 지원 (서버 PAT 등록)**:
   - GitHub 설정에서 `repo` (Full control of private repositories) 스코프가 있는 Personal Access Token(PAT) 발급.
   - `.env.local`에 `GITHUB_TOKEN=ghp_...` 추가 후 서버 재가동.
   - **효과**: 토큰 소유자(관리자)가 접근 권한을 가진 Private 리포 즉시 분석 가능 (단, 다른 일반 사용자의 Private 리포는 접근 불가).
2. **서비스 범용 지원 (GitHub OAuth 소셜 로그인 연동 — 권장)**:
   - GitHub OAuth App 등록 후 "GitHub으로 로그인" 플로우 탑재.
   - OAuth 요청 스코프에 `repo` (또는 `repo:status`, `public_repo` 등 세부 권한) 요청.
   - 로그인 시 발급받은 사용자의 Access Token을 세션/DB에 안전하게 암호화 보관.
   - `/api/analyze` 호출 시 해당 요청자 세션의 OAuth 토큰으로 GitHub API 호출.
   - **효과**: 모든 일반 사용자가 본인이 접근 가능한 Private 리포지토리를 안전하게 분석 가능.
3. **일회성 사용자 PAT 입력 UI 제공**:
   - 메인 화면에 "비공개 리포지토리 분석용 GitHub 토큰 입력 (선택)" 인풋 제공.
   - 서버 DB에 저장하지 않고 해당 API 호출 시 1회용 메모리로만 사용 후 폐기.
   - **효과**: OAuth 앱 심사나 추가 인증 인프라 없이 즉시 구현 가능하나, 사용자가 직접 PAT를 발급해야 하는 UX 허들 존재.

---

### 2026-09-08 — 메인 UI 문구 단일화, 루트 README.md 작성 및 GitHub Public 배포 완료

1. **메인 페이지 UI 문구 중복 제거 및 단일화 (`app/page.tsx`)**:
   - 상단 뱃지와 하단 안내문 간의 중복 문구를 정리하고, 분석창 바로 아래에 요청하신 정확한 단일 문구만 배치:
     > `공개(Public) 리포지토리만 분석 가능합니다`
2. **루트 `README.md` 및 `LICENSE` (MIT) 생성**:
   - 프로젝트 개요, 듀얼 AI 모드(매운맛 팩폭/순한맛 리뷰), `SPEC.md` 타깃 분석, 기술 스택, 아키텍처, 로컬 실행 가이드(`node >= 22.5.0`) 포함한 공식 문서 작성 완료.
3. **GitHub Public 원격 리포지토리 생성 및 최초 푸시 완료**:
   - 저장소 URL: [`https://github.com/rome777/git-roast`](https://github.com/rome777/git-roast)
   - `.env.local`, DB 파일 등 보안 민감 파일은 철저히 배제된 상태로 깨끗하게 Public Push 완료.

---

### 2026-09-08 — 배포 대상 확정(Vercel + Neon) 및 공개 배포 전 코드 정비

**① 호스팅 선택 — "완전 무료 + 상시 + Postgres" 조건으로 실제 조사**

조건을 동시에 만족하는 조합이 사실상 하나뿐이었다 (2026-09-08 기준 각 사 공식 문서 확인).

| 후보 | 탈락 사유 |
| :--- | :--- |
| Railway | 무료 티어 없음 ($1/월 크레딧은 며칠이면 소진) |
| Render | 웹 서비스 15분 후 슬립 + **무료 Postgres 가 생성 30일 뒤 만료** (활동 여부와 무관한 달력 기준) |
| Fly.io | 신규 사용자 무료 티어 폐지, 카드 필수 |
| Koyeb | 상시 무료는 맞으나 0.1 vCPU / 512MB / 인스턴스 1개 — 재배포 시 다운타임 |
| **Vercel Hobby + Neon Free** | **채택.** 함수 60초, Neon 은 만료 없음·카드 불필요 |

- Vercel Hobby 는 **상업적 이용 금지** 조항이 있고 실제로 계정을 정지시킨다.
  이 프로젝트는 **수익화 계획 없음**을 확인하고 선택했다. 수익화하면 Koyeb 으로 옮겨야 한다.
- rate limit 저장소로 Upstash 를 붙일 뻔했으나, **Neon Postgres 에 테이블 하나 두는 것으로
  해결**해서 의존성을 늘리지 않았다.

**② 요청량 제한 도입 (`lib/ratelimit.ts`, `rate_limits` 테이블)**

- 없으면 공개 URL 이 되는 순간 누구나 Gemini 비용을 무제한으로 태울 수 있었다.
- **DB 고정 윈도 카운터.** 서버리스에서는 인스턴스가 매 요청 갈아치워질 수 있어
  인메모리 카운터가 무의미하다.
- 게이트는 GitHub·Gemini 호출 **앞**에 둔다. 일을 끝낸 뒤 거절하면 비용은 이미 나갔다.
- 좁은 규칙부터 검사하고 **앞에서 걸린 요청은 뒤 카운터를 세지 않는다** —
  차단된 요청이 전역 한도를 축내면 공격자가 서비스 전체를 멈출 수 있다.
- IP 는 원문 저장하지 않고 `SESSION_SECRET` 을 키로 HMAC 해서 앞 22자만 남긴다.
- 카운터 갱신 실패 시 **문을 닫는다(503)**. 비용 방어가 목적인데 셀 수 없다고 통과시키면
  막으려던 상황이 그대로 벌어진다. 이 함수만 `handlePgError` 를 쓰지 않는 이유도 같다 —
  SQLite 로 조용히 폴백하면 인스턴스마다 카운터가 따로 생겨 제한이 사라진다.
- **실측 검증**: PostgreSQL·SQLite 양쪽 UPSERT 동작 확인, **동시 20건 요청에도 카운트 정확(20)**,
  실제 API 로 한도 초과 시 429 + `Retry-After` 확인, 다른 IP 는 영향 없음 확인.

**③ 공유 링크 메타태그 실동작화 (`app/result/[id]/`)**

- `/result/[id]` 가 통째로 클라이언트 컴포넌트라 **카카오톡·트위터가 링크를 펼칠 때
  사이트 공통 메타태그만 읽어 갔다** — 어떤 카드를 공유하든 미리보기가 전부 같았다.
  공유가 핵심인 서비스에서 기능이 죽어 있던 셈이다.
- `page.tsx` 를 서버 컴포넌트로 바꿔 `generateMetadata` 를 붙이고, 화면은
  `ResultView.tsx` (클라이언트)로 분리했다. DB 조회는 `react/cache` 로 요청당 1회.
- 서버가 이미 조회하므로 클라이언트의 `/api/evaluations/[id]` 왕복이 사라졌다.
  localStorage 보조 경로는 서버가 못 찾았을 때만 동작하도록 남겼다.
- 검증: 실제 카드 ID 로 `<title>`·`og:title`·`og:description`·`twitter:*` 가 카드별로
  다르게 렌더됨을 확인. 없는 ID 는 "찾을 수 없는 카드".

**④ 배포 사고로 이어질 두 가지 수정**

- **`node:sqlite` 를 지연 로드로** (`lib/db/database.ts`) — top-level import 라
  PostgreSQL 만 쓰는 배포에서도 런타임이 Node 22.5 미만이면 **모듈 로드 단계에서 앱 전체가
  죽었다.** SQLite 경로를 탈 때만 부르도록 바꿔 런타임 버전 제약이 사라졌다.
- **세션 쿠키 secure 판정 변경** (`lib/auth/session.ts`) — 기존에는 `NEXT_PUBLIC_SITE_URL` 이
  https 로 시작하는지를 봤는데, 이 변수는 **빌드 시점에 값이 박힌다.** 대시보드에 나중에
  넣거나 빌드에 전달되지 않으면 **운영인데도 플래그가 영영 안 켜져 세션 쿠키가 평문으로
  오간다.** 운영에서 기본으로 켜고, 로컬 http 확인 시에만 `COOKIE_SECURE=false` 로 끈다.
  (이 빌드타임 각인은 실측으로 재현했다 — 런타임에 환경변수를 줬는데 `og:url` 이
  `localhost:3000` 으로 나왔다.)
- `app/layout.tsx` 에 `metadataBase` 추가. `NEXT_PUBLIC_SITE_URL` → `SITE_URL` →
  Vercel 자동 도메인 순으로 본다.

**⑤ 실측치 (2026-09-08, 로컬 프로덕션 빌드 + 로컬 PostgreSQL)**

| 항목 | 값 |
| :--- | :--- |
| `/api/analyze` 리포 분석 (`rome777/aiffel_test`, 매운맛) | **6.8초** |
| `/api/analyze` 사용자 분석 (`rome777`, 매운맛) | **4.9초** |
| 클린 클론 `npm ci` + `npm run build` (**환경 변수 0개**) | **성공** — Vercel 첫 빌드와 동일 조건 |

- Vercel Hobby 함수 상한 60초에 여유가 크다. 다만 호스팅 기본 타임아웃이 상한보다
  낮을 수 있어 `app/api/analyze/route.ts` 에 `export const maxDuration = 60` 을 명시했다.
- 위 수치에는 서버리스 콜드스타트와 Neon 스케일투제로 웨이크업(~0.5초)이 빠져 있다.
  배포 후 다시 재야 한다.

**⑥ 회귀 검사**

- `npm run verify:auth` **32 PASS / 0 FAIL** (새 빌드 대상으로 재실행하여 확인).
  > ⚠️ **함정**: 이 스크립트는 `http://localhost:3000` 을 **하드코딩**해서 친다.
  > 빌드만 하고 서버를 재시작하지 않으면 **옛 빌드를 검사하고 통과한다.** 실제로 한 번 겪었다.

**⑦ 저장소 상태 (2026-09-08 16:30 기준)**

- 커밋 `c76e993` 이 신규 파일 2개(`lib/ratelimit.ts`, `app/result/[id]/ResultView.tsx`)를
  빠뜨린 채 만들어져 **HEAD 가 빌드되지 않는 상태였다.** 추적되지 않은 파일은
  `git commit -a` 로 담기지 않는다 — 새 파일을 만든 커밋에서는 `git status` 로
  `??` 항목을 반드시 확인해야 한다.
- `8651866` 으로 복구하고 푸시 완료. 클린 클론 빌드로 검증했다.

**⑧ 🚨 공개 배포를 막는 계정 문제 (회귀 검사가 잡아냄)**

최종 회귀 검사에서 **31 PASS / 1 FAIL**. 실패한 항목은
`비밀번호 미설정 계정은 어떤 값으로도 로그인 불가` 였고, **이 실패는 정당하다.**

- 세션 중 `admin@gitroast.dev` 에 비밀번호가 설정되었고, 그 값이 **추측하기 매우 쉬운
  형태**다. 이 계정은 `role=admin` 이라 `/admin` 콘솔 전체 — 모든 사용자의 분석 내역과
  이메일 — 에 접근한다. **이대로 공개 배포하면 계정 이름과 비밀번호를 둘 다 추측할 수 있다.**
  (실제 값은 여기 적지 않는다. 이 문서는 공개 저장소에 있다.)
- 조치: 강한 값으로 재설정하거나, 쓰지 않는 계정이면 DB 에서 제거한다.
  ```bash
  npm run set-password -- admin@gitroast.dev "충분히 긴 임의 문자열"
  ```
- 회귀 스크립트의 해당 항목은 `admin@gitroast.dev` 가 **비밀번호 미설정 상태**임을
  전제로 짜여 있다. 이 계정을 계속 쓸 거라면 검사 대상을 다른 미설정 계정으로 바꿔야
  검사가 다시 의미를 갖는다.

**⑨ 정리되지 않은 테스트 계정**

- `tester-<타임스탬프>@example.com` 계정 5개가 users 테이블에 남아 있다.
  회귀 검사(`npm run verify:auth`)가 실행할 때마다 만드는 계정이다.
- 기능에는 영향이 없지만 관리자 콘솔 사용자 목록을 어지럽힌다. 배포 전 정리 권장.
  (파괴적 작업이라 이번 세션에서는 손대지 않았다.)

**⑩ 배포 런북 (2026-09-08 작성)**

브라우저 로그인 두 번만 사람이 하고, 나머지는 명령으로 끝난다.
`vercel` CLI 는 전역 설치돼 있다 (v59.11.7).

```bash
# 언제든 현재 상태 점검 (아무것도 고치지 않는다. 읽고 판정만 한다)
npm run preflight                 # 원격 배포 기준
npm run preflight -- --local      # 로컬 개발 기준
```

**1단계 — Neon 프로젝트 (브라우저)**
[neon.com](https://neon.com) 가입 → 프로젝트 생성 → **Pooled connection** 문자열 복사.
호스트에 `-pooler` 가 붙은 쪽이어야 한다. 서버리스는 인스턴스마다 풀을 새로 만들기 때문에
직결 문자열을 쓰면 커넥션이 고갈된다.

**2단계 — 데이터 이관 (명령)**

```bash
npm run db:copy -- --to "<Neon pooled 문자열>"
npm run preflight -- --database-url "<Neon pooled 문자열>"
```

원본(로컬 PostgreSQL)은 읽기만 한다. 같은 id 는 건너뛰므로 여러 번 돌려도 안전하다.
접속 문자열을 셸 히스토리에 남기고 싶지 않으면 `TARGET_DATABASE_URL` 환경 변수를 써도 된다.

**3단계 — Vercel 로그인 (브라우저)**

```bash
vercel login
```

**4단계 — 프로젝트 연결과 환경 변수 (명령)**

```bash
vercel link
```

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))" | vercel env add SESSION_SECRET production
```

`SESSION_SECRET` 은 새로 만들어 화면에 띄우지 않고 바로 넣는다.
로컬 값을 재사용하지 않는다 — 한쪽이 유출되면 양쪽이 함께 뚫린다.

```bash
vercel env add DATABASE_URL production
vercel env add GEMINI_API_KEY production
vercel env add NEXT_PUBLIC_SITE_URL production
echo "true" | vercel env add DISABLE_DEMO_LOGIN production
```

> ⚠️ `NEXT_PUBLIC_SITE_URL` 은 **첫 빌드 전에** 넣어야 한다.
> `NEXT_PUBLIC_` 접두사 변수는 빌드 시점에 값이 코드에 박히므로, 나중에 넣으면
> 재배포 전까지 반영되지 않는다. 값은 `https://<프로젝트>.vercel.app`.

**5단계 — 배포 (명령)**

```bash
vercel deploy --prod
```

**6단계 — 배포 후 (명령)**

새 DB 는 시드 계정이 로그인 불가 상태(`mock_pw_hash`)로 들어간다. 비밀번호를 부여한다.

```bash
DATABASE_URL="<Neon pooled 문자열>" npm run set-password -- <이메일> "<충분히 긴 임의 문자열>"
```

배포 URL 에서 확인할 것:
- `/result/<카드id>` 의 공유 미리보기가 카드별로 다르게 뜨는지
- 분석을 한도 이상 호출했을 때 429 와 `Retry-After` 가 나오는지
- 관리자 콘솔 배지가 `🐘 PostgreSQL 활성화` 인지 (SQLite 로 떨어지면 데이터가 재배포 때 사라진다)

**남은 배포 전 조치 (사용자만 할 수 있는 것)**

절차 자체는 ⑩ 런북에 있다. 여기서는 **판단이나 계정이 필요한 것**만 적는다.

| # | 항목 | 상태 |
| :-- | :--- | :--- |
| 1 | `rome777@gmail.com`·`admin@gitroast.dev` 비밀번호 재설정 (⑧) | **사용자가 보류하기로 함 (2026-09-08)**. 공개 배포 전에는 반드시 처리해야 한다 — 값이 이미 git 히스토리에 공개돼 있다. |
| 2 | Gemini/Vertex API 키 재발급 | **사용자가 보류하기로 함 (2026-09-08)**. 위험도 정정: git 히스토리 전체를 훑은 결과 **API 키는 한 번도 커밋된 적이 없다** — 노출 범위는 git 이전의 로컬 파일뿐이다. 비밀번호(1번)와 달리 공개되지 않았다. |
| 3 | Neon 가입·프로젝트 생성 | 브라우저 로그인 필요 — 그 뒤 `npm run db:copy` 로 이관까지 자동 |
| 4 | `vercel login` | 브라우저 로그인 필요 — 그 뒤 ⑩ 4~5단계는 명령으로 끝 |
| 5 | `/docs` 공개 범위 판단 | **완료 (2026-09-08)** — `FINAL_CHECKLIST.md` 를 화이트리스트에서 제외했다. 보안 점검의 "미결" 항목까지 담고 있어, 공개 서비스가 아직 막지 못한 곳의 목록을 스스로 게시하는 셈이었다. `TECH_SPEC.md` 는 설계 근거라 공개 유지. |
| 6 | `tester-*` 계정 정리 | **완료 (2026-09-08)** — 분석 기록 0건 확인 후 삭제. 이후로는 `npm run db:clean-testers` 로 반복 처리 |

**Claude Code 메모리에 남긴 것** (저장소 밖이라 다른 도구·기기에서는 안 보인다)

- *동시 에이전트 세션* — 이 저장소는 여러 세션이 같은 작업 트리를 동시에 고친다.
  이번 세션에서 실제로 겪었다: 없던 `.git` 이 도중에 생겼고, 커밋하지 않은 내 변경을
  다른 세션이 무관한 메시지로 커밋해 가면서 신규 파일 2개를 빠뜨려 HEAD 가 깨졌다.
  그래서 파일·git 상태를 매번 다시 확인해야 한다는 것을 기억해 뒀다.
  (배포 대상 같은 사실은 이 문서가 이미 기록하므로 메모리에 중복 저장하지 않았다.)

**이번 세션에서 새로 만든 도구**

| 명령 | 하는 일 |
| :--- | :--- |
| `npm run preflight` | 배포 준비 상태 점검. 커밋 누락·추적되지 않은 소스 파일·평문 비밀값·localhost DB·빌드타임 변수 누락·계정 상태를 한 번에 본다. 고치지 않고 판정만 한다. |
| `npm run db:copy -- --to "<url>"` | PostgreSQL → PostgreSQL 이관. 기존 `db:migrate` 는 SQLite → PostgreSQL 전용이라 **로컬 PostgreSQL 을 클라우드로 올릴 경로가 없었다.** 원본은 읽기만 하고, 멱등하며, 건수를 대조한다. |
| `npm run db:clean-testers` | 회귀 검사가 남긴 `tester-*@example.com` 계정 정리. **기본은 미리보기**이고 `-- --yes` 를 붙여야 지운다. 분석 기록이 있는 계정은 이름이 맞아도 건드리지 않는다. |

> `npm run preflight` 는 오늘 실제로 겪은 사고(`git commit -a` 가 새 파일을 담지 않아
> HEAD 가 빌드되지 않은 것)를 잡도록 **추적되지 않은 소스 파일** 검사를 넣어 뒀다.

---

### 2026-09-08 — 🚀 운영 배포 완료 (Vercel + Neon)

**배포 결과**

| 항목 | 값 |
| :--- | :--- |
| **공개 URL** | **https://git-roast-three.vercel.app** |
| Vercel 프로젝트 | `somsaps-projects/git-roast` (Node 24.x, Next.js 프리셋) |
| DB | Neon `ep-delicate-mud-b3sfry6d-pooler...ap-southeast-1` / `neondb` (pooled, sslmode=require) |
| 이관 실적 | users 4 / evaluations 18 / favorites 0 — 건수 대조 일치 |

> ⚠️ `git-roast-somsaps-projects.vercel.app` 는 팀 스코프 별칭이라 **Vercel SSO 로 막혀 있다**(302).
> 공유에는 위의 `git-roast-three.vercel.app` 를 쓴다. `git-roast.vercel.app` 은 **남의 프로젝트**다.

**운영 환경에서 실측 검증한 것**

| 검증 | 결과 |
| :--- | :--- |
| 실제 AI 분석 (`vercel/next.js`, 순한맛) | 200 · SSS 98점 · **8.4초** (콜드스타트 + Neon 웨이크업 포함) |
| Neon 실조회 (공유 카드 API) | 200, 이관된 데이터 그대로 반환 |
| 공유 카드 메타태그 | 카드별로 다름. `og:url` 이 절대경로로 정확 |
| 요청량 제한 | 비로그인 3회 초과 시 429 |
| 데모 로그인 차단 | 403 (`DISABLE_DEMO_LOGIN=true` 적용됨) |
| 세션 쿠키 | `Secure; HttpOnly; SameSite=lax` — 운영에서 secure 플래그 실제로 켜짐 |

`maxDuration=60` 대비 8.4초라 여유가 크다. Vercel Hobby 함수 상한에 걸릴 일은 없다.

**설정 메모**

- 운영 `SESSION_SECRET` 은 **로컬과 다른 값을 새로 생성해** 주입했다. 화면에 띄우지 않고
  파이프로 넣었으므로 어디에도 기록이 없다. 필요하면 다시 생성해 교체한다.
- `NEXT_PUBLIC_SITE_URL` 을 명시했지만, 없어도 `app/layout.tsx` 의 `resolveSiteUrl()` 이
  `VERCEL_PROJECT_PRODUCTION_URL` 로 폴백해 정상 동작하는 것을 실제로 확인했다.
- `vercel link` 가 `.gitignore` 에 `.vercel` 과 `.env*` 를 추가했다. `.env*` 가
  `.env.example` 까지 가리므로 `!.env.example` 예외를 덧붙였다.
- **GitHub 자동 배포는 연결되지 않았다.** `vercel git connect` 가 실패한다 —
  Vercel 대시보드에서 GitHub 앱 권한을 한 번 승인해야 한다. 그전까지는
  `vercel deploy --prod` 로 수동 배포한다.

**🚨 배포 직후 확인된 노출 (즉시 조치 필요)**

공개 URL 에서 `admin@gitroast.dev` 로 **로그인이 실제로 성공한다(HTTP 200).**
비밀번호가 공개 git 히스토리(⑧ 참조)에 남아 있고, 이 계정은 `role=admin` 이라
`/admin` 콘솔 — 전체 사용자의 분석 내역과 이메일 — 이 열린다.
`rome777@gmail.com` 도 같은 값이다.

로컬에서만 돌 때는 보류해도 됐지만, **지금은 공개 서비스다.**

```bash
DATABASE_URL="<Neon pooled 문자열>" npm run set-password -- admin@gitroast.dev "충분히 긴 임의 문자열"
DATABASE_URL="<Neon pooled 문자열>" npm run set-password -- rome777@gmail.com "다른 임의 문자열"
```

`.env.local` 의 `TARGET_DATABASE_URL` 이 그 문자열이므로 아래처럼 써도 된다.

```bash
DATABASE_URL="$TARGET_DATABASE_URL" npm run set-password -- admin@gitroast.dev "..."
```
