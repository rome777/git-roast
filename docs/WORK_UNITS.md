# [단위 기술 작업 명세서] GitRoast - 모듈별 구현 및 독립 검증 가이드 (WORK_UNITS)

---

## 1. 모듈화 원칙 및 지침 (Modularization Principles)

> **노션 가이드라인 준수**:
> 1. **컨텍스트 오버플로우 방지**: 한 번에 모든 기능을 한 세션에서 구현하지 않고, 작고 명확한 순서 단위로 나누어 구현합니다.
> 2. **독립 검증 가능성 (Mock-Driven Verification)**: 각 작업 단위는 백엔드나 외부 API가 아직 없더라도 목업(Mock) 데이터를 사용하여 독립적으로 실행 및 검증 가능해야 합니다.
> 3. **세션 전환 컨텍스트 요약**: 단위 작업이 완료될 때마다 다음 세션에서 바로 이어받을 수 있도록 변경 사항과 상태를 명확히 기록합니다.

---

## 2. 단위 기술 작업 목록 (Work Units Overview)

| 순서 | 모듈 명칭 | 핵심 산출물 | 독립 테스트 검증 방식 |
| :---: | :--- | :--- | :--- |
| **Unit 1** | **프로젝트 기초 환경 & 쉘 레이아웃** | Next.js 14, Tailwind, 공통 네비게이션, 테마 | 로컬 웹 서버 구동 및 반응형 화면 렌더링 확인 |
| **Unit 2** | **Supabase 인증 & 보안 세션 가드** | 회원가입/로그인 폼, 세션 미들웨어, RLS SQL | 테스트 계정 생성 및 미인증 다이렉트 URL 접근 차단 테스트 |
| **Unit 3** | **GitHub 데이터 수집기 & Mock 시스템** | GitHub Fetcher, 데이터 가공기, Mock Fallback | 정상 유저, 존재하지 않는 유저, Mock 모드 API 단위 테스트 |
| **Unit 4** | **AI 듀얼 평가 엔진 (Roast & Review)** | Gemini API 연동, JSON Schema 유효성 검사기 | 샘플 GitHub 데이터 입력 시 매운맛/순한맛 JSON 출력 확인 |
| **Unit 5** | **결과 시각화 카드 & 이미지 저장/공유** | 결과 대시보드, 레이더 차트, 이미지 캡처 다운로드 | 카드 렌더링, PNG 다운로드 파일 무결성 및 공유 링크 검증 |

---

## 3. 세부 단위 작업 명세 (Detailed Work Units)

---

### [Unit 1] 프로젝트 기초 환경 구성 & 쉘 레이아웃 (Project Setup & Shell UI)

- **목표**: Next.js 14 App Router 기반 프로젝트를 초기화하고, 다크 모드 기반의 세련된 네비게이션 바, 푸터, 레이아웃 골격을 구축합니다.
- **구현 대상 파일**:
  - `package.json` (Next.js, TypeScript, Tailwind, Lucide-react 등 의존성)
  - `tailwind.config.ts`, `globals.css` (색상 테마 및 네온 폰트 스타일링)
  - `components/layout/Navbar.tsx` (로고, 로그인 상태 표시, 모드 토글)
  - `components/layout/Footer.tsx` (서비스 소개, GitHub 링크)
  - `app/layout.tsx`, `app/page.tsx` (랜딩 쉘)
- **독립 테스트 검증 방법**:
  - `npm run dev` 구동 후 `http://localhost:3000` 접속.
  - PC 및 모바일 뷰포트에서 네비게이션 바와 레이아웃이 깨짐 없이 렌더링되는지 확인.
- **완료 체크리스트**:
  - [ ] TypeScript 컴파일 에러가 0건인가?
  - [ ] Tailwind CSS 스타일이 정상 적용되는가?
  - [ ] 모바일/데스크톱 반응형 뷰포트가 올바르게 작동하는가?

---

### [Unit 2] Supabase 인증 및 권한 가드 & RLS 구축 (Auth & Security Layer)

- **목표**: Supabase Auth와 클라이언트/서버 SDK를 연동하여 가입/로그인을 구현하고, 로그인하지 않은 사용자의 무단 분석 요청을 차단하는 세션 가드를 구현합니다.
- **구현 대상 파일**:
  - `lib/supabase/client.ts` (클라이언트 전용 브라우저 클라이언트)
  - `lib/supabase/server.ts` (서버 컴포넌트/액션 전용 쿠키 기반 클라이언트)
  - `middleware.ts` (보호된 라우트 `/dashboard`, `/analyze` 보호)
  - `app/login/page.tsx`, `app/signup/page.tsx` (로그인/회원가입 폼 및 유효성 검사)
  - `supabase/schema.sql` (profiles, evaluations, favorites DDL 및 RLS 정책 스크립트)
- **독립 테스트 검증 방법**:
  - Supabase 환경변수 없이도 로컬에서 동작 가능한 Mock Auth 스위치 지원.
  - 비로그인 상태에서 보호된 페이지 접속 시 `/login`으로 자동 리다이렉트 확인.
