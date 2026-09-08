import { NextRequest, NextResponse } from "next/server";
import { getUserByEmailFromDb, setEmailVerifiedInDb } from "@/lib/db/database";
import { readVerificationToken } from "@/lib/auth/email-verification";
import { resolveSiteUrl } from "@/lib/site-url";

/**
 * 확인 메일의 링크가 도착하는 곳.
 *
 * 메일 클라이언트는 링크를 GET 으로 연다. 상태를 바꾸는 GET 이지만
 * 이메일 확인은 관례적으로 이 형태다. 대신 **토큰을 화면에 렌더링하지 않고**
 * 곧바로 /login 으로 리다이렉트해서, 주소창·리퍼러에 토큰이 남는 시간을 줄인다.
 */

/**
 * 이 선언이 없으면 빌드가 이 라우트를 정적으로 렌더해 보려 하다가 `searchParams` 에서
 * 실패하고, 그 제어용 에러를 아래 catch 가 삼켜 빌드 로그에 가짜 에러가 찍힌다.
 * 어차피 매 요청 토큰을 읽어야 하는 라우트라 동적으로 못 박는다.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const base = resolveSiteUrl();
  const back = (params: Record<string, string>) =>
    NextResponse.redirect(`${base}/login?${new URLSearchParams(params)}`, { status: 303 });

  try {
    const email = readVerificationToken(req.nextUrl.searchParams.get("token"));
    if (!email) {
      // 만료·위조를 구분해 알려 주지 않는다. 어느 쪽이든 할 일은 재발송이다.
      return back({ verify: "invalid" });
    }

    const user = await getUserByEmailFromDb(email);
    if (!user) return back({ verify: "invalid" });

    await setEmailVerifiedInDb(email);
    return back({ verify: "ok", email });
  } catch (error: any) {
    console.error("Email verify error:", error);
    return back({ verify: "error" });
  }
}
