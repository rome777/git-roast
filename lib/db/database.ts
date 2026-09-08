import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { EvaluationResult } from "@/lib/ai/types";

let sqliteDbInstance: any = null;
let pgPoolInstance: Pool | null = null;
let pgInitialized = false;

// Check if PostgreSQL is configured via DATABASE_URL or POSTGRES_URL
function isPostgresConfigured(): boolean {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  return Boolean(url && url.startsWith("postgres"));
}

export function getDatabaseType(): "postgres" | "sqlite" {
  return isPostgresConfigured() ? "postgres" : "sqlite";
}

/**
 * DATABASE_URL 이 설정됐는데 접속에 실패하면 SQLite 로 폴백할지 여부.
 *
 * 로컬 개발에서는 폴백이 편하지만, 운영에서는 위험하다 —
 * 오타나 방화벽 때문에 PostgreSQL 에 못 붙어도 앱이 200 으로 멀쩡히 동작하면서
 * 데이터는 인스턴스 로컬 SQLite 에 쌓이고, 재배포 때 통째로 사라진다.
 * 그래서 운영(NODE_ENV=production)에서는 폴백하지 않고 에러를 그대로 올린다.
 */
function shouldFallbackToSqlite(): boolean {
  if (process.env.DB_STRICT === "true") return false;
  if (process.env.DB_STRICT === "false") return true;
  return process.env.NODE_ENV !== "production";
}

/** PostgreSQL 경로에서 잡은 에러를 폴백 정책에 따라 처리한다. */
function handlePgError(op: string, err: unknown): void {
  if (!shouldFallbackToSqlite()) {
    console.error(`[db] PostgreSQL ${op} 실패 — 폴백 없이 중단합니다.`, err);
    throw err;
  }
  console.error(`PostgreSQL ${op} failed, falling back to SQLite:`, err);
}

// 1. PostgreSQL Connection Pool
function getPgPool(): Pool {
  if (!pgPoolInstance) {
    const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    pgPoolInstance = new Pool({
      connectionString,
      ssl: connectionString?.includes("localhost") || connectionString?.includes("127.0.0.1")
        ? false
        : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
    });
  }
  return pgPoolInstance;
}

