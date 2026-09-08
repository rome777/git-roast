/**
 * 메일 발송 (Resend REST API).
 *
 * TECH_SPEC 4장 2번 — "기본 내장 메일러 대신 Resend / SendGrid SMTP 연결".
 * SMTP 라이브러리(nodemailer)를 쓰지 않고 HTTPS REST 를 쓴다. 서버리스(Vercel)
 * 함수에서는 SMTP 포트로 나가는 장수명 커넥션이 잘 맞지 않고, 의존성도 늘지 않는다.
 *
 * 키가 없으면 발송하지 않고 `not-configured` 를 돌려준다. 호출부가 그 상태를
 * 알고 처리해야 한다 — 조용히 성공한 척하면 "메일이 안 와요" 를 영영 못 찾는다.
 */

const SEND_URL = "https://api.resend.com/emails";
const TIMEOUT_MS = 8000;

export function mailFrom(): string | null {
  return process.env.MAIL_FROM || null;
}

export function isMailerConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && mailFrom());
}

export type MailResult =
  | { ok: true }
  | { ok: false; reason: "not-configured" | "send-failed"; detail?: string };

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<MailResult> {
  if (!isMailerConfigured()) {
    // 개발 중에는 링크를 콘솔로 흘려 준다. 메일 서비스를 붙이기 전에도
    // 이메일 확인 흐름 전체를 손으로 밟아 볼 수 있어야 한다.
    if (process.env.NODE_ENV !== "production") {
      console.info(
        `\n[mailer] 발송 설정이 없어 콘솔로 대체합니다.\n  받는 사람: ${opts.to}\n  제목: ${opts.subject}\n  본문:\n${opts.text}\n`
      );
    }
    return { ok: false, reason: "not-configured" };
  }

  try {
    const res = await fetch(SEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: mailFrom(),
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[mailer] 발송 실패 ${res.status}:`, detail.slice(0, 500));
      return { ok: false, reason: "send-failed", detail: `${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    console.error("[mailer] 발송 요청 실패:", err);
    return { ok: false, reason: "send-failed" };
  }
}
