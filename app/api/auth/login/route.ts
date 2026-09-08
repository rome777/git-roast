import { NextRequest, NextResponse } from "next/server";
import { getUserByEmailFromDb } from "@/lib/db/database";
import { verifyPassword, isLegacyPlaceholder, validatePassword } from "@/lib/auth/password";
import { attachSession } from "@/lib/auth/session";

// 이메일/비밀번호 중 무엇이 틀렸는지 알려주지 않는다(계정 존재 여부 노출 방지).
const INVALID = "이메일 또는 비밀번호가 일치하지 않습니다.";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || typeof email !== "string" || !email.trim()) {
      return NextResponse.json({ error: "이메일을 입력해 주세요." }, { status: 400 });
    }
    const pwError = validatePassword(password);
    if (pwError) return NextResponse.json({ error: pwError }, { status: 400 });

    const trimmedEmail = email.trim().toLowerCase();
    const user = await getUserByEmailFromDb(trimmedEmail);

    if (!user) {
      return NextResponse.json({ error: INVALID }, { status: 401 });
    }

    // 비밀번호가 설정되지 않은 계정(초기 시드의 mock_pw_hash)은 로그인 불가.
    // 예전에는 "첫 로그인 값으로 확정"했지만, 공개 배포 시 admin@gitroast.dev 를
    // 아무나 선점해 관리자가 되는 경로였다. 설정은 npm run set-password 로만 한다.
    if (isLegacyPlaceholder(user.password_hash)) {
      console.warn(`[auth] 비밀번호 미설정 계정 로그인 시도 차단: ${trimmedEmail}`);
      return NextResponse.json({ error: INVALID }, { status: 401 });
    }

    if (!(await verifyPassword(password, user.password_hash))) {
      return NextResponse.json({ error: INVALID }, { status: 401 });
    }

    const sessionUser = { id: user.id, email: user.email, role: user.role };
    return attachSession(
      NextResponse.json({ success: true, user: sessionUser }),
      sessionUser
    );
  } catch (error: any) {
    console.error("Auth login error:", error);
    return NextResponse.json({ error: "로그인 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