- **완료 체크리스트**:
  - [ ] 이메일/비밀번호 형식 유효성 검사가 클라이언트/서버 양쪽에서 동작하는가?
  - [ ] Service Role Key가 클라이언트 번들에 노출되지 않았는가?
  - [ ] 로그아웃 시 세션 쿠키가 정상 폐기되는가?

---

### [Unit 3] GitHub API 수집 엔진 & Mock Fallback 시스템 (Data Ingestion)

- **목표**: 입력받은 GitHub 아이디 또는 리포지토리 URL을 검증하고, 공개 API를 통해 평가에 필요한 활동 통계를 수집·정제합니다. GitHub API Rate Limit(시간당 60회)에 대비해 실감 나는 Mock 데이터를 자동으로 제공하는 기능을 포함합니다.
- **구현 대상 파일**:
  - `lib/github/types.ts` (GitHub 유저/리포 메타데이터 타입 정의)
  - `lib/github/api.ts` (GitHub REST API 호출 함수 및 정규화기)
  - `lib/github/mockData.ts` (초보자, 고수, 방치된 계정 등 3종 샘플 데이터셋)
- **독립 테스트 검증 방법**:
  - 실제 존재하는 아이디(`torvalds`), 존재하지 않는 아이디(`this-user-does-not-exist-xyz`), 빈 입력에 대한 단위 테스트.
  - API 토큰이 없거나 한도 초과 시 안내 메시지와 함께 Mock 모드로 매끄럽게 전환되는지 확인.
- **완료 체크리스트**:
  - [ ] 존재하지 않는 깃허브 아이디 입력 시 404 에러를 친절한 안내 문구로 반환하는가?
  - [ ] 잔디(커밋), 주력 언어 비율, 최근 리포지토리 정보가 올바르게 파싱되는가?
  - [ ] 네트워크 차단 환경에서도 Mock 모드로 전체 파이프라인 검증이 가능한가?

---

### [Unit 4] AI 듀얼 평가 엔진 (Roast & Review AI Core)

- **목표**: Google Gemini API와 프롬프트 엔지니어링을 결합하여, GitHub 데이터를 바탕으로 구조화된 JSON 형식의 [매운맛 팩폭] 또는 [순한맛 커리어 피드백]을 생성합니다.
- **구현 대상 파일**:
  - `lib/ai/prompts.ts` (매운맛/순한맛 전용 시스템 프롬프트 및 티어 판정 기준 정의)
  - `lib/ai/evaluator.ts` (Gemini API 호출 및 Zod 기반 JSON 파싱/검증)
  - `lib/ai/mockEvaluations.ts` (오프라인/API 키 부재 시 사용할 사전 생성 평가 결과)
- **독립 테스트 검증 방법**:
  - Unit 3의 Mock GitHub 데이터를 넘겨주어 AI 평가 엔진 단독 실행.
  - 반환된 결과가 지정된 JSON 스키마(티어, 레이더 차트 5대 지표, 하이라이트 문구)에 부합하는지 테스트.
- **완료 체크리스트**:
  - [ ] AI 응답이 마크다운 블록 없이 순수 JSON으로 완벽하게 파싱되는가?
  - [ ] 티어 등급(`SSS` ~ `F`)과 레이더 점수(0~100)가 유효 범위 내에 있는가?
  - [ ] 프롬프트 인젝션(사용자명에 악의적 프롬프트 주입) 시도가 무력화되는가?

---

### [Unit 5] 결과 시각화 카드, 이미지 저장 & 공유 (Visual Card & History)

- **목표**: 최종 평가 결과를 한눈에 들어오는 사이버펑크/네온 스타일의 카드 UI로 렌더링하고, 고화질 이미지 다운로드 및 Supabase 저장/공유 링크 기능을 완성합니다.
- **구현 대상 파일**:
  - `components/evaluation/EvaluationCard.tsx` (핵심 결과 카드 컴포넌트)
  - `components/evaluation/RadarChart.tsx` (Recharts 기반 5대 역량 방사형 차트)
  - `components/evaluation/TierBadge.tsx` (티어별 애니메이션 뱃지)
  - `app/result/[id]/page.tsx` (공유 가능한 단독 결과 뷰 페이지)
  - `app/dashboard/page.tsx` (내 과거 평가 히스토리 목록 및 즐겨찾기)
- **독립 테스트 검증 방법**:
  - 목업 평가 결과를 넣어 카드 렌더링 확인.
  - '이미지 다운로드' 버튼 클릭 시 PNG 파일이 정상 생성되는지 확인.
  - 고유 URL 접속 시 로그인 없이도 해당 공개 카드가 조회되는지 확인.
- **완료 체크리스트**:
  - [ ] html-to-image 실행 시 스타일 깨짐 없이 고해상도 PNG가 다운로드되는가?
  - [ ] 내 히스토리 목록에 방금 생성된 평가가 즉시 반영되는가?
  - [ ] 타인의 비공개(private) 평가 데이터는 URL로 직접 접근해도 차단되는가?
