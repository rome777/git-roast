import { NextRequest, NextResponse } from "next/server";
import {
  getUserEvaluationsFromDb,
  saveEvaluationToDb,
  deleteEvaluationFromDb,
  clearUserEvaluationsFromDb,
} from "@/lib/db/database";
import { requireUser, isSessionResponse } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  const auth = requireUser(req);
  if (isSessionResponse(auth)) return auth;

  try {
    const evaluations = await getUserEvaluationsFromDb(auth.email);

    return NextResponse.json({
      success: true,
      email: auth.email,
      evaluations,
    });
  } catch (error: any) {
    console.error("GET /api/history error:", error);
    return NextResponse.json({ error: "히스토리 조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = requireUser(req);
  if (isSessionResponse(auth)) return auth;

  try {
    const body = await req.json();
    const evaluation = body.evaluation;

    if (!evaluation) {
      return NextResponse.json({ error: "저장할 평가 데이터가 없습니다." }, { status: 400 });
    }

    // 소유자는 세션에서만 정한다. 요청 본문의 userEmail/userId 는 신뢰하지 않는다.
    const savedId = await saveEvaluationToDb(auth.id, auth.email, evaluation);

    return NextResponse.json({
      success: true,
      id: savedId,
      userEmail: auth.email,
    });
  } catch (error: any) {
    console.error("POST /api/history error:", error);
    return NextResponse.json({ error: "히스토리 저장 중 오류가 발생했습니다." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = requireUser(req);
  if (isSessionResponse(auth)) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (id) {
      // isAdmin=false 로 호출하므로 본인 소유 기록만 지워진다.
      await deleteEvaluationFromDb(id, auth.email, false);
    } else {
      await clearUserEvaluationsFromDb(auth.email);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/history error:", error);
    return NextResponse.json({ error: "삭제 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
