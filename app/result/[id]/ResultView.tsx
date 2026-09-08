"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { EvaluationResult } from "@/lib/ai/types";
import { EvaluationCard } from "@/components/evaluation/EvaluationCard";
import { ArrowLeft, Sparkles } from "lucide-react";

/**
 * 공유 카드 화면.
 *
 * DB 조회는 서버(page.tsx)에서 이미 끝냈다 — 크롤러가 메타태그를 읽을 수 있어야
 * 카카오톡·트위터 미리보기가 뜨기 때문이다. 여기서는 서버가 못 찾은 경우에만
 * 내 브라우저에 남은 기록을 보조로 뒤진다.
 */
export function ResultView({
  id,
  initialEvaluation,
}: {
  id: string;
  initialEvaluation: EvaluationResult | null;
}) {
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(initialEvaluation);
  // 서버가 이미 찾았으면 추가로 기다릴 것이 없다.
  const [checkingLocal, setCheckingLocal] = useState(!initialEvaluation);

  useEffect(() => {
    if (initialEvaluation || !id) return;

    // 서버가 못 찾았을 때의 보조 경로. 목업으로 대체하지는 않는다.
    try {
      const history: EvaluationResult[] = JSON.parse(
        localStorage.getItem("gitroast_history") || "[]"
      );
      const found = history.find((h) => h.id === id);
      if (found) setEvaluation(found);
    } catch {}

    setCheckingLocal(false);
  }, [id, initialEvaluation]);

  if (checkingLocal) {
    return (
      <div className="flex-1 flex items-center justify-center py-20 text-slate-400">
        <span className="animate-pulse">평가 카드 불러오는 중...</span>
      </div>
    );
  }

  if (!evaluation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 text-center px-4 min-h-[60vh]">
        <h2 className="text-xl font-bold text-white mb-2">분석 카드를 찾을 수 없습니다</h2>
        <p className="text-xs text-slate-400 mb-6">존재하지 않거나 삭제된 평가 카드입니다.</p>
        <Link
          href="/"
          className="px-4 py-2 rounded-xl bg-orange-600 text-white font-bold text-xs hover:bg-orange-500"
        >
          새 분석하러 가기
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-10 xl:py-16 max-w-4xl xl:max-w-5xl mx-auto w-full">
      {/* Top Bar Navigation */}
      <div className="w-full flex items-center justify-between mb-8 xl:mb-10 max-w-2xl xl:max-w-4xl">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-xs xl:text-sm font-bold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> 메인으로 돌아가기
        </Link>
        <Link
          href="/"
          className="flex items-center gap-1 px-3 py-1.5 xl:px-4 xl:py-2 rounded-lg text-xs xl:text-sm font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30 hover:bg-orange-500/30 transition-all"
        >
          <Sparkles className="w-3.5 h-3.5" /> 나도 분석받기
        </Link>
      </div>

      {/* Main Card View */}
      <EvaluationCard data={evaluation} />
    </div>
  );
}
