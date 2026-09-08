import { createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { bumpRateLimitCounter } from "@/lib/db/database";
import type { SessionUser } from "@/lib/auth/session";

/**
 * /api/analyze 요청량 제한.
 *
 * 이 엔드포인트는 한 번 호출될 때마다 Gemini 추론 비용이 발생하고 비로그인으로도
 * 호출된다. 제한이 없으면 공개 URL 이 되는 순간 누구나 무제한으로 비용을 태울 수 있다.
 *
 * 고정 윈도(fixed window) 카운터를 DB 에 둔다. 서버리스(Vercel)에서는 인스턴스가
 * 매 요청 갈아치워질 수 있어 인메모리 카운터가 의미가 없기 때문이다.
 * 이미 붙어 있는 PostgreSQL 을 그대로 쓰므로 Redis 같은 외부 서비스는 필요 없다.
 */

/** 윈도별 상한. 운영 중 조정할 수 있게 환경 변수로 뺀다. */
function limitFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const LIMITS = {
  /** 비로그인 — IP 당 시간/일 */
  guestHour: () => limitFromEnv("RATE_LIMIT_GUEST_HOUR", 3),
  guestDay: () => limitFromEnv("RATE_LIMIT_GUEST_DAY", 10),
  /** 로그인 — 계정 당 일, 그리고 다계정 남용을 막는 IP 당 시간 */
  userHour: () => limitFromEnv("RATE_LIMIT_USER_HOUR", 10),
  userDay: () => limitFromEnv("RATE_LIMIT_USER_DAY", 30),
  /** 전역 킬스위치 — 비용 폭주 시 서비스 전체를 멈춘다 */
  globalDay: () => limitFromEnv("RATE_LIMIT_GLOBAL_DAY", 500),
};

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** YYYYMMDDHH (UTC) */
function hourWindow(now: Date): string {
  return now.toISOString().slice(0, 13).replace(/[-T]/g, "");
}

/** YYYYMMDD (UTC) */
function dayWindow(now: Date): string {
  return now.toISOString().slice(0, 10).replace(/-/g, "");
}

/**
 * 프록시 뒤에서의 실제 클라이언트 IP.
 * Vercel 은 x-forwarded-for 의 첫 항목에 원 클라이언트를 넣는다.
 */
function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * IP 는 원문으로 저장하지 않는다(개인정보). SESSION_SECRET 을 키로 HMAC 해서
 * 되돌릴 수 없는 짧은 식별자만 남긴다.
 */
function hashIp(ip: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET 이 없어 요청량 제한을 적용할 수 없습니다.");
  }
  return createHmac("sha256", secret).update(ip).digest("base64url").slice(0, 22);
}

interface Rule {
  bucket: string;
  limit: number;
  /** 이 윈도가 끝나는 시각 — Retry-After 계산과 만료 청소에 쓴다. */
  resetAt: Date;
  message: string;
}

export type RateLimitVerdict = { ok: true } | { ok: false; response: NextResponse };

const OK: RateLimitVerdict = { ok: true };

function tooMany(rule: Rule, now: Date): RateLimitVerdict {
  const retryAfter = Math.max(1, Math.ceil((rule.resetAt.getTime() - now.getTime()) / 1000));
  return {
    ok: false,
    response: NextResponse.json(
      { error: rule.message, retryAfter },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    ),
  };
}

/**
 * 분석 요청 한 건을 계상하고, 상한을 넘었으면 429 응답을 돌려준다.
 *
 * 규칙은 좁은 것부터 검사한다(IP → 계정 → 전역). 이미 막힌 요청이 전역 카운터를
 * 축내지 않도록, 앞 규칙에서 걸리면 뒤 규칙은 세지 않는다.
 *
 * 계상은 "선증가 후판정"이다. 실패한 요청도 한 건으로 치므로 재시도로 상한을
 * 우회할 수 없다.
 */
/**
 * 인증 엔드포인트 요청량 제한.
 *
 * 로그인은 **횟수 제한이 없으면 비밀번호를 무한히 추측할 수 있다.** 실제로 운영에서
 * 10회 연속 시도가 전부 통과하는 것을 확인했다(2026-09-08).
 * 가입은 제한이 없으면 계정을 무제한으로 만들 수 있다.
 *
 * IP 뿐 아니라 **대상 이메일별로도** 센다. 분산 IP 로 한 계정을 노리는 경우
 * IP 카운터만으로는 막히지 않기 때문이다.
 */
