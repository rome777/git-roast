// 계정 비밀번호 설정 스크립트
//
// 로그인 API 는 비밀번호가 설정되지 않은 계정(초기 시드의 mock_pw_hash)을
// 아예 막는다. 그런 계정에 비밀번호를 주는 유일한 경로가 이 스크립트다.
//
//   npm run set-password -- <이메일> <비밀번호>
//   npm run set-password -- admin@gitroast.dev "고른비밀번호"
//
// DATABASE_URL 이 설정돼 있으면 PostgreSQL, 아니면 SQLite(data/gitroast.db) 를 고친다.
// 비밀번호는 인자로만 받는다(코드에 하드코딩된 기본값 없음).

import { randomBytes, scrypt as _scrypt } from "node:crypto";
import { promisify } from "node:util";
import path from "node:path";

// @next/env 는 CommonJS 라 named import 가 안 된다.
import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;

// Next 와 같은 방식으로 .env.local / .env 를 읽는다 (CLI 실행 시 필요).
loadEnvConfig(process.cwd(), true, { info: () => {}, error: console.error });


const scrypt = promisify(_scrypt);
const KEYLEN = 64;

async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEYLEN);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

const [email, password] = process.argv.slice(2);

if (!email || !password) {
  console.error("사용법: npm run set-password -- <이메일> <비밀번호>");
  process.exit(1);
}
if (password.length < 8) {
  console.error("비밀번호는 8자 이상이어야 합니다.");
  process.exit(1);
}

const normalized = email.trim().toLowerCase();
const hash = await hashPassword(password);
const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const usePg = Boolean(dbUrl && dbUrl.startsWith("postgres"));

if (usePg) {
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({
    connectionString: dbUrl,
    ssl:
      dbUrl.includes("localhost") || dbUrl.includes("127.0.0.1")
        ? false
        : { rejectUnauthorized: false },
  });
  const res = await pool.query(
    `UPDATE users SET password_hash = $1 WHERE LOWER(email) = LOWER($2) RETURNING email, role;`,
    [hash, normalized]
  );
  await pool.end();
  if (res.rowCount === 0) {
    console.error(`PostgreSQL 에 '${normalized}' 계정이 없습니다.`);
    process.exit(1);
  }
  console.log(`[PostgreSQL] ${res.rows[0].email} (${res.rows[0].role}) 비밀번호 설정 완료`);
} else {
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(path.join(process.cwd(), "data", "gitroast.db"));
  const before = db.prepare(`SELECT email, role FROM users WHERE LOWER(email) = LOWER(?);`).get(normalized);
  if (!before) {
    console.error(`SQLite 에 '${normalized}' 계정이 없습니다.`);
    process.exit(1);
  }
  db.prepare(`UPDATE users SET password_hash = ? WHERE LOWER(email) = LOWER(?);`).run(hash, normalized);
  console.log(`[SQLite] ${before.email} (${before.role}) 비밀번호 설정 완료`);
}
