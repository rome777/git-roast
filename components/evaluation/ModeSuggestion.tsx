"use client";

import React, { useEffect, useState } from "react";
import { EvaluationMode, EvaluationResult } from "@/lib/ai/types";
import { Flame, Briefcase, ArrowRight } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";

/**
 * 한쪽 맛으로 분석하고 나면 같은 대상의 다른 맛을 권한다.
 *
 * 두 모드는 같은 데이터를 다르게 읽는다 — 매운맛은 아프게, 순한맛은 개선 방향으로.
 * 한쪽만 보고 끝내면 절반만 본 셈이라, 결과 카드 바로 아래에서 나머지 절반을 권한다.
 *
 * 이미 반대쪽도 본 대상이면 표시하지 않는다. 다 본 사람에게 계속 권하면 잔소리가 된다.
 */

const COPY: Record<EvaluationMode, { label: string; headline: string; blurb: string }> = {
  roast: {
    label: "🔥 매운맛으로도 분석하기",
    headline: "순한맛으로 보셨네요.",
    blurb: "같은 대상을 매운맛으로 보면, 리뷰가 정중하게 넘어간 부분까지 헤집습니다.",
  },
  review: {
    label: "💼 순한맛으로도 분석하기",
    headline: "매운맛으로 보셨네요.",
    blurb: "같은 대상을 순한맛으로 보면, 팩폭 대신 구체적인 개선 방향이 나옵니다.",
  },
};

/** 이 브라우저에 같은 대상 · 같은 모드 기록이 남아 있는가. */
function alreadyTried(target: string, mode: EvaluationMode): boolean {
  try {
    const history: EvaluationResult[] = JSON.parse(
      localStorage.getItem("gitroast_history") || "[]"
    );
    return history.some(
      (h) => h.targetUsername?.toLowerCase() === target.toLowerCase() && h.mode === mode
    );
  } catch {
    return false;
  }
}

export function ModeSuggestion({
  data,
  onTryOther,
  busy = false,
}: {
  data: EvaluationResult;
  /** 없으면 메인 페이지로 딥링크한다 (공유 카드처럼 분석 기능이 없는 화면용). */
  onTryOther?: (target: string, mode: EvaluationMode) => void;
  busy?: boolean;
}) {
  const otherMode: EvaluationMode = data.mode === "roast" ? "review" : "roast";
  const copy = COPY[otherMode];
  const target = data.targetUsername;

  // localStorage 는 서버에 없다. 마운트 후에 판단해야 하이드레이션이 어긋나지 않는다.
  const [show, setShow] = useState(false);
  useEffect(() => {
    setShow(!alreadyTried(target, otherMode));
  }, [target, otherMode]);

  if (!show || !target) return null;

  const Icon = otherMode === "roast" ? Flame : Briefcase;
  const accent =
    otherMode === "roast"
      ? "border-orange-500/30 bg-orange-500/[0.07] hover:border-orange-500/60"
      : "border-cyan-500/30 bg-cyan-500/[0.07] hover:border-cyan-500/60";
  const iconColor = otherMode === "roast" ? "text-orange-400" : "text-cyan-400";

  const href = `/?target=${encodeURIComponent(target)}&mode=${otherMode}`;

  const inner = (
    <>
      {busy ? (
        <Spinner className={`w-5 h-5 xl:w-6 xl:h-6 ${iconColor}`} />
      ) : (
        <Icon className={`w-5 h-5 xl:w-6 xl:h-6 shrink-0 ${iconColor}`} />
      )}
      <span className="flex-1 text-left">
        <span className="block text-xs xl:text-sm font-bold text-white">
          {copy.headline} {busy ? "분석하는 중..." : copy.label}
        </span>
        <span className="block text-[11px] xl:text-xs text-slate-400 mt-0.5">{copy.blurb}</span>
      </span>
      <ArrowRight className={`w-4 h-4 shrink-0 ${iconColor}`} />
    </>
  );

  const className = `w-full max-w-2xl lg:max-w-3xl xl:max-w-4xl mx-auto mt-5 flex items-center gap-3 px-4 py-3.5 xl:px-5 xl:py-4 rounded-2xl border transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-wait ${accent}`;

  if (onTryOther) {
    return (
      <button type="button" disabled={busy} onClick={() => onTryOther(target, otherMode)} className={className}>
        {inner}
      </button>
    );
  }

  return (
    <a href={href} className={className}>
      {inner}
    </a>
  );
}
