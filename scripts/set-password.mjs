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

import { createHash, randomBytes, scrypt as _scrypt } from "node:crypto";
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

/**
 * 복잡도 규칙. **lib/auth/password-rules.ts 와 같은 규칙이다.**
 * .mjs 스크립트는 TS 모듈을 불러올 수 없어 부득이 두 벌이다 — 한쪽을 고치면 다른 쪽도 고친다.
 */
function validateNewPassword(pw, email) {
  if (typeof pw !== "string" || pw.length < 8) return "비밀번호는 8자 이상이어야 합니다.";
  if (pw.length > 200) return "비밀번호는 200자 이하여야 합니다.";
  if (!/[A-Za-z가-힣]/.test(pw)) return "비밀번호에 문자를 하나 이상 포함해 주세요.";
  if (!/[0-9]/.test(pw)) return "비밀번호에 숫자를 하나 이상 포함해 주세요.";
  if (!/[^A-Za-z0-9가-힣]/.test(pw)) return "비밀번호에 특수문자(!@#$ 등)를 하나 이상 포함해 주세요.";
  if (/(.)\1{3,}/.test(pw)) return "같은 문자를 4번 이상 반복할 수 없습니다.";
  const local = email.split("@")[0]?.trim().toLowerCase() ?? "";
  if (local.length >= 4 && pw.toLowerCase().includes(local))
    return "비밀번호에 이메일 아이디를 그대로 넣을 수 없습니다.";
  return null;
}

/** HaveIBeenPwned k-익명성 조회. 비밀번호 원문은 나가지 않는다(SHA-1 앞 5자리만). */
async function pwnedCount(pw) {
  const sha1 = createHash("sha1").update(pw, "utf8").digest("hex").toUpperCase();
  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${sha1.slice(0, 5)}`, {
      headers: { "Add-Padding": "true", "User-Agent": "GitRoast-set-password" },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    for (const line of (await res.text()).split("\n")) {
      const [suffix, count] = line.trim().split(":");
      if (suffix === sha1.slice(5)) return Number.parseInt(count ?? "0", 10) || 0;
    }
    return 0;
  } catch {
    return null; // 조회 실패는 통과시킨다(앱과 같은 fail-open 정책).
  }
}

const [email, password] = process.argv.slice(2);

if (!email || !password) {
  console.error("사용법: npm run set-password -- <이메일> <비밀번호>");
  process.exit(1);
}

const pwError = validateNewPassword(password, email);
if (pwError) {
  console.error(pwError);
  process.exit(1);
}

const leaked = await pwnedCount(password);
if (leaked === null) {
  console.warn("경고: 유출 검사를 수행하지 못했습니다(네트워크). 검사 없이 진행합니다.");
} else if (leaked > 0) {
  console.error(
    `이 비밀번호는 알려진 유출 목록에 ${leaked.toLocaleString("ko-KR")}회 등장합니다. 다른 값을 쓰세요.`
  );
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
  if (res.rowCount === 0) {
    await pool.end();
    console.error(`PostgreSQL 에 '${normalized}' 계정이 없습니다.`);
    process.exit(1);
  }
  // 운영자가 직접 비밀번호를 넣는 계정이다. 확인 메일을 받을 사람이 없으므로
  // 이메일 확인도 함께 완료 처리한다. (컬럼이 아직 없는 DB 면 조용히 넘어간다)
  try {
    await pool.query(`UPDATE users SET email_verified = TRUE WHERE LOWER(email) = LOWER($1);`, [
      normalized,
    ]);
  } catch {
    console.warn("참고: email_verified 컬럼이 아직 없습니다(앱 첫 기동 시 생성됩니다).");
  }
  await pool.end();
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
  try {
    db.prepare(`UPDATE users SET email_verified = 1 WHERE LOWER(email) = LOWER(?);`).run(normalized);
  } catch {
    console.warn("참고: email_verified 컬럼이 아직 없습니다(앱 첫 기동 시 생성됩니다).");
  }
  console.log(`[SQLite] ${before.email} (${before.role}) 비밀번호 설정 완료`);
}
