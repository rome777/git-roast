import { NextRequest, NextResponse } from "next/server";
import { getUserByEmailFromDb } from "@/lib/db/database";
import { getSession, clearSession } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) {
      // 서명 없는 레거시 쿠키가 남아 있으면 여기서 정리한다.
      return clearSession(NextResponse.json({ user: null }));
    }

    // role 은 토큰이 아니라 DB 를 신뢰한다.
    const dbUser = await getUserByEmailFromDb(session.email);
    if (!dbUser) return clearSession(NextResponse.json({ user: null }));

    return NextResponse.json({
      user: { id: dbUser.id, email: dbUser.email, role: dbUser.role },
    });
  } catch (error: any) {
    console.error("Auth me error:", error);
    return NextResponse.json({ user: null });
  }
}
