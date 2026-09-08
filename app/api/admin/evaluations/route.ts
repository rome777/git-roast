import { NextRequest, NextResponse } from "next/server";
import {
  getAllEvaluationsForAdmin,
  getSystemStatsForAdmin,
  deleteEvaluationFromDb,
} from "@/lib/db/database";
import { requireAdmin, isSessionResponse } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (isSessionResponse(auth)) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const filterUserEmail = searchParams.get("userEmail") || undefined;

    const evaluations = await getAllEvaluationsForAdmin(filterUserEmail);
    const stats = await getSystemStatsForAdmin();

    return NextResponse.json({
      success: true,
      stats,
      evaluations,
    });
  } catch (error: any) {
    console.error("Admin evaluations API error:", error);
    return NextResponse.json(
      { error: "관리자 데이터 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (isSessionResponse(auth)) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "삭제할 평가 ID를 지정해 주세요." }, { status: 400 });
    }

    await deleteEvaluationFromDb(id, auth.email, true);

    return NextResponse.json({ success: true, message: `평가 ID '${id}'가 삭제되었습니다.` });
  } catch (error: any) {
    console.error("Admin delete evaluation error:", error);
    return NextResponse.json({ error: "삭제 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
