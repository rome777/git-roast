import { NextRequest, NextResponse } from "next/server";
import { getEvaluationByIdFromDb } from "@/lib/db/database";

/**
 * 공유 링크(/result/[id])용 공개 단건 조회.
 * 로그인 없이 열람 가능하되, 소유자 이메일 같은 개인정보는 내보내지 않는다.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params?.id;
    if (!id) {
      return NextResponse.json({ error: "평가 ID가 필요합니다." }, { status: 400 });
    }

    const evaluation = await getEvaluationByIdFromDb(id);
    if (!evaluation) {
      return NextResponse.json({ error: "존재하지 않는 평가 카드입니다." }, { status: 404 });
    }

    return NextResponse.json({ success: true, evaluation });
  } catch (error: any) {
    console.error("GET /api/evaluations/[id] error:", error);
    return NextResponse.json({ error: "평가 조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}
