import { NextRequest, NextResponse } from "next/server";
import { getUserByEmailFromDb, isUserEmailVerified } from "@/lib/db/database";
import {
  isEmailVerificationRequired,
  sendVerificationEmail,
} from "@/lib/auth/email-verification";
import { enforceAuthRateLimit } from "@/lib/ratelimit";

/**
 * 확인 메일 재발송.
 *
 * 응답은 **언제나 같다.** 가입 여부·확인 여부에 따라 답이 갈리면
 * 이 엔드포인트가 계정 존재 여부 조회기가 된다.
 * 실제 발송 여부는 서버 로그로만 남긴다.
 */
const GENERIC = "가입된 주소라면 확인 메일을 보냈습니다. 메일함(스팸함 포함)을 확인해 주세요.";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string" || !email.trim()) {
      return NextResponse.json({ error: "이메일을 입력해 주세요." }, { status: 400 });
    }
    const trimmedEmail = email.trim().toLowerCase();

    // 메일 발송은 돈과 평판(스팸 신고)이 걸린 외부 호출이다. 반드시 제한 뒤에 둔다.
    const verdict = await enforceAuthRateLimit(req, "resend", trimmedEmail);
    if (!verdict.ok) return verdict.response;

    if (!isEmailVerificationRequired()) {
      return NextResponse.json({ success: true, message: GENERIC });
    }

    const user = await getUserByEmailFromDb(trimmedEmail);
    if (user && !isUserEmailVerified(user)) {
      const mail = await sendVerificationEmail(trimmedEmail);
      if (!mail.ok) console.error(`[resend] 확인 메일 발송 실패(${mail.reason}): ${trimmedEmail}`);
    }

    return NextResponse.json({ success: true, message: GENERIC });
  } catch (error: any) {
    console.error("Resend verification error:", error);
    return NextResponse.json({ error: "메일 재발송 중 오류가 발생했습니다." }, { status: 500 });
  }
}