async function initPgSchema(pool: Pool) {
  if (pgInitialized) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(100) PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'user',
      email_verified BOOLEAN NOT NULL DEFAULT FALSE,
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

    -- 요청량 제한 카운터 (고정 윈도). bucket 에 대상과 윈도가 함께 인코딩된다.
    CREATE TABLE IF NOT EXISTS rate_limits (
      bucket VARCHAR(200) PRIMARY KEY,
      hits INTEGER NOT NULL DEFAULT 0,
      expires_at TIMESTAMPTZ NOT NULL
    );
  `);

  await ensureEmailVerifiedColumnPg(pool);

  // Seed default admin users if table is empty
  const res = await pool.query("SELECT count(*) as count FROM users;");
  if (parseInt(res.rows[0].count, 10) === 0) {
    const now = new Date().toISOString();
    await pool.query(
      `INSERT INTO users (id, email, password_hash, role, email_verified, created_at) VALUES
       ($1, $2, $3, $4, TRUE, $5),
       ($6, $7, $8, $9, TRUE, $10)
       ON CONFLICT (email) DO NOTHING;`,
      [
        "user-rome777", "rome777@gmail.com", "mock_pw_hash", "admin", now,
        "user-admin", "admin@gitroast.dev", "mock_pw_hash", "admin", now,
      ]
    );
  }

  pgInitialized = true;
}

/**
 * users.email_verified 를 나중에 추가한다 (2026-09-08).
 *
 * 그냥 `ADD COLUMN ... DEFAULT FALSE` 만 하면 **이미 가입해 쓰고 있던 사람들이 전부
 * 미확인이 되어 로그인에서 잠긴다.** 컬럼이 없던 DB 에 처음 붙이는 순간에만
 * 그 시점 이전에 만들어진 계정을 확인 완료로 소급 처리한다.
 *
 * 기준 시각을 ALTER 전에 찍어 두는 이유: 서버리스에서 인스턴스 두 개가 동시에
 * 초기화하더라도, 그 사이에 새로 가입한 계정까지 덩달아 확인 완료가 되지 않게 하려는 것.
 */
async function ensureEmailVerifiedColumnPg(pool: Pool) {
  const exists = await pool.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'email_verified';`
  );
  if (exists.rowCount) return;

  const cutoff = new Date().toISOString();
  await pool.query(
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;`
  );
  const updated = await pool.query(
    `UPDATE users SET email_verified = TRUE WHERE created_at < $1;`,
    [cutoff]
  );
  console.info(
    `[db] users.email_verified 추가 — 기존 계정 ${updated.rowCount}건을 확인 완료로 처리했습니다.`
  );
}

// 2. SQLite Fallback Engine
function getSqliteDb(): any {
  // 운영에서 SQLite 경로로 내려오는 것은 그 자체가 사고다.
  //
  // shouldFallbackToSqlite() 는 원래 "PostgreSQL 접속 실패" 만 막았는데,
  // DATABASE_URL 이 아예 비어 있으면 isPostgresConfigured() 가 false 라
  // 그 검사를 거치지 않고 곧장 여기로 온다.
  // 실제로 배포에서 확인했다 — 환경 변수가 없는 인스턴스가 번들에 딸려 올라간
  // data/gitroast.db 의 낡은 스냅샷을 200 으로 서빙했다. 조용히 틀린 데이터를
  // 주는 것이 에러를 내는 것보다 훨씬 나쁘다.
  if (!shouldFallbackToSqlite()) {
    throw new Error(
      "DATABASE_URL 이 설정되지 않았습니다. 운영에서는 SQLite 로 넘어가지 않습니다 " +
        "(인스턴스마다 데이터가 갈라지고 재배포 때 사라집니다)."
    );
  }

  if (!sqliteDbInstance) {
    // node:sqlite 는 Node 22.5+ 에만 있다. top-level import 로 두면 PostgreSQL 만
    // 쓰는 배포 환경에서도 런타임이 그보다 낮을 때 모듈 로드 단계에서 앱 전체가
    // 죽는다. 실제로 SQLite 경로를 탈 때만 불러온다.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { DatabaseSync } = require("node:sqlite");

    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const dbPath = path.join(dataDir, "gitroast.db");
    sqliteDbInstance = new DatabaseSync(dbPath);

    initSqliteSchema(sqliteDbInstance);
  }
  return sqliteDbInstance;
}

function initSqliteSchema(db: any) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      email_verified INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS evaluations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_email TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_name TEXT NOT NULL,
      mode TEXT NOT NULL,
      tier TEXT NOT NULL,
      score INTEGER NOT NULL,
      title TEXT NOT NULL,
      one_liner TEXT NOT NULL,
      summary TEXT NOT NULL,
      details TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS favorites (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      evaluation_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rate_limits (
      bucket TEXT PRIMARY KEY,
      hits INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT NOT NULL
    );
  `);

  ensureEmailVerifiedColumnSqlite(db);

  const checkUser = db.prepare("SELECT count(*) as count FROM users;").get() as { count: number };
  if (!checkUser || checkUser.count === 0) {
    const now = new Date().toISOString();
    // 컬럼을 이름으로 지정한다. `INSERT INTO users VALUES (...)` 처럼 위치로만 넣으면
    // 컬럼이 하나 늘어나는 순간 조용히 깨진다(실제로 email_verified 를 붙이며 겪었다).
    const seed = db.prepare(
      "INSERT INTO users (id, email, password_hash, role, email_verified, created_at) VALUES (?, ?, ?, ?, 1, ?);"
    );
    seed.run("user-rome777", "rome777@gmail.com", "mock_pw_hash", "admin", now);
    seed.run("user-admin", "admin@gitroast.dev", "mock_pw_hash", "admin", now);
    seed.run("user-rookie", "rookie@example.com", "mock_pw_hash", "user", now);
  }
}

/** PostgreSQL 쪽 ensureEmailVerifiedColumnPg 와 같은 일. 설명은 그쪽 주석 참조. */
function ensureEmailVerifiedColumnSqlite(db: any) {
  const cols = db.prepare("PRAGMA table_info(users);").all() as Array<{ name: string }>;
  if (cols.some((c) => c.name === "email_verified")) return;

  const cutoff = new Date().toISOString();
  db.exec("ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;");
  db.prepare("UPDATE users SET email_verified = 1 WHERE created_at < ?;").run(cutoff);
  console.info("[db] users.email_verified 추가 — 기존 계정을 확인 완료로 처리했습니다.");
}

// ----------------------------------------------------
// Unified Async Database Interface (Postgres + SQLite)
// ----------------------------------------------------

