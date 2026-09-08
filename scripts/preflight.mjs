// 배포 직전 점검
//
//   npm run preflight                          # .env.local 기준으로 배포 준비 상태 점검
//   npm run preflight -- --database-url "..."  # 배포 대상 DB(Neon 등)를 직접 지정해 점검
//   npm run preflight -- --local               # 로컬 개발 기준 (localhost DB 를 문제 삼지 않음)
//
// 이 스크립트는 아무것도 고치지 않는다. 읽고 판정만 한다.
// FAIL 이 하나라도 있으면 종료 코드 1.

import { execSync } from "node:child_process";
import fs from "node:fs";
import pg from "pg";

import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd(), true, { info: () => {}, error: console.error });

const argv = process.argv.slice(2);
const isLocal = argv.includes("--local");
const dbArg = argv[argv.indexOf("--database-url") + 1];
const dbUrl = (argv.includes("--database-url") ? dbArg : null) || process.env.DATABASE_URL;

const results = [];
const ok = (name, detail = "") => results.push({ level: "PASS", name, detail });
const warn = (name, detail = "") => results.push({ level: "WARN", name, detail });
const fail = (name, detail = "") => results.push({ level: "FAIL", name, detail });

function sh(cmd) {
  try {
    return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- 1. 저장소
const dirty = sh("git status --porcelain");
if (dirty === null) warn("git 저장소", "git 저장소가 아니거나 git 을 쓸 수 없습니다");
else if (dirty) fail("작업 트리 정리", `커밋되지 않은 변경 ${dirty.split("\n").length}건 — 배포는 원격 HEAD 를 빌드합니다`);
else ok("작업 트리 정리");

// 추적되지 않은 파일을 소스가 import 하고 있지 않은지.
// (오늘 실제로 겪은 사고: git commit -a 는 새 파일을 담지 않아 HEAD 가 빌드되지 않았다)
const untracked = sh("git ls-files --others --exclude-standard");
if (untracked) {
  const suspicious = untracked.split("\n").filter((f) => /\.(ts|tsx|mjs|js)$/.test(f));
  if (suspicious.length) fail("추적되지 않은 소스 파일", suspicious.join(", "));
  else ok("추적되지 않은 소스 파일", "없음");
} else ok("추적되지 않은 소스 파일", "없음");

const localHead = sh("git rev-parse HEAD");
const remoteHead = sh("git rev-parse origin/main");
if (localHead && remoteHead) {
  localHead === remoteHead ? ok("원격 동기화", "origin/main 과 일치")
    : fail("원격 동기화", "origin/main 과 다릅니다. push 하지 않으면 옛 코드가 배포됩니다");
}

// ---------------------------------------------------------------- 2. 비밀값 유출
const tracked = (sh("git ls-files") || "").split("\n").filter(Boolean);
const SECRET_PATTERNS = [
  [/AIza[0-9A-Za-z_-]{30,}/, "Google API 키"],
  [/gh[pousr]_[0-9A-Za-z]{30,}/, "GitHub 토큰"],
  [/postgres(ql)?:\/\/[^\s"'`]*:[^\s"'`@]{4,}@(?!localhost|127\.0\.0\.1|호스트|사용자)/, "DB 접속 문자열"],
];
const leaks = [];
for (const f of tracked) {
  if (!/\.(md|ts|tsx|mjs|js|json|ya?ml|env\.example)$/.test(f)) continue;
  let text;
  try { text = fs.readFileSync(f, "utf8"); } catch { continue; }
  for (const [re, label] of SECRET_PATTERNS) {
    const m = text.match(re);
    if (m && !/your-|example|xxxx|비밀번호|placeholder/i.test(m[0])) leaks.push(`${f} (${label})`);
  }
}
leaks.length ? fail("추적 파일 비밀값", leaks.join(", ")) : ok("추적 파일 비밀값", "패턴 없음");

// ---------------------------------------------------------------- 3. 환경 변수
const secret = process.env.SESSION_SECRET;
if (!secret) fail("SESSION_SECRET", "없음 — 모든 인증이 실패합니다");
else if (secret.length < 32) fail("SESSION_SECRET", `${secret.length}자 — 32자 이상이어야 합니다`);
else ok("SESSION_SECRET", `${secret.length}자`);

process.env.GEMINI_API_KEY ? ok("GEMINI_API_KEY", "설정됨")
  : warn("GEMINI_API_KEY", "없음 — 내장 목업 제너레이터로 동작합니다");

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
if (!siteUrl) (isLocal ? warn : fail)("NEXT_PUBLIC_SITE_URL", "없음 — 공유 링크 메타태그의 기준 주소가 localhost 로 박힙니다");
else if (!isLocal && !siteUrl.startsWith("https://")) fail("NEXT_PUBLIC_SITE_URL", `${siteUrl} — 배포에는 https 주소여야 합니다`);
else ok("NEXT_PUBLIC_SITE_URL", siteUrl);

if (!isLocal) {
  process.env.DISABLE_DEMO_LOGIN === "true" ? ok("DISABLE_DEMO_LOGIN", "true")
    : warn("DISABLE_DEMO_LOGIN", "true 가 아님 — 누구나 데모 계정으로 로그인할 수 있습니다");
}

// ---------------------------------------------------------------- 4. 데이터베이스
if (!dbUrl?.startsWith("postgres")) {
  fail("DATABASE_URL", "PostgreSQL 접속 문자열이 없습니다 (배포에서 SQLite 는 재배포 때 사라집니다)");
} else {
  const host = (() => { try { return new URL(dbUrl).hostname; } catch { return "?"; } })();
  const isLocalDb = /^(localhost|127\.0\.0\.1)$/.test(host);

  if (isLocalDb && !isLocal) fail("DATABASE_URL 위치", `${host} — 원격 배포에서 접근할 수 없습니다. 클라우드 DB 가 필요합니다`);
  else ok("DATABASE_URL 위치", host);

  if (!isLocalDb && host.includes("neon.tech") && !host.includes("-pooler"))
    warn("Neon 연결 방식", "pooled 문자열이 아닙니다 — 서버리스에서 커넥션이 고갈될 수 있습니다 (-pooler 호스트 권장)");

  const pool = new pg.Pool({
    connectionString: dbUrl,
    ssl: isLocalDb ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
  try {
    await pool.query("SELECT 1");
    ok("DB 접속", "성공");

    const t = (await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public';`
    )).rows.map((r) => r.table_name);
    const missing = ["users", "evaluations", "favorites", "rate_limits"].filter((x) => !t.includes(x));
    missing.length ? warn("스키마", `없는 테이블: ${missing.join(", ")} (앱 첫 기동 시 자동 생성됩니다)`)
      : ok("스키마", "테이블 4개 모두 존재");

    if (t.includes("users")) {
      const users = (await pool.query(`SELECT email, role, password_hash FROM users;`)).rows;
      const admins = users.filter((u) => u.role === "admin");
      const unset = users.filter((u) => !u.password_hash?.startsWith("scrypt$"));
      const testers = users.filter((u) => /^tester-\d+@/.test(u.email));

      admins.length ? ok("관리자 계정", `${admins.length}명: ${admins.map((a) => a.email).join(", ")}`)
        : warn("관리자 계정", "없음 — /admin 콘솔에 아무도 접근할 수 없습니다");

      if (unset.length) warn("비밀번호 미설정 계정", `${unset.length}건 (로그인 차단됨): ${unset.map((u) => u.email).join(", ")}`);
      else ok("비밀번호 미설정 계정", "없음");

      testers.length ? warn("테스트 계정 잔존", `${testers.length}건 — 회귀 검사가 남긴 계정입니다`)
        : ok("테스트 계정 잔존", "없음");
    }
  } catch (err) {
    fail("DB 접속", err.message);
  } finally {
    await pool.end().catch(() => {});
  }
}

// ---------------------------------------------------------------- 5. 런타임
const required = JSON.parse(fs.readFileSync("package.json", "utf8")).engines?.node;
if (required) ok("engines.node", `${required} (현재 ${process.version})`);

// ---------------------------------------------------------------- 출력
const ICON = { PASS: "  OK  ", WARN: " WARN ", FAIL: " FAIL " };
console.log("\n배포 준비 점검" + (isLocal ? " (로컬 기준)" : " (원격 배포 기준)") + "\n");
for (const r of results) {
  console.log(`[${ICON[r.level]}] ${r.name}${r.detail ? "  —  " + r.detail : ""}`);
}

const fails = results.filter((r) => r.level === "FAIL").length;
const warns = results.filter((r) => r.level === "WARN").length;
console.log(`\n결과: ${results.length - fails - warns} PASS / ${warns} WARN / ${fails} FAIL`);
if (fails) console.log("\nFAIL 항목을 해결하기 전에는 배포하지 마세요.");
process.exit(fails ? 1 : 0);
