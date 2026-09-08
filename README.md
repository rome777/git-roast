# 🔥 GitRoast (깃로스트)

**배포:** https://git-roast-three.vercel.app

> **"당신의 깃허브, 잔디밭인가요 사막인가요?"**  
> GitHub 공개 리포지토리와 개발자 프로필을 AI(Google Gemini 2.5 Flash)로 심층 해부하여, 뼈 때리는 팩폭(Roast)과 시니어 아키텍트의 기술 리뷰(Review)를 생성하는 풀스택 서비스입니다.

[![Next.js](https://img.shields.io/badge/Next.js-14.2.15-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8?logo=tailwind-css)](https://tailwindcss.com/)
[![Gemini](https://img.shields.io/badge/Google%20Gemini-2.5%20Flash-8E75B2?logo=google)](https://ai.google.dev/)
[![Database](https://img.shields.io/badge/Database-PostgreSQL%20%7C%20SQLite-336791?logo=postgresql)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

---

## ✨ 핵심 기능 (Features)

### 1. 듀얼 AI 평가 모드
- 🔥 **매운맛 팩폭 (Roast)**:
  - 실제 커밋 메시지("제발 돼라", "fix typo"), 테스트 코드 부재, Co-Author(Claude/Copilot 등) 대필 흔적, 기획문서(SPEC) 대비 실제 코드의 괴리를 촌철살인으로 풍자합니다.
- 💼 **순한맛 리뷰 (Review)**:
  - 20년 차 수석 소프트웨어 아키텍트의 관점에서 디렉토리 구조, 의존성 패키지의 적정성, 문서화 품질, 단위 테스트 구축 여부를 진단하고 개선 로드맵을 제안합니다.

### 2. 단일 리포지토리 & 특정 파일(`SPEC.md`) 정밀 타깃팅
- 단순 리포지토리 주소뿐만 아니라, 특정 파일 경로가 포함된 URL(`https://github.com/owner/repo/blob/main/SPEC.md`) 입력 시:
  - 리포 전체의 커밋 이력, 디렉토리 구조, 패키지 의존성을 수집함과 동시에
  - 지정된 파일(`SPEC.md`)의 원문을 직접 다운로드하여 **"기획문서에 적힌 아키텍처와 실제 코드 구현 간의 일치도 및 완성도"**를 교차 검증(Cross-Check)합니다.

### 3. 공개(Public) 리포지토리 & 프로필 전용
- GitHub 정책을 준수하여 전체 공개된 Public 리포지토리 및 사용자 프로필만 안전하게 분석합니다.

### 4. 개인 히스토리 보관함 (`/dashboard`)
- 일반 사용자는 **자신이 분석한 기록만** 격리되어 조회 가능합니다.
- 평가 결과 카드 PNG 이미지 다운로드, 링크 공유, 즐겨찾기 등록 지원.

### 5. 슈퍼 관리자 콘솔 (`/admin`)
- 전체 사용자가 생성한 분석 내역 일괄 모니터링
- **다중 필터링**: 순한맛/매운맛 모드 필터, 리포/유저 대상 필터, 작성자별 원클릭 필터, 실시간 키워드 검색
- 안전한 DB 영구 삭제 기능 및 시스템 통계 대시보드

### 6. 무중단 듀얼 DB 아키텍처
- `DATABASE_URL` 설정 시: **PostgreSQL 17** (`pg.Pool`) 완전 연동
- `DATABASE_URL` 미설정 시: 내장 **SQLite** (`node:sqlite`) 자동 Fallback 동작 — **로컬 개발 전용입니다.** 운영(`NODE_ENV=production`)에서는 폴백하지 않고 에러를 냅니다. 인스턴스마다 데이터가 갈라지고 재배포 때 사라지기 때문입니다.

---

## 🛠️ 기술 스택 (Tech Stack)

| 구분 | 기술 스택 |
| :--- | :--- |
| **Frontend & Framework** | Next.js 14.2.15 (App Router), React 18, TypeScript, Tailwind CSS, Lucide React |
| **AI Inference Engine** | Google Gemini 2.5 Flash (`gemini-2.5-flash`), Thinking Token 예산 최적화 (`8192` tokens) |
| **Authentication & Security** | scrypt 비밀번호 해싱, HMAC-SHA256 세션 서명 쿠키 (`httpOnly`), timingSafeEqual |
| **Database** | PostgreSQL 17 / SQLite (`node:sqlite`), 마이그레이션 스크립트 내장 |
| **External API** | GitHub REST API v3 (Octokit 대용 경량 fetch) |

---

## 📂 프로젝트 구조 (Directory Structure)

```text
git-roast/
├── app/
│   ├── page.tsx                      # 메인 분석기 (1200x1920 반응형, 모드 토글)
│   ├── admin/page.tsx                # 관리자 콘솔 (다중 필터, 모니터링)
│   ├── dashboard/page.tsx            # 개인 분석 히스토리 보관함
│   ├── login/page.tsx                # 로그인 화면
│   ├── signup/page.tsx               # 회원가입 화면
│   ├── result/[id]/                  # 공유 카드 (page.tsx 서버 렌더 + 카드별 OG 태그, ResultView.tsx 화면)
│   └── api/                          # Next.js API Routes (analyze, auth, admin, history)
├── components/
│   ├── evaluation/                   # EvaluationCard, RadarChart, TierBadge
│   └── layout/                       # Navbar, Footer
├── lib/
│   ├── ai/                           # evaluator.ts (Gemini 연동), prompts.ts
│   ├── auth/                         # session.ts (HMAC 서명), password.ts (scrypt)
│   ├── db/                           # database.ts (PostgreSQL/SQLite 듀얼 엔진)
│   ├── github/                       # api.ts (GitHub 데이터 수집), parser.ts (URL 정밀 파싱)
│   └── ratelimit.ts                  # 분석 요청량 제한 (DB 고정 윈도 카운터)
├── docs/                             # PRD.md, TECH_SPEC.md, WORK_UNITS.md
├── scripts/                          # DB 이관, 비밀번호 설정, 배포 전 점검(preflight), 회귀 검증
└── HANDOVER.md                       # 개발 인수인계 및 운영 상태 실시간 기록 문서
```

---

## 🚀 빠른 시작 가이드 (Quick Start)

### 1. 요구 사항 (Prerequisites)
- **Node.js 22.5.0 이상** (SQLite 폴백에 쓰이는 `node:sqlite` 내장 모듈 때문). PostgreSQL 만 쓴다면 지연 로드라 더 낮은 버전에서도 동작하지만, 공식 지원 범위는 22.5.0 이상이다.
- npm 10 이상

### 2. 설치 (Installation)
```bash
# 저장소 복제
git clone https://github.com/rome777/git-roast.git
cd git-roast

# 의존성 패키지 설치
npm install
```

### 3. 환경 변수 설정 (Environment Variables)
`.env.example` 파일을 복사하여 `.env.local`을 생성하고 필요한 키를 입력합니다:
```bash
cp .env.example .env.local
```

```env
# Google Gemini API 키 (필수: https://aistudio.google.com/)
GEMINI_API_KEY=your_gemini_api_key_here

# 세션 서명 비밀키 (필수: 32자 이상 임의 문자열)
SESSION_SECRET=your_super_secret_signing_key_here

# PostgreSQL 연결 문자열 (선택: 미입력 시 data/gitroast.db SQLite로 자동 동작)
DATABASE_URL=postgresql://postgres:password@localhost:5432/gitroast

# 앱 주소 (공유 링크 미리보기의 기준 주소)
# 주의: NEXT_PUBLIC_ 접두사 변수는 빌드 시점에 값이 코드에 박힙니다.
# 배포 후에 바꾸려면 재배포가 필요합니다.
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

전체 항목과 설명은 [`.env.example`](./.env.example) 을 참고하세요.
분석 요청량 상한(`RATE_LIMIT_*`)은 미설정 시 기본값으로 동작하므로 로컬 실행에는 따로 넣지 않아도 됩니다.

### 4. 로컬 실행 (Run)
```bash
# 개발 서버 실행
npm run dev

# 프로덕션 빌드 및 실행
npm run build
npm start
```
브라우저에서 `http://localhost:3000`으로 접속합니다.

---

## 🔒 보안 및 권한 정책 (Security)

- **비밀번호 단방향 암호화**: Node.js 내장 `crypto.scrypt` + Salt로 암호화하여 DB에 안전하게 저장됩니다.
- **세션 위변조 방지**: 세션 쿠키는 HMAC-SHA256으로 서명되며 `httpOnly`, `sameSite: lax` 속성으로 XSS 및 탈취를 방어합니다.
- **권한 재검증**: 관리자 권한(`admin`) 판정 시 쿠키의 payload를 맹신하지 않고 항상 DB의 실시간 Role을 재조회합니다.
- **비공개 리포지토리 안전**: 현재 서비스는 공개(Public) 리포지토리만 조회하도록 제한되어 있어 비공개 소스코드가 의도치 않게 노출되지 않습니다.
- **분석 요청량 제한**: 분석 1건마다 AI 추론 비용이 발생하므로, IP·계정·서비스 전체 단위로 요청 횟수 상한을 둡니다. 한도를 넘으면 `429` 와 함께 재시도 가능 시각을 알려 줍니다. 제한 카운터에 IP 원문은 저장하지 않고 복원 불가능한 해시만 남깁니다.

---

## 📄 라이선스 (License)

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.
