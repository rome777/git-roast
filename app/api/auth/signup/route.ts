import { NextRequest, NextResponse } from "next/server";
import { createUserInDb } from "@/lib/db/database";
import { hashPassword, validateNewPassword } from "@/lib/auth/password";
import { checkPasswordNotPwned } from "@/lib/auth/pwned";
import { verifyCaptcha } from "@/lib/auth/captcha";
import { attachSession } from "@/lib/auth/session";
import {
  isEmailVerificationRequired,
  sendVerificationEmail,
} from "@/lib/auth/email-verification";
import { enforceAuthRateLimit } from "@/lib/ratelimit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    const { email, password, captchaToken } = await req.json();

    if (!email || typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
      return NextResponse.json({ error: "올바른 이메일 주소를 입력해 주세요." }, { status: 400 });
    }
    const trimmedEmail = email.trim().toLowerCase();

    // 네트워크를 타지 않는 검사를 먼저 끝낸다. 형식이 틀린 요청이 유출 검사·CAPTCHA·
    // 메일 발송 같은 외부 호출을 유발하지 않게 하려는 것이다.
    const pwError = validateNewPassword(password, trimmedEmail);
    if (pwError) return NextResponse.json({ error: pwError }, { status: 400 });

    // 제한이 없으면 계정을 무제한으로 만들 수 있다.
    // 아래의 외부 호출(HIBP·Turnstile·메일)도 전부 이 게이트 뒤에 둔다.
    const verdict = await enforceAuthRateLimit(req, "signup");
    if (!verdict.ok) return verdict.response;

    const captcha = await verifyCaptcha(req, captchaToken);
    if (!captcha.ok) return NextResponse.json({ error: captcha.error }, { status: 400 });

    const pwnedError = await checkPasswordNotPwned(password);
    if (pwnedError) return NextResponse.json({ error: pwnedError }, { status: 400 });

    const requireVerification = isEmailVerificationRequired();

    const created = await createUserInDb(trimmedEmail, await hashPassword(password), {
      // 확인을 요구하지 않는 배포에서는 확인된 것으로 둔다. 그래야 나중에 요구로
      // 바꿨을 때 그 이전 가입자가 통째로 잠기지 않는다.
      emailVerified: !requireVerification,
    });

    if (!created) {
      return NextResponse.json({ error: "이미 가입된 이메일입니다." }, { status: 409 });
    }

    if (requireVerification) {
      const mail = await sendVerificationEmail(trimmedEmail);
      if (!mail.ok) {
        // 계정은 이미 만들어졌다. 지우지 않고 재발송 경로를 안내한다 —
        // 여기서 롤백하면 같은 이메일로 다시 가입할 때 409 와 경합한다.
        console.error(`[signup] 확인 메일 발송 실패(${mail.reason}): ${trimmedEmail}`);
      }
      // 세션을 붙이지 않는다. 확인 전에는 로그인 상태가 되면 안 된다.
      return NextResponse.json(
        {
          success: true,
          verificationRequired: true,
          email: trimmedEmail,
          mailSent: mail.ok,
          message: mail.ok
            ? "확인 메일을 보냈습니다. 메일의 링크를 눌러 가입을 완료해 주세요."
            : "계정은 만들어졌지만 확인 메일을 보내지 못했습니다. 잠시 후 재발송을 눌러 주세요.",
        },
        { status: 201 }
      );
    }

    const sessionUser = { id: created.id, email: created.email, role: created.role };
    return attachSession(
      NextResponse.json({ success: true, user: sessionUser }, { status: 201 }),
      sessionUser
    );
  } catch (error: any) {
    console.error("Auth signup error:", error);
    return NextResponse.json({ error: "회원가입 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
