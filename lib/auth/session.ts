import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getUserByEmailFromDb } from "@/lib/db/database";

export const SESSION_COOKIE = "gitroast_session";

/** 개발 단계에서 쓰이던 서명 없는 평문 쿠키들. 발견 즉시 만료시킨다. */
export const LEGACY_COOKIES = ["gitroast_user", "gitroast_mock_user"];

export interface SessionUser {
  id: string;
  email: string;
  role: string;
}

interface SessionPayload extends SessionUser {
  iat: number;
}

const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7일

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET 환경 변수가 없거나 너무 짧습니다(32자 이상 필요). .env.local 을 확인하세요."
    );
  }
  return secret;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(data: string): string {
  return createHmac("sha256", getSecret()).update(data).digest("base64url");
}

export function createSessionToken(user: SessionUser): string {
  const payload: SessionPayload = {
    id: user.id,
    email: user.email,
    role: user.role,
    iat: Date.now(),
  };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

export function verifySessionToken(token: string | undefined): SessionPayload | null {
  if (!token) return null;

  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;

  const body = token.slice(0, dot);
  const providedSig = token.slice(dot + 1);
  const expectedSig = sign(body);

  const a = Buffer.from(providedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (!payload?.email || !payload?.iat) return null;
    if (Date.now() - payload.iat > MAX_AGE_SECONDS * 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

/** 서명이 검증된 세션만 돌려준다. 쿼리 파라미터/헤더 우회 경로는 없다. */
export function getSession(req: NextRequest): SessionUser | null {
  let payload: SessionPayload | null = null;
  try {
    payload = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  } catch {
    // SESSION_SECRET 미설정 등 — 인증 실패로 처리한다.
    return null;
  }
  if (!payload) return null;
  return { id: payload.id, email: payload.email, role: payload.role };
}

export function attachSession(res: NextResponse, user: SessionUser): NextResponse {
  res.cookies.set({
    name: SESSION_COOKIE,
    value: createSessionToken(user),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && !!process.env.NEXT_PUBLIC_SITE_URL?.startsWith("https"),
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
  clearLegacyCookies(res);
  return res;
}

export function clearSession(res: NextResponse): NextResponse {
  res.cookies.set({ name: SESSION_COOKIE, value: "", path: "/", maxAge: 0 });
  clearLegacyCookies(res);
  return res;
}

export function clearLegacyCookies(res: NextResponse): void {
  for (const name of LEGACY_COOKIES) {
    res.cookies.set({ name, value: "", path: "/", maxAge: 0 });
  }
}

export const UNAUTHORIZED = () =>
  NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

export const FORBIDDEN = () =>
  NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });

/** 로그인 여부만 확인. 실패 시 401 응답을 돌려준다. */
export function requireUser(req: NextRequest): SessionUser | NextResponse {
  const session = getSession(req);
  if (!session) return UNAUTHORIZED();
  return session;
}

/**
 * 관리자 권한 확인. 토큰의 role 을 그대로 믿지 않고 DB 에서 다시 읽는다.
 * (권한 회수가 기존 발급 토큰에도 즉시 반영되도록.)
 */
export async function requireAdmin(req: NextRequest): Promise<SessionUser | NextResponse> {
  const session = getSession(req);
  if (!session) return UNAUTHORIZED();

  const dbUser = await getUserByEmailFromDb(session.email);
  if (!dbUser || dbUser.role !== "admin") return FORBIDDEN();

  return { id: dbUser.id, email: dbUser.email, role: dbUser.role };
}

export function isSessionResponse(v: SessionUser | NextResponse): v is NextResponse {
  return v instanceof NextResponse;
}
