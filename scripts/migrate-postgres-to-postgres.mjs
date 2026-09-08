// PostgreSQL -> PostgreSQL 데이터 이관 (로컬 -> Neon 등 클라우드)
//
//   npm run db:copy -- --to "postgresql://...neon.tech/neondb?sslmode=require"
//
// 원본은 기본적으로 .env.local 의 DATABASE_URL 이다. --from 으로 바꿀 수 있다.
//
// 기존 db:migrate 는 SQLite -> PostgreSQL 전용이라, 이미 PostgreSQL 로 옮긴 뒤
// 클라우드로 다시 올릴 때 쓸 수 있는 경로가 없었다. 이 스크립트가 그 자리를 메운다.
//
// - 원본은 읽기만 한다. 절대 쓰지 않는다.
// - 같은 id 가 대상에 이미 있으면 건너뛴다(ON CONFLICT DO NOTHING) — 여러 번 돌려도 안전하다.
// - rate_limits 는 옮기지 않는다. 수명이 짧은 카운터라 옮길 이유가 없고,
//   윈도 키가 시각 기반이라 옮기면 오히려 낡은 값이 남는다. 테이블만 만들어 둔다.

import pg from "pg";

// @next/env 는 CommonJS 라 named import 가 안 된다.
import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd(), true, { info: () => {}, error: console.error });

function argOf(name) {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
}

const fromUrl = argOf("--from") || process.env.SOURCE_DATABASE_URL || process.env.DATABASE_URL;
const toUrl = argOf("--to") || process.env.TARGET_DATABASE_URL;

if (!fromUrl?.startsWith("postgres")) {
  console.error("원본 접속 문자열이 없습니다. .env.local 의 DATABASE_URL 또는 --from 을 지정하세요.");
  process.exit(1);
}
if (!toUrl?.startsWith("postgres")) {
  console.error(`대상 접속 문자열이 없습니다.

  npm run db:copy -- --to "postgresql://사용자:비밀번호@호스트/DB?sslmode=require"

Neon 은 대시보드의 "Pooled connection" 문자열을 쓰세요 (호스트에 -pooler 가 붙은 쪽).`);
  process.exit(1);
}

/** 접속 문자열에서 사람이 읽을 식별자만 뽑는다. 비밀번호는 절대 출력하지 않는다. */
function describe(url) {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.port ? ":" + u.port : ""}${u.pathname}`;
  } catch {
    return "(해석 불가)";
  }
}

if (describe(fromUrl) === describe(toUrl)) {
  console.error("원본과 대상이 같은 데이터베이스입니다. 중단합니다.");
  process.exit(1);
}

function poolFor(url) {
  return new pg.Pool({
    connectionString: url,
    ssl: url.includes("localhost") || url.includes("127.0.0.1") ? false : { rejectUnauthorized: false },
    max: 4,
  });
}

const src = poolFor(fromUrl);
const dst = poolFor(toUrl);

console.log(`원본: ${describe(fromUrl)}`);
console.log(`대상: ${describe(toUrl)}\n`);

// 앱과 동일한 스키마를 대상에 보장한다 (앱이 아직 한 번도 안 떴을 수 있다).
await dst.query(`
  CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(100) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS evaluations (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_name VARCHAR(255) NOT NULL,
    mode VARCHAR(50) NOT NULL,
    tier VARCHAR(20) NOT NULL,
    score INTEGER NOT NULL,
    title TEXT NOT NULL,
    one_liner TEXT NOT NULL,
    summary TEXT NOT NULL,
    details JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS favorites (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    evaluation_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS rate_limits (
    bucket VARCHAR(200) PRIMARY KEY,
    hits INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL
  );
`);

const TABLES = {
  users: ["id", "email", "password_hash", "role", "created_at"],
  evaluations: [
    "id", "user_id", "user_email", "target_type", "target_name", "mode",
    "tier", "score", "title", "one_liner", "summary", "details", "created_at",
  ],
  favorites: ["id", "user_id", "evaluation_id", "created_at"],
};

const moved = {};
const skipped = {};

for (const [table, cols] of Object.entries(TABLES)) {
  moved[table] = 0;
  skipped[table] = 0;

  const rows = (await src.query(`SELECT ${cols.join(", ")} FROM ${table};`)).rows;
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");

  for (const row of rows) {
    const values = cols.map((c) => {
      // details 는 JSONB 라 드라이버가 객체로 돌려준다. 다시 문자열로 넣는다.
      const v = row[c];
      return c === "details" && v !== null && typeof v === "object" ? JSON.stringify(v) : v;
    });
    const r = await dst.query(
      `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING;`,
      values
    );
    r.rowCount ? moved[table]++ : skipped[table]++;
  }
}

// 옮긴 뒤 양쪽 건수를 실제로 세어 대조한다.
console.log("이관 결과 (신규 / 이미 있어 건너뜀):");
for (const t of Object.keys(TABLES)) {
  console.log(`  ${t.padEnd(12)} ${String(moved[t]).padStart(4)} / ${String(skipped[t]).padStart(4)}`);
}

console.log("\n건수 대조:");
let allOk = true;
for (const t of Object.keys(TABLES)) {
  const a = parseInt((await src.query(`SELECT count(*) c FROM ${t};`)).rows[0].c, 10);
  const b = parseInt((await dst.query(`SELECT count(*) c FROM ${t};`)).rows[0].c, 10);
  const ok = b >= a;
  if (!ok) allOk = false;
  console.log(`  ${t.padEnd(12)} 원본 ${String(a).padStart(4)}  ->  대상 ${String(b).padStart(4)}  ${ok ? "OK" : "불일치!"}`);
}

await src.end();
await dst.end();

console.log(allOk ? "\n이관 완료. 원본은 그대로 두었습니다." : "\n건수가 맞지 않습니다. 확인이 필요합니다.");
process.exit(allOk ? 0 : 1);