export async function saveEvaluationToDb(
  userId: string,
  userEmail: string,
  evalResult: EvaluationResult
): Promise<string> {
  const id = evalResult.id || `eval-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const now = evalResult.analyzedAt || new Date().toISOString();

  const detailsObj = {
    radarScores: evalResult.radarScores,
    radarLabels: evalResult.radarLabels,
    highlights: evalResult.highlights,
    recommendations: evalResult.recommendations,
    riskFactor: evalResult.riskFactor,
    repoMeta: evalResult.repoMeta,
    isMock: evalResult.isMock,
  };

  if (isPostgresConfigured()) {
    try {
      const pool = getPgPool();
      await initPgSchema(pool);

      await pool.query(
        `INSERT INTO evaluations (
          id, user_id, user_email, target_type, target_name, mode, tier, score, title, one_liner, summary, details, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (id) DO UPDATE SET
          score = EXCLUDED.score,
          tier = EXCLUDED.tier,
          title = EXCLUDED.title,
          one_liner = EXCLUDED.one_liner,
          summary = EXCLUDED.summary,
          details = EXCLUDED.details;`,
        [
          id,
          userId,
          userEmail,
          evalResult.targetType || "user",
          evalResult.targetUsername,
          evalResult.mode,
          evalResult.tier,
          evalResult.score,
          evalResult.title,
          evalResult.oneLiner,
          evalResult.summary,
          JSON.stringify(detailsObj),
          now,
        ]
      );
      return id;
    } catch (err) {
      handlePgError("save", err);
    }
  }

  // SQLite fallback
  const db = getSqliteDb();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO evaluations (
      id, user_id, user_email, target_type, target_name, mode, tier, score, title, one_liner, summary, details, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `);

  stmt.run(
    id,
    userId,
    userEmail,
    evalResult.targetType || "user",
    evalResult.targetUsername,
    evalResult.mode,
    evalResult.tier,
    evalResult.score,
    evalResult.title,
    evalResult.oneLiner,
    evalResult.summary,
    JSON.stringify(detailsObj),
    now
  );

  return id;
}

export async function getUserEvaluationsFromDb(userEmail: string): Promise<EvaluationResult[]> {
  if (isPostgresConfigured()) {
    try {
      const pool = getPgPool();
      await initPgSchema(pool);

      const res = await pool.query(
        `SELECT * FROM evaluations WHERE LOWER(user_email) = LOWER($1) ORDER BY created_at DESC;`,
        [userEmail]
      );
      return res.rows.map(mapPgRowToEvaluation);
    } catch (err) {
      handlePgError("getUserEvaluations", err);
    }
  }

  const db = getSqliteDb();
  const stmt = db.prepare(`
    SELECT * FROM evaluations 
    WHERE LOWER(user_email) = LOWER(?) 
    ORDER BY created_at DESC;
  `);

  const rows = stmt.all(userEmail) as any[];
  return rows.map(mapSqliteRowToEvaluation);
}

export async function getAllEvaluationsForAdmin(filterUserEmail?: string): Promise<any[]> {
  if (isPostgresConfigured()) {
    try {
      const pool = getPgPool();
      await initPgSchema(pool);

      let query = `SELECT * FROM evaluations `;
      const params: string[] = [];

      if (filterUserEmail && filterUserEmail.trim()) {
        query += `WHERE LOWER(user_email) = LOWER($1) `;
        params.push(filterUserEmail.trim());
      }

      query += `ORDER BY created_at DESC;`;

      const res = await pool.query(query, params);
      return res.rows;
    } catch (err) {
      console.error("PostgreSQL getAllEvaluationsForAdmin failed, falling back to SQLite:", err);
    }
  }

  const db = getSqliteDb();
  let query = `SELECT * FROM evaluations `;
  const params: string[] = [];

  if (filterUserEmail && filterUserEmail.trim()) {
    query += `WHERE LOWER(user_email) = LOWER(?) `;
    params.push(filterUserEmail.trim());
  }

  query += `ORDER BY created_at DESC;`;

  const stmt = db.prepare(query);
  return (params.length > 0 ? stmt.all(...params) : stmt.all()) as any[];
}

export async function deleteEvaluationFromDb(
  id: string,
  requesterEmail: string,
  isAdmin: boolean = false
): Promise<boolean> {
  if (isPostgresConfigured()) {
    try {
      const pool = getPgPool();
      await initPgSchema(pool);

      if (isAdmin) {
        await pool.query(`DELETE FROM evaluations WHERE id = $1;`, [id]);
      } else {
        await pool.query(`DELETE FROM evaluations WHERE id = $1 AND LOWER(user_email) = LOWER($2);`, [id, requesterEmail]);
      }
      return true;
    } catch (err) {
      handlePgError("deleteEvaluation", err);
    }
  }

  const db = getSqliteDb();
  if (isAdmin) {
    db.prepare(`DELETE FROM evaluations WHERE id = ?;`).run(id);
  } else {
    db.prepare(`DELETE FROM evaluations WHERE id = ? AND user_email = ?;`).run(id, requesterEmail);
  }
  return true;
}

