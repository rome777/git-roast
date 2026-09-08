"use client";

import React, { useRef, useState } from "react";
import { EvaluationResult } from "@/lib/ai/types";
import { TierBadge } from "./TierBadge";
import { RadarChart } from "./RadarChart";
import { toPng } from "html-to-image";
import {
  Download,
  Share2,
  Bookmark,
  Flame,
  Briefcase,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  ExternalLink,
  Copy,
  Check,
  FolderGit2,
  Star,
  GitFork,
  FileCode2,
  GitBranch,
  Sparkles,
} from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";

interface EvaluationCardProps {
  data: EvaluationResult;
  onBookmark?: () => void;
  isBookmarked?: boolean;
  showActions?: boolean;
}

export function EvaluationCard({
  data,
  onBookmark,
  isBookmarked = false,
  showActions = true,
}: EvaluationCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  const isRoast = data.mode === "roast";
  const isRepo = data.targetType === "repo";
  const repoOwner = data.repoMeta?.owner || (isRepo ? data.targetUsername.split("/")[0] : data.targetUsername);

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        quality: 0.95,
        backgroundColor: "#090d16",
      });
      const link = document.createElement("a");
      const safeName = data.targetUsername.replace(/[\/\\]/g, "-");
      link.download = `git-roast-${data.targetType || "user"}-${safeName}-${data.mode}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Failed to export image:", err);
      alert("이미지 저장 중 오류가 발생했습니다. 브라우저 설정을 확인해 주세요.");
    } finally {
      setDownloading(false);
    }
  };

  // 이 카드의 공유 링크(/result/<id>)를 만든다.
  // window.location.href 를 복사하면 메인 페이지에서 분석했을 때 "/" 가 복사돼
  // 받는 사람이 아무것도 못 본다.
  const shareUrl = data.id ? `${window.location.origin}/result/${encodeURIComponent(data.id)}` : null;

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // 클립보드 권한이 없는 환경(비 HTTPS 등) 폴백
      const ta = document.createElement("textarea");
      ta.value = shareUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="w-full max-w-2xl lg:max-w-3xl xl:max-w-4xl mx-auto flex flex-col items-center gap-5">
      {/* The exportable card container */}
      <div
        ref={cardRef}
        className={`w-full rounded-3xl p-6 sm:p-8 xl:p-10 bg-slate-950 border relative overflow-hidden transition-all duration-300 ${
          isRoast
            ? "border-orange-500/40 shadow-[0_0_35px_rgba(249,115,22,0.15)]"
            : "border-indigo-500/40 shadow-[0_0_35px_rgba(99,102,241,0.15)]"
        }`}
      >
        {/* Background decorative glows */}
        <div
          className={`absolute -top-24 -right-24 w-60 h-60 rounded-full blur-3xl pointer-events-none opacity-20 ${
            isRoast ? "bg-orange-500" : "bg-cyan-500"
          }`}
        />
        <div
          className={`absolute -bottom-24 -left-24 w-60 h-60 rounded-full blur-3xl pointer-events-none opacity-20 ${
            isRoast ? "bg-pink-600" : "bg-purple-600"
          }`}
        />

        {/* Card Header: Mode tag & Logo */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-6">
          <div className="flex items-center gap-2 flex-wrap">
            {isRoast ? (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-orange-500/20 text-orange-400 border border-orange-500/30">
                <Flame className="w-3.5 h-3.5" /> 매운맛 팩폭 (Roast)
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                <Briefcase className="w-3.5 h-3.5" /> 순한맛 리뷰 (Review)
              </span>
            )}

            {isRepo && (
              <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                <FolderGit2 className="w-3 h-3" /> 리포지토리 분석
              </span>
            )}

            {data.isMock ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700">
                SAMPLE MOCK
              </span>
            ) : (
              <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <Sparkles className="w-3 h-3 text-emerald-400" /> Gemini 2.5 AI 실시간 분석
              </span>
            )}
          </div>
          <div className="text-xs font-bold text-slate-400 tracking-wider">
            GIT<span className="text-purple-400">ROAST</span>.AI
          </div>
        </div>

        {/* Profile and Tier Section */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6 mb-6">
          <div className="flex items-center gap-4 text-center sm:text-left">
            <div className="relative">
              <img
                src={`https://github.com/${repoOwner}.png`}
                alt={data.targetUsername}
                className="w-20 h-20 rounded-2xl border-2 border-slate-700 object-cover shadow-lg bg-slate-900"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    "https://avatars.githubusercontent.com/u/9919?s=200&v=4";
                }}
              />
              <div className="absolute -bottom-2 -right-2">
                <TierBadge tier={data.tier} size="sm" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight break-all">
                  {isRepo ? data.targetUsername : `@${data.targetUsername}`}
                </h2>
                <a
                  href={`https://github.com/${data.targetUsername}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
              <p
                className={`text-sm font-semibold mt-1 ${
                  isRoast ? "text-orange-300" : "text-purple-300"
                }`}
              >
                {data.title}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-center sm:items-end shrink-0">
            <div className="text-xs text-slate-400 font-medium">종합 평가 점수</div>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span
                className={`text-4xl font-black tracking-tighter ${
                  isRoast ? "text-orange-400" : "text-cyan-400"
                }`}
              >
                {data.score}
              </span>
              <span className="text-sm font-semibold text-slate-500">/ 100</span>
            </div>
            <TierBadge tier={data.tier} size="md" className="mt-2" />
          </div>
        </div>

        {/* Repository Meta Stats Bar (If Target is Repo) */}
        {isRepo && data.repoMeta && (
          <div className="flex items-center gap-3 flex-wrap p-3 rounded-2xl bg-slate-900/80 border border-slate-800 mb-6 text-xs text-slate-300">
            <div className="flex items-center gap-1">
              <Star className="w-3.5 h-3.5 text-amber-400" />
              <span>스타 {data.repoMeta.stars}</span>
            </div>
            <div className="flex items-center gap-1">
              <GitFork className="w-3.5 h-3.5 text-blue-400" />
              <span>포크 {data.repoMeta.forks}</span>
            </div>
            <div className="flex items-center gap-1">
              <FileCode2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>주력: {data.repoMeta.primaryLanguage}</span>
            </div>
            <div className="flex items-center gap-1">
              <GitBranch className="w-3.5 h-3.5 text-purple-400" />
              <span>기본: {data.repoMeta.defaultBranch}</span>
            </div>
            {data.repoMeta.targetFile && (
              <div className="ml-auto px-2.5 py-0.5 rounded-lg bg-orange-500/20 text-orange-300 border border-orange-500/30 text-[11px] font-bold">
                🎯 파일 분석: {data.repoMeta.targetFile}
              </div>
            )}
          </div>
        )}

        {/* One-Liner Punchline Box */}
        <div
          className={`p-4 rounded-2xl mb-6 border ${
            isRoast
              ? "bg-gradient-to-r from-orange-950/40 via-red-950/20 to-slate-900 border-orange-500/30"
              : "bg-gradient-to-r from-indigo-950/40 via-purple-950/20 to-slate-900 border-indigo-500/30"
          }`}
        >
          <p className="text-base sm:text-lg font-bold text-white text-center leading-relaxed">
            &ldquo;{data.oneLiner}&rdquo;
          </p>
        </div>

        {/* Summary text */}
        <p className="text-sm text-slate-300 leading-relaxed mb-6 bg-slate-900/60 p-4 rounded-xl border border-slate-800/60">
          {data.summary}
        </p>

        {/* Radar Chart & Highlights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 xl:gap-8 items-center mb-6">
          <div className="flex flex-col items-center bg-slate-900/40 p-4 xl:p-6 rounded-2xl border border-slate-800/50">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              5대 역량 분석 레이더
            </h4>
            <RadarChart scores={data.radarScores} customLabels={data.radarLabels} size={260} />
          </div>

          <div className="flex flex-col gap-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              {isRoast ? (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  주요 팩폭 하이라이트
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  핵심 기술 강점
                </>
              )}
            </h4>
            {data.highlights.map((item, idx) => (
              <div
                key={idx}
                className="text-xs sm:text-sm text-slate-200 bg-slate-900/70 p-3.5 rounded-xl border border-slate-800 flex items-start gap-2.5"
              >
                <span className="text-xs font-bold text-slate-500 shrink-0 mt-0.5">
                  0{idx + 1}
                </span>
                <span className="leading-relaxed">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recommendations Section */}
        <div className="mb-6 bg-slate-900/40 p-4 sm:p-5 rounded-2xl border border-slate-800/60">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
            현실적인 개선 가이드
          </h4>
          <ul className="space-y-2.5">
            {data.recommendations.map((rec, idx) => (
              <li key={idx} className="text-xs sm:text-sm text-slate-300 flex items-start gap-2 leading-relaxed">
                <span className="text-emerald-400 font-bold shrink-0 mt-0.5">✓</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Risk Factor Footer Banner */}
        {data.riskFactor && (
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-red-950/30 border border-red-900/50 text-xs sm:text-sm text-red-300 font-medium">
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              주의 진단: {data.riskFactor}
            </span>
            <span className="text-[11px] text-slate-500">
              {new Date(data.analyzedAt).toLocaleDateString("ko-KR")}
            </span>
          </div>
        )}
      </div>

      {/* Action Buttons: Download PNG, Share Link, Bookmark */}
      {showActions && (
        <div className="flex items-center justify-center gap-3 w-full max-w-2xl lg:max-w-3xl xl:max-w-4xl px-2 flex-wrap">
          <button
            onClick={handleDownload}
            disabled={downloading}
            aria-busy={downloading}
            className="flex items-center gap-2 px-5 xl:px-6 py-3 xl:py-3.5 rounded-2xl bg-slate-900 border border-slate-700 hover:border-slate-500 text-white font-bold text-xs sm:text-sm xl:text-base shadow-md transition-all active:scale-95 disabled:opacity-50"
          >
            {downloading ? (
              <Spinner className="w-4 h-4 text-orange-400" />
            ) : (
              <Download className="w-4 h-4 text-orange-400" />
            )}
            {downloading ? "카드 렌더링 중..." : "PNG 이미지 저장"}
          </button>

          <button
            onClick={handleCopyLink}
            disabled={!shareUrl}
            title={shareUrl ?? "아직 저장되지 않은 카드입니다"}
            className="flex items-center gap-2 px-5 xl:px-6 py-3 xl:py-3.5 rounded-2xl bg-slate-900 border border-slate-700 hover:border-slate-500 text-white font-bold text-xs sm:text-sm xl:text-base shadow-md transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" /> 링크 복사됨!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-cyan-400" /> 공유 링크 복사
              </>
            )}
          </button>

          {onBookmark && (
            <button
              onClick={onBookmark}
              className={`flex items-center gap-2 px-5 py-3 rounded-2xl border font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95 ${
                isBookmarked
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                  : "bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500"
              }`}
            >
              <Bookmark className={`w-4 h-4 ${isBookmarked ? "fill-amber-400" : ""}`} />
              {isBookmarked ? "보관됨" : "내 히스토리에 보관"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
