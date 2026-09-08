import { NextRequest, NextResponse } from "next/server";
import {
  getUserByEmailFromDb,
  deleteUserAccountFromDb,
  countAdminsInDb,
} from "@/lib/db/database";
import { verifyPassword, isLegacyPlaceholder } from "@/lib/auth/password";
import { getSession, clearSession } from "@/lib/auth/session";
import { enforceAuthRateLimit } from "@/lib/ratelimit";

/**
 * 회원 탈퇴.
 *
 * 되돌릴 수 없고 분석 기록까지 함께 지우므로 안전장치를 겹으로 건다.
 *
 * 1. 로그인 세션이 있어야 한다.
 * 2. **비밀번호를 다시 받는다.** 세션만으로 지울 수 있게 두면, 자리를 비운
 *    브라우저나 탈취된 쿠키 하나로 계정이 통째로 날아간다. 탈퇴는 로그인보다
 *    비싼 동작이므로 재인증을 요구하는 것이 맞다.
 * 3. 지울 대상은 **세션의 이메일**이다. 본문으로 받은 이메일은 확인용으로만
 *    쓴다 — 본문을 신뢰하면 남의 계정을 지정할 수 있다.
 * 4. 마지막 관리자는 막는다. 지우고 나면 /admin 에 아무도 못 들어간다.
 *
 * 탈퇴 후 같은 이메일로 **다시 가입할 수 있다**(하드 삭제라 UNIQUE 제약이 풀린다).
 */

/** 공용 데모 계정. 한 사람이 지우면 다른 사람의 데모 기록까지 날아간다. */
const DEMO_EMAIL = "demo@gitroast.dev";

export async function POST(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { password, confirmEmail } = await req.json().catch(() => ({}));

    if (typeof password !== "string" || !password) {
      return NextResponse.json(
        { error: "본인 확인을 위해 비밀번호를 입력해 주세요." },
        { status: 400 }
      );
    }

    // 오클릭 방지. 지울 계정의 주소를 직접 입력하게 한다.
    if (
      typeof confirmEmail !== "string" ||
      confirmEmail.trim().toLowerCase() !== session.email.trim().toLowerCase()
    ) {
      return NextResponse.json(
        { error: "확인을 위해 로그인한 이메일 주소를 정확히 입력해 주세요." },
        { status: 400 }
      );
    }

    // 비밀번호를 무한히 시험하는 통로가 되지 않도록 로그인과 같은 게이트를 지난다.
    const verdict = await enforceAuthRateLimit(req, "login", session.email);
    if (!verdict.ok) return verdict.response;

    if (session.email.trim().toLowerCase() === DEMO_EMAIL) {
      return NextResponse.json(
        { error: "데모 계정은 여러 사람이 함께 쓰므로 탈퇴할 수 없습니다." },
        { status: 403 }
      );
    }

    // 권한도 비밀번호도 DB 를 다시 읽어 판단한다. 쿠키의 값은 신뢰하지 않는다.
    const user = await getUserByEmailFromDb(session.email);
    if (!user) {
      return clearSession(NextResponse.json({ error: "계정을 찾을 수 없습니다." }, { status: 404 }));
    }

    if (isLegacyPlaceholder(user.password_hash) || !(await verifyPassword(password, user.password_hash))) {
      return NextResponse.json({ error: "비밀번호가 일치하지 않습니다." }, { status: 401 });
    }

    if (user.role === "admin" && (await countAdminsInDb()) <= 1) {
      return NextResponse.json(
        {
          error:
            "마지막 관리자 계정은 탈퇴할 수 없습니다. 다른 관리자를 먼저 만든 뒤 시도해 주세요.",
        },
        { status: 409 }
      );
    }

    const result = await deleteUserAccountFromDb(user.email);
    if (!result.deleted) {
      return clearSession(NextResponse.json({ error: "계정을 찾을 수 없습니다." }, { status: 404 }));
    }

    console.warn(`[auth] 회원 탈퇴 처리: 분석 기록 ${result.evaluations}건 함께 삭제`);

    // 세션을 반드시 지운다. 남겨 두면 없는 계정을 가리키는 쿠키가 떠돈다.
    return clearSession(
      NextResponse.json({
        success: true,
        deletedEvaluations: result.evaluations,
        message: "탈퇴가 완료되었습니다. 같은 이메일로 다시 가입하실 수 있습니다.",
      })
    );
  } catch (error: any) {
    console.error("Delete account error:", error);
    return NextResponse.json(
      { error: "탈퇴 처리 중 오류가 발생했습니다. 아무것도 삭제되지 않았습니다." },
      { status: 500 }
    );
  }
}
