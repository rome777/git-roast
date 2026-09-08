import { createHmac, timingSafeEqual } from "node:crypto";
import { resolveSiteUrl } from "@/lib/site-url";
import { isMailerConfigured, sendMail, type MailResult } from "@/lib/auth/mailer";

/**
 * 이메일 확인 (TECH_SPEC 4장 2번).
 *
 * 토큰은 **DB 에 저장하지 않는다.** 세션 쿠키와 같은 방식으로 SESSION_SECRET 으로
 * HMAC 서명한 자기완결 토큰이다. 테이블·정리 작업·마이그레이션이 필요 없다.
 *
 * 1회용 보장은 토큰이 아니라 **결과**로 한다 — 확인이 끝나면 users.email_verified
 * 가 true 가 되고, 같은 링크를 다시 눌러도 이미 확인된 계정이라 아무 일도 없다.
 *
 * 서명 키는 세션과 같은 비밀값을 쓰되 용도 문자열을 섞는다(도메인 분리).
 * 그래야 세션 토큰을 확인 토큰으로, 혹은 그 반대로 되쓸 수 없다.
 */

const PURPOSE = "email-verify:v1";
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24시간

interface VerifyPayload {
  email: string;
  iat: number;
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET 이 없거나 너무 짧아 이메일 확인 토큰을 만들 수 없습니다.");
  }
  return secret;
}

function sign(body: string): string {
  return createHmac("sha256", getSecret()).update(`${PURPOSE}.${body}`).digest("base64url");
}

export function createVerificationToken(email: string): string {
  const payload: VerifyPayload = { email: email.trim().toLowerCase(), iat: Date.now() };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

/** 서명과 유효기간이 모두 맞을 때만 이메일을 돌려준다. */
export function readVerificationToken(token: string | null | undefined): string | null {
  if (!token) return null;

  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;

  const body = token.slice(0, dot);
  const provided = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(sign(body));
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as VerifyPayload;
    if (!payload?.email || !payload?.iat) return null;
    if (Date.now() - payload.iat > MAX_AGE_MS) return null;
    return payload.email;
  } catch {
    return null;
  }
}

/**
 * 확인되지 않은 계정의 로그인을 막을지.
 *
 * 기본값이 `auto` 인 이유: 메일을 보낼 수 없는 상태에서 강제하면 **아무도 가입도
 * 로그인도 못 한다.** 확인 링크를 받을 방법이 없기 때문이다. 그래서 발송 설정이
 * 실제로 갖춰졌을 때만 자동으로 켜진다. `true`/`false` 로 못 박을 수도 있다.
 */
export function isEmailVerificationRequired(): boolean {
  const mode = process.env.REQUIRE_EMAIL_VERIFICATION;
  if (mode === "true") return true;
  if (mode === "false") return false;
  return isMailerConfigured();
}

export function buildVerificationUrl(email: string): string {
  const token = createVerificationToken(email);
  return `${resolveSiteUrl()}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function sendVerificationEmail(email: string): Promise<MailResult> {
  const url = buildVerificationUrl(email);
  const safeUrl = escapeHtml(url);

  const text = [
    "GitRoast 이메일 확인",
    "",
    "아래 링크를 눌러 이메일 주소를 확인해 주세요. 링크는 24시간 동안 유효합니다.",
    url,
    "",
    "본인이 가입한 적이 없다면 이 메일을 무시하셔도 됩니다. 계정은 확인 전까지 사용할 수 없습니다.",
  ].join("\n");

  const html = `<!doctype html>
<html lang="ko"><body style="margin:0;padding:24px;background:#0f172a;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#e2e8f0">
  <div style="max-width:520px;margin:0 auto;background:#1e293b;border:1px solid #334155;border-radius:16px;padding:32px">
    <h1 style="margin:0 0 8px;font-size:20px;color:#fff">GitRoast 이메일 확인</h1>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.7;color:#94a3b8">
      아래 버튼을 눌러 이메일 주소를 확인해 주세요. 링크는 <strong style="color:#e2e8f0">24시간</strong> 동안 유효합니다.
    </p>
    <a href="${safeUrl}" style="display:inline-block;padding:12px 24px;border-radius:12px;background:#ea580c;color:#fff;font-weight:700;font-size:14px;text-decoration:none">이메일 확인하기</a>
    <p style="margin:24px 0 0;font-size:12px;line-height:1.7;color:#64748b">
      버튼이 눌리지 않으면 아래 주소를 브라우저에 붙여 넣으세요.<br>
      <span style="word-break:break-all;color:#94a3b8">${safeUrl}</span>
    </p>
    <p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #334155;font-size:12px;line-height:1.7;color:#64748b">
      본인이 가입한 적이 없다면 이 메일을 무시하셔도 됩니다. 계정은 확인 전까지 사용할 수 없습니다.
    </p>
  </div>
</body></html>`;

  return sendMail({ to: email, subject: "[GitRoast] 이메일 주소를 확인해 주세요", html, text });
}
