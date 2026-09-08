// SQLite -> PostgreSQL 데이터 이관
//
//   DATABASE_URL 을 설정한 뒤:  npm run db:migrate
//
// data/gitroast.db 의 users / evaluations / favorites 를 PostgreSQL 로 옮긴다.
// 같은 id 가 이미 있으면 건너뛴다(ON CONFLICT DO NOTHING) — 여러 번 돌려도 안전하다.
// 원본 SQLite 파일은 건드리지 않는다.

import path from "node:path";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import pg from "pg";

// @next/env 는 CommonJS 라 named import 가 안 된다.
import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;

// Next 와 같은 방식으로 .env.local / .env 를 읽는다 (CLI 실행 시 필요).
loadEnvConfig(process.cwd(), true, { info: () => {}, error: console.error });


const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!dbUrl || !dbUrl.startsWith("postgres")) {
  console.error("DATABASE_URL 이 설정되지 않았습니다. PostgreSQL 접속 문자열을 먼저 넣어 주세요.");
  process.exit(1);
}

const sqlitePath = path.join(process.cwd(), "data", "gitroast.db");
if (!fs.existsSync(sqlitePath)) {
  console.error(`옮길 SQLite 파일이 없습니다: ${sqlitePath}`);
  process.exit(1);
}

const sqlite = new DatabaseSync(sqlitePath);
const pool = new pg.Pool({
  connectionString: dbUrl,
  ssl:
    dbUrl.includes("localhost") || dbUrl.includes("127.0.0.1")
      ? false
      : { rejectUnauthorized: false },
});

// 앱과 동일한 스키마를 먼저 보장한다(앱이 아직 한 번도 안 떴을 수 있으므로).
await pool.query(`
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
`);

let moved = { users: 0, evaluations: 0, favorites: 0 };
let skipped = { users: 0, evaluations: 0, favorites: 0 };

const users = sqlite.prepare("SELECT * FROM users").all();
for (const u of users) {
  const r = await pool.query(
    `INSERT INTO users (id, email, password_hash, role, created_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO NOTHING;`,
    [u.id, u.email, u.password_hash, u.role, u.created_at]
  );
  r.rowCount ? moved.users++ : skipped.users++;
}

const evals = sqlite.prepare("SELECT * FROM evaluations").all();
for (const e of evals) {
  const r = await pool.query(
    `INSERT INTO evaluations
       (id, user_id, user_email, target_type, target_name, mode, tier, score, title, one_liner, summary, details, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (id) DO NOTHING;`,
    [
      e.id, e.user_id, e.user_email, e.target_type, e.target_name, e.mode,
      e.tier, e.score, e.title, e.one_liner, e.summary, e.details, e.created_at,
    ]
  );
  r.rowCount ? moved.evaluations++ : skipped.evaluations++;
}

const favs = sqlite.prepare("SELECT * FROM favorites").all();
for (const f of favs) {
  const r = await pool.query(
    `INSERT INTO favorites (id, user_id, evaluation_id, created_at)
     VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING;`,
    [f.id, f.user_id, f.evaluation_id, f.created_at]
  );
  r.rowCount ? moved.favorites++ : skipped.favorites++;
}

// 옮긴 뒤 양쪽 건수를 실제로 세어 대조한다.
const check = {};
for (const t of ["users", "evaluations", "favorites"]) {
  const pgCount = parseInt((await pool.query(`SELECT count(*) c FROM ${t};`)).rows[0].c, 10);
  const sqCount = sqlite.prepare(`SELECT count(*) c FROM ${t};`).get().c;
  check[t] = { sqlite: sqCount, postgres: pgCount, ok: pgCount >= sqCount };
}

await pool.end();

console.log("이관 결과 (신규 / 이미 있어 건너뜀):");
for (const t of ["users", "evaluations", "favorites"]) {
  console.log(`  ${t.padEnd(12)} ${String(moved[t]).padStart(4)} / ${String(skipped[t]).padStart(4)}`);
}
console.log("\n건수 대조:");
let allOk = true;
for (const [t, c] of Object.entries(check)) {
  console.log(`  ${t.padEnd(12)} SQLite ${String(c.sqlite).padStart(4)}  ->  PostgreSQL ${String(c.postgres).padStart(4)}  ${c.ok ? "OK" : "불일치!"}`);
  if (!c.ok) allOk = false;
}
console.log(allOk ? "\n이관 완료. 원본 SQLite 파일은 그대로 두었습니다." : "\n건수가 맞지 않습니다. 확인이 필요합니다.");
process.exit(allOk ? 0 : 1);
