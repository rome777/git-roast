import { NextRequest, NextResponse } from "next/server";
import { getUserByEmailFromDb, updateUserNicknameInDb } from "@/lib/db/database";
import { getSession, clearSession } from "@/lib/auth/session";
import { normalizeNickname, validateNickname } from "@/lib/auth/nickname-rules";
import { enforceAuthRateLimit } from "@/lib/ratelimit";

/**
 * 닉네임 변경.
 *
 * 바꿀 대상은 **세션의 이메일**이다. 본문으로 대상을 받지 않는다 —
 * 받으면 남의 닉네임을 바꿀 수 있는 통로가 된다.
 *
 * 세션 토큰에는 닉네임을 넣지 않는다. 토큰 수명이 7일이라 넣어 두면 바꿔도
 * 재로그인 전까지 옛 이름이 남는다. 화면은 /api/auth/me 로 DB 값을 읽는다.
 */
export async function POST(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { nickname } = await req.json().catch(() => ({}));

    const invalid = validateNickname(nickname);
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

    const verdict = await enforceAuthRateLimit(req, "profile", session.email);
    if (!verdict.ok) return verdict.response;

    const user = await getUserByEmailFromDb(session.email);
    if (!user) {
      return clearSession(
        NextResponse.json({ error: "계정을 찾을 수 없습니다." }, { status: 404 })
      );
    }

    const value = normalizeNickname(nickname);
    const updated = await updateUserNicknameInDb(user.email, value);
    if (!updated) {
      return NextResponse.json({ error: "닉네임을 저장하지 못했습니다." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      nickname: value,
      message: "닉네임을 변경했습니다.",
    });
  } catch (error: any) {
    console.error("Nickname update error:", error);
    return NextResponse.json({ error: "닉네임 변경 중 오류가 발생했습니다." }, { status: 500 });
  }
}