export async function clearUserEvaluationsFromDb(userEmail: string): Promise<boolean> {
  if (isPostgresConfigured()) {
    try {
      const pool = getPgPool();
      await initPgSchema(pool);
      await pool.query(`DELETE FROM evaluations WHERE LOWER(user_email) = LOWER($1);`, [userEmail]);
      return true;
    } catch (err) {
      handlePgError("clearUserEvaluations", err);
    }
  }

  const db = getSqliteDb();
  db.prepare(`DELETE FROM evaluations WHERE LOWER(user_email) = LOWER(?);`).run(userEmail);
  return true;
}

export function getDb() {
  return getSqliteDb();
}

export async function getUserByEmailFromDb(email: string) {
  if (isPostgresConfigured()) {
    try {
      const pool = getPgPool();
      await initPgSchema(pool);

      const res = await pool.query(`SELECT * FROM users WHERE LOWER(email) = LOWER($1);`, [email]);

      // 못 찾았어도 "없음"을 그대로 돌려준다. 여기서 SQLite 로 흘러가면
      // PostgreSQL 에 없는 계정을 로컬 스냅샷에서 찾아내게 된다 — 즉
      // **운영 DB 에서 지운 계정이 낡은 해시로 다시 로그인된다.**
      // requireAdmin 도 이 함수로 role 을 읽으므로 권한까지 되살아난다.
      return res.rows[0] ?? null;
    } catch (err) {
      handlePgError("getUserByEmail", err);
    }
  }

  const db = getSqliteDb();
  const stmt = db.prepare(`SELECT * FROM users WHERE LOWER(email) = LOWER(?);`);
  return stmt.get(email) as any;
}

// upsertUserInDb() 제거됨 (2026-09-08):
// 비밀번호 없이 계정을 생성(password_hash = "mock_pw_hash")하던 함수로,
// 인증 재구축 후 호출부가 사라졌다. 남겨 두면 비밀번호 없는 계정 생성 경로가
// 되살아나므로 삭제한다. 신규 가입은 createUserInDb(email, passwordHash) 를 쓴다.

export async function getSystemStatsForAdmin() {
  const dbType = getDatabaseType();

  if (isPostgresConfigured()) {
    try {
      const pool = getPgPool();
      await initPgSchema(pool);

      const evalRes = await pool.query(`SELECT count(*) as count FROM evaluations;`);
      const userRes = await pool.query(`SELECT count(*) as count FROM users;`);
      const repoRes = await pool.query(`SELECT count(*) as count FROM evaluations WHERE target_type = 'repo';`);
      const userCountsRes = await pool.query(`
        SELECT user_email, count(*) as eval_count 
        FROM evaluations 
        GROUP BY user_email 
        ORDER BY eval_count DESC;
      `);

      const totalEvaluations = parseInt(evalRes.rows[0].count, 10);
      const totalUsers = parseInt(userRes.rows[0].count, 10);
      const repoEvaluations = parseInt(repoRes.rows[0].count, 10);

      return {
        dbType: "PostgreSQL",
        totalEvaluations,
        totalUsers,
        repoEvaluations,
        userEvaluations: totalEvaluations - repoEvaluations,
        usersWithCounts: userCountsRes.rows.map((r) => ({
          user_email: r.user_email,
          eval_count: parseInt(r.eval_count, 10),
        })),
      };
    } catch (err) {
      handlePgError("getSystemStats", err);
    }
  }

  const db = getSqliteDb();
  const evalCount = (db.prepare(`SELECT count(*) as count FROM evaluations;`).get() as any)?.count || 0;
  const userCount = (db.prepare(`SELECT count(*) as count FROM users;`).get() as any)?.count || 0;
  const repoCount = (db.prepare(`SELECT count(*) as count FROM evaluations WHERE target_type = 'repo';`).get() as any)?.count || 0;

  const usersWithCounts = db.prepare(`
    SELECT user_email, count(*) as eval_count 
    FROM evaluations 
    GROUP BY user_email 
    ORDER BY eval_count DESC;
  `).all();

  return {
    dbType: "SQLite",
    totalEvaluations: evalCount,
    totalUsers: userCount,
    repoEvaluations: repoCount,
    userEvaluations: evalCount - repoCount,
    usersWithCounts,
  };
}

