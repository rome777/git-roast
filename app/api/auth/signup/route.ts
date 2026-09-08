import { NextRequest, NextResponse } from "next/server";
import { createUserInDb } from "@/lib/db/database";
import { hashPassword, validatePassword } from "@/lib/auth/password";
import { attachSession } from "@/lib/auth/session";
import { enforceAuthRateLimit } from "@/lib/ratelimit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
      return NextResponse.json({ error: "올바른 이메일 주소를 입력해 주세요." }, { status: 400 });
    }
    const pwError = validatePassword(password);
    if (pwError) return NextResponse.json({ error: pwError }, { status: 400 });

    const trimmedEmail = email.trim().toLowerCase();

    // 제한이 없으면 계정을 무제한으로 만들 수 있다.
    const verdict = await enforceAuthRateLimit(req, "signup");
    if (!verdict.ok) return verdict.response;

    const created = await createUserInDb(trimmedEmail, await hashPassword(password));

    if (!created) {
      return NextResponse.json({ error: "이미 가입된 이메일입니다." }, { status: 409 });
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
