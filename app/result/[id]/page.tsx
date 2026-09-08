"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { EvaluationResult } from "@/lib/ai/types";
import { EvaluationCard } from "@/components/evaluation/EvaluationCard";
import { ArrowLeft, Sparkles } from "lucide-react";

export default function ResultPage() {
  const params = useParams();
  const id = params?.id as string;

  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    const load = async () => {
      // 1. DB 를 먼저 조회한다. 공유 링크는 비로그인 사용자도 열 수 있어야 하므로
      //    이 경로가 정답이고, localStorage 는 오프라인 보조 수단일 뿐이다.
      try {
        const res = await fetch(`/api/evaluations/${encodeURIComponent(id)}`);
        if (res.ok) {
          const json = await res.json();
          if (!cancelled && json?.evaluation) {
            setEvaluation(json.evaluation);
            setLoading(false);
            return;
          }
        }
      } catch {
        // 네트워크 실패 시 아래 localStorage 로 넘어간다.
      }

      // 2. 내 브라우저에 남아 있는 기록 (DB 조회 실패 시 보조)
      try {
        const history: EvaluationResult[] = JSON.parse(
          localStorage.getItem("gitroast_history") || "[]"
        );
        const found = history.find((h) => h.id === id);
        if (!cancelled && found) {
          setEvaluation(found);
          setLoading(false);
          return;
        }
      } catch {}

      // 3. 없으면 없다고 말한다. 목업으로 대체하지 않는다.
      if (!cancelled) {
        setEvaluation(null);
        setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
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
