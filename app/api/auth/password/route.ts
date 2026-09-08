import { NextRequest, NextResponse } from "next/server";
import { getUserByEmailFromDb, setUserPasswordHash } from "@/lib/db/database";
import {
  hashPassword,
  verifyPassword,
  isLegacyPlaceholder,
  validateNewPassword,
} from "@/lib/auth/password";
import { checkPasswordNotPwned } from "@/lib/auth/pwned";
import { getSession, clearSession } from "@/lib/auth/session";
import { enforceAuthRateLimit } from "@/lib/ratelimit";

/**
 * 비밀번호 변경.
 *
 * **현재 비밀번호를 다시 받는다.** 세션만으로 바꿀 수 있게 두면 탈취된 쿠키 하나로
 * 계정을 통째로 빼앗긴다(공격자가 비밀번호를 바꿔 버리면 주인이 못 들어온다).
 * 그래서 탈퇴와 같은 급으로 다룬다.
 *
 * 새 비밀번호는 가입과 **똑같은 검사**를 지난다. 여기만 느슨하면 가입에서 막은
 * 값을 변경으로 우회해 넣을 수 있다.
 *
 * 알려진 한계: 다른 기기에 남아 있는 세션은 이 변경으로 끊기지 않는다.
 * 세션 토큰이 비밀번호와 무관하게 서명되기 때문이다(HANDOVER.md 참조).
 */
export async function POST(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { currentPassword, newPassword } = await req.json().catch(() => ({}));

    if (typeof currentPassword !== "string" || !currentPassword) {
      return NextResponse.json({ error: "현재 비밀번호를 입력해 주세요." }, { status: 400 });
    }

    // 네트워크를 타지 않는 검사를 먼저 끝낸다(유출 검사는 외부 호출이다).
    const pwError = validateNewPassword(newPassword, session.email);
    if (pwError) return NextResponse.json({ error: pwError }, { status: 400 });

    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: "현재 비밀번호와 다른 값을 입력해 주세요." },
        { status: 400 }
      );
    }

    // 현재 비밀번호를 무한히 시험하는 통로가 되지 않도록 로그인과 같은 게이트를 지난다.
    const verdict = await enforceAuthRateLimit(req, "login", session.email);
    if (!verdict.ok) return verdict.response;

    const user = await getUserByEmailFromDb(session.email);
    if (!user) {
      return clearSession(
        NextResponse.json({ error: "계정을 찾을 수 없습니다." }, { status: 404 })
      );
    }

    if (
      isLegacyPlaceholder(user.password_hash) ||
      !(await verifyPassword(currentPassword, user.password_hash))
    ) {
      return NextResponse.json({ error: "현재 비밀번호가 일치하지 않습니다." }, { status: 401 });
    }

    const pwnedError = await checkPasswordNotPwned(newPassword);
    if (pwnedError) return NextResponse.json({ error: pwnedError }, { status: 400 });

    await setUserPasswordHash(user.email, await hashPassword(newPassword));

    return NextResponse.json({
      success: true,
      message: "비밀번호를 변경했습니다.",
    });
  } catch (error: any) {
    console.error("Password change error:", error);
    return NextResponse.json(
      { error: "비밀번호 변경 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
