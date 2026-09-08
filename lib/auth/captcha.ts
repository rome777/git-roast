import { NextRequest } from "next/server";

/**
 * CAPTCHA (Cloudflare Turnstile) 검증.
 *
 * TECH_SPEC 4장 4번 — "회원가입 페이지에 Cloudflare Turnstile 또는 hCaptcha 적용".
 * 요청량 제한은 **속도**를 늦출 뿐 자동화 자체를 막지 못한다. 분산 IP 로 천천히
 * 두드리면 한도 안에서 계속 시도할 수 있다. CAPTCHA 는 그 지점을 막는다.
 *
 * 키가 없으면 검사를 건너뛴다. 안 그러면 키를 넣기 전까지 아무도 가입할 수 없다.
 */

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TIMEOUT_MS = 5000;

/**
 * 사이트 키는 **NEXT_PUBLIC_ 이라 빌드 시점에 코드에 박힌다.**
 * 시크릿만 런타임에 넣고 재빌드를 안 하면 위젯이 화면에 뜨지 않는데 서버는
 * 토큰을 요구하는 상태가 되어 가입이 통째로 막힌다. 그래서 **둘 다 있을 때만**
 * 켠다. 한쪽만 있으면 켜지 않고 경고를 남긴다.
 */
export function isCaptchaConfigured(): boolean {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  if (secret && !siteKey) {
    console.warn(
      "[captcha] TURNSTILE_SECRET_KEY 는 있는데 NEXT_PUBLIC_TURNSTILE_SITE_KEY 가 없습니다. " +
        "사이트 키는 빌드 시점에 박히므로, 값을 넣은 뒤 **재배포**해야 CAPTCHA 가 켜집니다. " +
        "지금은 검사를 건너뜁니다."
    );
    return false;
  }
  if (siteKey && !secret) {
    console.warn(
      "[captcha] 사이트 키만 있고 TURNSTILE_SECRET_KEY 가 없습니다. 위젯은 뜨지만 서버 검증은 하지 않습니다."
    );
    return false;
  }
  return Boolean(secret && siteKey);
}

export type CaptchaVerdict = { ok: true } | { ok: false; error: string };

function clientIp(req: NextRequest): string | undefined {
  const xff = req.headers.get("x-forwarded-for");
  const first = xff?.split(",")[0]?.trim();
  return first || req.headers.get("x-real-ip")?.trim() || undefined;
}

/** 토큰을 Cloudflare 에 확인시킨다. 키가 없으면 통과(검사 비활성). */
export async function verifyCaptcha(
  req: NextRequest,
  token: unknown
): Promise<CaptchaVerdict> {
  if (!isCaptchaConfigured()) return { ok: true };

  if (typeof token !== "string" || !token) {
    return { ok: false, error: "자동 가입 방지 확인을 먼저 완료해 주세요." };
  }

  const form = new URLSearchParams({
    secret: process.env.TURNSTILE_SECRET_KEY as string,
    response: token,
  });
  const ip = clientIp(req);
  if (ip) form.set("remoteip", ip);

  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    const json = (await res.json()) as { success?: boolean; "error-codes"?: string[] };

    if (json?.success) return { ok: true };

    console.warn("[captcha] 검증 실패:", json?.["error-codes"]);
    return { ok: false, error: "자동 가입 방지 확인에 실패했습니다. 다시 시도해 주세요." };
  } catch (err) {
    // 유출 검사와 달리 여기서는 **막는다**(fail-closed).
    //
    // CAPTCHA 는 자동화 차단이 목적이라, 검증이 죽었을 때 열어 두면 막으려던
    // 상황이 그대로 벌어진다. 키를 넣어 둔 운영자의 의도도 "확인되면 통과"다.
    console.error("[captcha] 검증 요청 실패 — 요청을 거부합니다.", err);
    return { ok: false, error: "자동 가입 방지 확인을 완료할 수 없습니다. 잠시 후 다시 시도해 주세요." };
  }
}
