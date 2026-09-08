// @ts-ignore
import { DatabaseSync } from "node:sqlite";
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

  // Seed default admin users if table is empty
  const res = await pool.query("SELECT count(*) as count FROM users;");
  if (parseInt(res.rows[0].count, 10) === 0) {
    const now = new Date().toISOString();
    await pool.query(
      `INSERT INTO users (id, email, password_hash, role, created_at) VALUES 
       ($1, $2, $3, $4, $5),
       ($6, $7, $8, $9, $10)
       ON CONFLICT (email) DO NOTHING;`,
      [
        "user-rome777", "rome777@gmail.com", "mock_pw_hash", "admin", now,
        "user-admin", "admin@gitroast.dev", "mock_pw_hash", "admin", now,
      ]
    );
  }

  pgInitialized = true;
}

// 2. SQLite Fallback Engine
function getSqliteDb(): any {
  if (!sqliteDbInstance) {
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
  `);

  const checkUser = db.prepare("SELECT count(*) as count FROM users;").get() as { count: number };
  if (!checkUser || checkUser.count === 0) {
    const now = new Date().toISOString();
    db.prepare("INSERT INTO users VALUES (?, ?, ?, ?, ?);").run(
      "user-rome777",
      "rome777@gmail.com",
      "mock_pw_hash",
      "admin",
      now
    );
    db.prepare("INSERT INTO users VALUES (?, ?, ?, ?, ?);").run(
      "user-admin",
      "admin@gitroast.dev",
      "mock_pw_hash",
      "admin",
      now
    );
    db.prepare("INSERT INTO users VALUES (?, ?, ?, ?, ?);").run(
      "user-rookie",
      "rookie@example.com",
      "mock_pw_hash",
      "user",
      now
    );
  }
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
      if (res.rows.length > 0) return res.rows[0];
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

/** 신규 가입. 이미 있으면 null 을 돌려준다(호출부에서 409 처리). */
export async function createUserInDb(
  email: string,
  passwordHash: string
): Promise<{ id: string; email: string; role: string } | null> {
  const normalized = email.trim().toLowerCase();
  const role = isAdminEmail(normalized) ? "admin" : "user";
  const id = `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const existing = await getUserByEmailFromDb(normalized);
  if (existing) return null;

  if (isPostgresConfigured()) {
    try {
      const pool = getPgPool();
      await initPgSchema(pool);
      const res = await pool.query(
        `INSERT INTO users (id, email, password_hash, role, created_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (email) DO NOTHING
         RETURNING id, email, role;`,
        [id, normalized, passwordHash, role, now]
      );
      return res.rows[0] || null;
    } catch (err) {
      handlePgError("createUser", err);
    }
  }

  const db = getSqliteDb();
  db.prepare(`INSERT INTO users VALUES (?, ?, ?, ?, ?);`).run(id, normalized, passwordHash, role, now);
  return { id, email: normalized, role };
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