function mapPgRowToEvaluation(row: any): EvaluationResult {
  const details = typeof row.details === "string" ? JSON.parse(row.details) : row.details;
  return {
    id: row.id,
    targetType: row.target_type,
    targetUsername: row.target_name,
    mode: row.mode,
    tier: row.tier,
    score: row.score,
    title: row.title,
    oneLiner: row.one_liner,
    summary: row.summary,
    radarScores: details.radarScores || { commitActivity: 50, documentation: 50, stackDiversity: 50, codePopularity: 50, consistency: 50 },
    radarLabels: details.radarLabels,
    highlights: details.highlights || [],
    recommendations: details.recommendations || [],
    riskFactor: details.riskFactor,
    repoMeta: details.repoMeta,
    analyzedAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    isMock: details.isMock,
  };
}

function mapSqliteRowToEvaluation(row: any): EvaluationResult {
  let parsedDetails: any = {};
  try {
    parsedDetails = JSON.parse(row.details);
  } catch {}

  return {
    id: row.id,
    targetType: row.target_type,
    targetUsername: row.target_name,
    mode: row.mode,
    tier: row.tier,
    score: row.score,
    title: row.title,
    oneLiner: row.one_liner,
    summary: row.summary,
    radarScores: parsedDetails.radarScores || { commitActivity: 50, documentation: 50, stackDiversity: 50, codePopularity: 50, consistency: 50 },
    radarLabels: parsedDetails.radarLabels,
    highlights: parsedDetails.highlights || [],
    recommendations: parsedDetails.recommendations || [],
    riskFactor: parsedDetails.riskFactor,
    repoMeta: parsedDetails.repoMeta,
    analyzedAt: row.created_at,
    isMock: parsedDetails.isMock,
  };
}

// ----------------------------------------------------
// 인증용 사용자 조작 + 단건 평가 조회 (공유 링크용)
// ----------------------------------------------------

const ADMIN_EMAILS = ["rome777@gmail.com", "admin@gitroast.dev"];

export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

/**
 * 신규 가입. 이미 있으면 null 을 돌려준다(호출부에서 409 처리).
 *
 * `emailVerified` 는 사람이 확인 링크를 누르지 않아도 되는 계정(데모 계정 등)에만 쓴다.
 * 일반 가입은 기본값 false 로 두고 확인 메일을 거쳐야 한다.
 */
