import { NextResponse } from "next/server";
import { getUserByEmailFromDb, createUserInDb } from "@/lib/db/database";
import { hashPassword } from "@/lib/auth/password";
import { attachSession } from "@/lib/auth/session";
import { randomBytes } from "node:crypto";

const DEMO_EMAIL = "demo@gitroast.dev";

/**
 * 테스트용 데모 계정 원클릭 로그인.
 * 비밀번호는 서버에서 랜덤 생성해 해시로만 저장한다(클라이언트로 나가지 않는다).
 * 데모 계정도 일반 사용자와 동일하게 자기 기록만 볼 수 있다.
 */
export async function POST() {
  try {
    if (process.env.DISABLE_DEMO_LOGIN === "true") {
      return NextResponse.json({ error: "데모 로그인이 비활성화되어 있습니다." }, { status: 403 });
    }

    let user = await getUserByEmailFromDb(DEMO_EMAIL);
    if (!user) {
      // 확인 메일을 받을 사람이 없는 계정이다. 확인 완료로 만들어 둔다.
      user = await createUserInDb(DEMO_EMAIL, await hashPassword(randomBytes(24).toString("hex")), {
        emailVerified: true,
      });
    }
    if (!user) {
      return NextResponse.json({ error: "데모 계정을 준비하지 못했습니다." }, { status: 500 });
    }

    const sessionUser = { id: user.id, email: user.email, role: user.role };
    return attachSession(NextResponse.json({ success: true, user: sessionUser }), sessionUser);
  } catch (error: any) {
    console.error("Demo login error:", error);
    return NextResponse.json({ error: "데모 로그인 중 오류가 발생했습니다." }, { status: 500 });
  }
}