export async function enforceAuthRateLimit(
  req: NextRequest,
  action: "login" | "signup",
  email?: string
): Promise<RateLimitVerdict> {
  const now = new Date();
  const minuteEnd = new Date(Math.ceil(now.getTime() / MINUTE_MS) * MINUTE_MS);
  const hourEnd = new Date(Math.ceil(now.getTime() / HOUR_MS) * HOUR_MS);
  const minute = now.toISOString().slice(0, 16).replace(/[-T:]/g, "");
  const hour = hourWindow(now);

  const ip = hashIp(getClientIp(req));
  const rules: Rule[] = [
    {
      bucket: `auth:${action}:ip:${ip}:m:${minute}`,
      limit: limitFromEnv("RATE_LIMIT_AUTH_MINUTE", 5),
      resetAt: minuteEnd,
      message: "요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.",
    },
    {
      bucket: `auth:${action}:ip:${ip}:h:${hour}`,
      limit: limitFromEnv("RATE_LIMIT_AUTH_HOUR", 20),
      resetAt: hourEnd,
      message: "요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.",
    },
  ];

  // 로그인은 노려지는 계정 자체도 센다.
  if (action === "login" && email) {
    const target = hashIp(email.trim().toLowerCase());
    rules.push({
      bucket: `auth:login:acct:${target}:h:${hour}`,
      limit: limitFromEnv("RATE_LIMIT_LOGIN_ACCOUNT_HOUR", 20),
      resetAt: hourEnd,
      message: "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.",
    });
  }

  return applyRules(rules, now);
}

export async function enforceAnalyzeRateLimit(
  req: NextRequest,
  session: SessionUser | null
): Promise<RateLimitVerdict> {
  const now = new Date();
  const hour = hourWindow(now);
  const day = dayWindow(now);
  const hourEnd = new Date(Math.ceil(now.getTime() / HOUR_MS) * HOUR_MS);
  const dayEnd = new Date(Math.ceil(now.getTime() / DAY_MS) * DAY_MS);

  const ip = hashIp(getClientIp(req));
  const rules: Rule[] = [];

  if (session) {
    rules.push({
      bucket: `ip:${ip}:h:${hour}`,
      limit: LIMITS.userHour(),
      resetAt: hourEnd,
      message: "요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.",
    });
    rules.push({
      bucket: `user:${session.id}:d:${day}`,
      limit: LIMITS.userDay(),
      resetAt: dayEnd,
      message: "오늘 분석 가능 횟수를 모두 사용했습니다. 내일 다시 시도해 주세요.",
    });
  } else {
    rules.push({
      bucket: `ip:${ip}:h:${hour}`,
      limit: LIMITS.guestHour(),
      resetAt: hourEnd,
      message: "비로그인 분석은 시간당 횟수가 제한됩니다. 로그인하면 더 많이 분석할 수 있습니다.",
    });
    rules.push({
      bucket: `ip:${ip}:d:${day}`,
      limit: LIMITS.guestDay(),
      resetAt: dayEnd,
      message: "비로그인 분석의 하루 한도를 모두 사용했습니다. 로그인하면 계속 이용할 수 있습니다.",
    });
  }

  rules.push({
    bucket: `global:d:${day}`,
    limit: LIMITS.globalDay(),
    resetAt: dayEnd,
    message: "오늘 서비스 전체 분석 한도에 도달했습니다. 내일 다시 시도해 주세요.",
  });

  return applyRules(rules, now);
}

/** 규칙을 좁은 것부터 적용한다. 앞에서 걸리면 뒤 카운터는 세지 않는다. */
async function applyRules(rules: Rule[], now: Date): Promise<RateLimitVerdict> {
  for (const rule of rules) {
    let used: number;
    try {
      used = await bumpRateLimitCounter(rule.bucket, rule.resetAt);
    } catch (err) {
      // 셀 수 없으면 통과시키지 않는다. 이 게이트의 목적이 비용 방어이므로,
      // 카운터가 죽었을 때 문을 열어 두면 막으려던 상황이 그대로 벌어진다.
      console.error("[ratelimit] 카운터 갱신 실패 — 요청을 거부합니다.", err);
      return {
        ok: false,
        response: NextResponse.json(
          { error: "일시적인 오류로 분석 요청을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요." },
          { status: 503 }
        ),
      };
    }

    if (used > rule.limit) return tooMany(rule, now);
  }

  return OK;
}