export async function createUserInDb(
  email: string,
  passwordHash: string,
  opts: { emailVerified?: boolean } = {}
): Promise<{ id: string; email: string; role: string } | null> {
  const normalized = email.trim().toLowerCase();
  const role = isAdminEmail(normalized) ? "admin" : "user";
  const id = `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const verified = opts.emailVerified === true;

  const existing = await getUserByEmailFromDb(normalized);
  if (existing) return null;

  if (isPostgresConfigured()) {
    try {
      const pool = getPgPool();
      await initPgSchema(pool);
      const res = await pool.query(
        `INSERT INTO users (id, email, password_hash, role, email_verified, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (email) DO NOTHING
         RETURNING id, email, role;`,
        [id, normalized, passwordHash, role, verified, now]
      );
      return res.rows[0] || null;
    } catch (err) {
      handlePgError("createUser", err);
    }
  }

  const db = getSqliteDb();
  db.prepare(
    `INSERT INTO users (id, email, password_hash, role, email_verified, created_at)
     VALUES (?, ?, ?, ?, ?, ?);`
  ).run(id, normalized, passwordHash, role, verified ? 1 : 0, now);
  return { id, email: normalized, role };
}

/**
 * 두 엔진의 boolean 표현을 한 곳에서 흡수한다.
 * PostgreSQL 은 true/false 를, SQLite 는 1/0 정수를 돌려준다.
 */
export function isUserEmailVerified(user: { email_verified?: unknown } | null | undefined): boolean {
  const v = user?.email_verified;
  return v === true || v === 1 || v === "1" || v === "t" || v === "true";
}

/** 확인 링크를 눌렀을 때 호출. 이미 확인된 계정이면 아무 변화가 없다(멱등). */
export async function setEmailVerifiedInDb(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();

  if (isPostgresConfigured()) {
    try {
      const pool = getPgPool();
      await initPgSchema(pool);
      const res = await pool.query(
        `UPDATE users SET email_verified = TRUE WHERE LOWER(email) = LOWER($1);`,
        [normalized]
      );
      return (res.rowCount ?? 0) > 0;
    } catch (err) {
      handlePgError("setEmailVerified", err);
      return false;
    }
  }

  const db = getSqliteDb();
  const before = db.prepare(`SELECT id FROM users WHERE LOWER(email) = LOWER(?);`).get(normalized);
  if (!before) return false;
  db.prepare(`UPDATE users SET email_verified = 1 WHERE LOWER(email) = LOWER(?);`).run(normalized);
  return true;
}

/** 레거시 자리표시자(mock_pw_hash) 계정이 첫 로그인에서 비밀번호를 확정할 때 사용. */
export async function setUserPasswordHash(email: string, passwordHash: string): Promise<void> {
  const normalized = email.trim().toLowerCase();

  if (isPostgresConfigured()) {
    try {
      const pool = getPgPool();
      await initPgSchema(pool);
      await pool.query(`UPDATE users SET password_hash = $1 WHERE LOWER(email) = LOWER($2);`, [
        passwordHash,
        normalized,
      ]);
      return;
    } catch (err) {
      handlePgError("setUserPasswordHash", err);
    }
  }

  const db = getSqliteDb();
  db.prepare(`UPDATE users SET password_hash = ? WHERE LOWER(email) = LOWER(?);`).run(
    passwordHash,
    normalized
  );
}

/** 공유 링크(/result/[id])에서 쓰는 단건 조회. 없으면 null. */
export async function getEvaluationByIdFromDb(id: string): Promise<EvaluationResult | null> {
  if (isPostgresConfigured()) {
    try {
      const pool = getPgPool();
      await initPgSchema(pool);
      const res = await pool.query(`SELECT * FROM evaluations WHERE id = $1 LIMIT 1;`, [id]);
      if (res.rows.length > 0) return mapPgRowToEvaluation(res.rows[0]);
      return null;
    } catch (err) {
      handlePgError("getEvaluationById", err);
    }
  }

  const db = getSqliteDb();
  const row = db.prepare(`SELECT * FROM evaluations WHERE id = ? LIMIT 1;`).get(id) as any;
  return row ? mapSqliteRowToEvaluation(row) : null;
}

/**
 * 요청량 제한 카운터를 1 올리고 "올린 뒤의 값"을 돌려준다.
 *
 * 원자적 UPSERT 라 같은 버킷에 동시 요청이 몰려도 카운트가 새지 않는다.
 *
 * 다른 함수와 달리 handlePgError 를 쓰지 않는다 — 여기서 SQLite 로 조용히
 * 폴백하면 서버리스 인스턴스마다 카운터가 따로 생겨 제한이 사실상 사라진다.
 * 셀 수 없으면 에러를 그대로 올려서 호출부가 요청을 거부하게 한다.
 */
export async function bumpRateLimitCounter(bucket: string, expiresAt: Date): Promise<number> {
  // 만료된 버킷 청소. 매 요청마다 DELETE 를 날리면 청소가 카운팅보다 비싸지므로
  // 가끔만 한다.
  const shouldSweep = Math.random() < 0.02;
  const nowIso = new Date().toISOString();

  if (isPostgresConfigured()) {
    const pool = getPgPool();
    await initPgSchema(pool);

    const res = await pool.query(
      `INSERT INTO rate_limits (bucket, hits, expires_at) VALUES ($1, 1, $2)
       ON CONFLICT (bucket) DO UPDATE SET hits = rate_limits.hits + 1
       RETURNING hits;`,
      [bucket, expiresAt.toISOString()]
    );

    if (shouldSweep) {
      try {
        await pool.query(`DELETE FROM rate_limits WHERE expires_at < NOW();`);
      } catch (err) {
        console.warn("[db] rate_limits 청소 실패(무시):", err);
      }
    }

    return Number(res.rows[0].hits);
  }

  const db = getSqliteDb();
  const row = db
    .prepare(
      `INSERT INTO rate_limits (bucket, hits, expires_at) VALUES (?, 1, ?)
       ON CONFLICT(bucket) DO UPDATE SET hits = hits + 1
       RETURNING hits;`
    )
    .get(bucket, expiresAt.toISOString()) as { hits: number };

  if (shouldSweep) {
    db.prepare(`DELETE FROM rate_limits WHERE expires_at < ?;`).run(nowIso);
  }

  return Number(row.hits);
}
