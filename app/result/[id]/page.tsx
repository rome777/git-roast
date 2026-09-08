import { cache } from "react";
import type { Metadata } from "next";
import { getEvaluationByIdFromDb } from "@/lib/db/database";
import { ResultView } from "./ResultView";

/**
 * 공유 링크는 서버에서 렌더한다.
 *
 * 예전에는 이 페이지가 통째로 클라이언트 컴포넌트라, 카카오톡·트위터·디스코드가
 * 링크를 펼칠 때 사이트 공통 메타태그만 읽어 갔다 — 어떤 카드를 공유하든 미리보기가
 * 전부 똑같이 떴다는 뜻이다. 공유가 핵심인 서비스에서 이건 기능이 죽은 것과 같다.
 */

/** generateMetadata 와 페이지가 각각 부르므로 요청 단위로 결과를 재사용한다. */
const getEvaluation = cache(async (id: string) => {
  try {
    return await getEvaluationByIdFromDb(id);
  } catch (err) {
    // 메타태그 때문에 페이지 전체를 죽이지는 않는다. 화면은 보조 경로로 넘어간다.
    console.error("[result] 평가 조회 실패:", err);
    return null;
  }
});

const MODE_LABEL = { roast: "🔥 매운맛", review: "💼 순한맛" } as const;

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const evaluation = await getEvaluation(params.id);

  if (!evaluation) {
    return {
      title: "찾을 수 없는 카드 - GitRoast",
      description: "존재하지 않거나 삭제된 평가 카드입니다.",
    };
  }

  const mode = MODE_LABEL[evaluation.mode] ?? "";
  const title = `${evaluation.targetUsername} — ${evaluation.tier} 티어 (${evaluation.score}점) | GitRoast`;
  const description = `${mode} ${evaluation.oneLiner}`.trim();

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      siteName: "GitRoast",
      url: `/result/${encodeURIComponent(params.id)}`,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function ResultPage({ params }: { params: { id: string } }) {
  const evaluation = await getEvaluation(params.id);
  return <ResultView id={params.id} initialEvaluation={evaluation} />;
}
