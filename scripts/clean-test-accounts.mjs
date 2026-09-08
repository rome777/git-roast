// 회귀 검사가 남긴 테스트 계정 정리
//
//   npm run db:clean-testers            # 지울 대상만 보여준다 (기본: 미리보기)
//   npm run db:clean-testers -- --yes   # 실제로 지운다
//
// verify:auth 는 실행할 때마다 tester-<타임스탬프>@example.com 계정을 만든다.
// 쌓이면 관리자 콘솔 사용자 목록이 어지러워지고, 클라우드로 이관할 때 같이 딸려간다.
//
// 분석 기록이 하나라도 있는 계정은 지우지 않는다 — 이름만 tester 인 실사용 계정을
// 실수로 날리지 않기 위해서다.

import pg from "pg";

import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd(), true, { info: () => {}, error: console.error });

const apply = process.argv.includes("--yes");
const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!dbUrl?.startsWith("postgres")) {
  console.error("DATABASE_URL 이 없습니다. (SQLite 모드에서는 이 스크립트를 쓰지 않습니다)");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: dbUrl,
  ssl: dbUrl.includes("localhost") || dbUrl.includes("127.0.0.1") ? false : { rejectUnauthorized: false },
});

const PATTERN = "tester-%@example.com";

const rows = (await pool.query(
  `SELECT u.email, u.role,
          (SELECT count(*) FROM evaluations e WHERE e.user_email = u.email) AS evals
   FROM users u WHERE u.email LIKE $1 ORDER BY u.created_at;`,
  [PATTERN]
)).rows;

if (rows.length === 0) {
  console.log("정리할 테스트 계정이 없습니다.");
  await pool.end();
  process.exit(0);
}

const removable = rows.filter((r) => Number(r.evals) === 0);
const kept = rows.filter((r) => Number(r.evals) > 0);

console.log(`테스트 계정 ${rows.length}건 발견:`);
for (const r of rows) {
  const mark = Number(r.evals) === 0 ? "삭제 대상" : `보존 (분석 기록 ${r.evals}건)`;
  console.log(`  ${r.email.padEnd(36)} ${mark}`);
}

if (kept.length) {
  console.log(`\n분석 기록이 있는 ${kept.length}건은 지우지 않습니다.`);
}

if (!apply) {
  console.log(`\n미리보기입니다. 실제로 지우려면:\n  npm run db:clean-testers -- --yes`);
  await pool.end();
  process.exit(0);
}

const r = await pool.query(
  `DELETE FROM users WHERE email LIKE $1
     AND NOT EXISTS (SELECT 1 FROM evaluations e WHERE e.user_email = users.email);`,
  [PATTERN]
);
console.log(`\n${r.rowCount}건 삭제했습니다.`);

await pool.end();
