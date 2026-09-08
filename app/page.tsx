"use client";

import React, { useState } from "react";
import {
  Flame,
  Briefcase,
  Search,
  ArrowRight,
  Github,
  ShieldAlert,
  Cpu,
  FolderGit2,
  User,
  FileCode2,
  Globe,
  Info,
} from "lucide-react";
import { EvaluationMode, EvaluationResult } from "@/lib/ai/types";
import { EvaluationCard } from "@/components/evaluation/EvaluationCard";

const SAMPLE_TARGETS = [
  {
    name: "torvalds",
    label: "@torvalds (리눅스 아버지)",
    mode: "roast" as EvaluationMode,
    isRepo: false,
  },
  {
    name: "https://github.com/rome777/aiffel_test/blob/main/SPEC.md",
    label: "📦 rome777/aiffel_test (SPEC.md 분석)",
    mode: "roast" as EvaluationMode,
    isRepo: true,
  },
  {
    name: "rookie-dev",
    label: "@rookie-dev (코딩꿈나무)",
    mode: "roast" as EvaluationMode,
    isRepo: false,
  },
  {
    name: "facebook/react",
    label: "📦 facebook/react (리뷰 모드)",
    mode: "review" as EvaluationMode,
    isRepo: true,
  },
];

const USER_LOADING_STEPS = [
  "GitHub 잔디밭에서 잡초 뽑는 중...",
  "커밋 메시지 중 'fix'와 '제발' 빈도수 계산 중...",
  "방치된 튜토리얼 리포지토리 발굴 중...",
  "AI 판사가 촌철살인 팩폭 펀치라인 작성 중...",
  "개발자 생존 티어 채점 중...",
];

const REPO_LOADING_STEPS = [
  "리포지토리 파일 구조 및 SPEC.md 문서 해부 중...",
  "커밋 메시지 및 AI(Claude) Co-Author 흔적 추적 중...",
  "테스트 코드 유무 및 CI/CD 워크플로우 진단 중...",
  "시니어 아키텍트가 리포지토리 팩폭 보고서 작성 중...",
  "프로젝트 프로덕션 완성도 티어 채점 중...",
];

export default function HomePage() {
  const [username, setUsername] = useState("");
  const [mode, setMode] = useState<EvaluationMode>("roast");
  const [loading, setLoading] = useState(false);
  const [loadingStepIdx, setLoadingStepIdx] = useState(0);
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isRepoDetected = username.trim().includes("/") || username.trim().includes("github.com");

  const handleAnalyze = async (targetInput?: string, targetMode?: EvaluationMode) => {
    const target = targetInput || username;
    const currentMode = targetMode || mode;

    if (!target.trim()) {
      setError("GitHub 사용자명 또는 리포지토리 URL을 입력해 주세요!");
      return;
    }

    setError(null);
    setLoading(true);
    setLoadingStepIdx(0);

    const steps = target.includes("/") ? REPO_LOADING_STEPS : USER_LOADING_STEPS;

    // Rotate loading messages
    const stepInterval = setInterval(() => {
      setLoadingStepIdx((prev) => (prev + 1) % steps.length);
    }, 1200);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: target, mode: currentMode }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "분석 요청에 실패했습니다.");
      }

      setResult(json.data);

      // Save to local storage for quick access in dashboard
      try {
        const history = JSON.parse(localStorage.getItem("gitroast_history") || "[]");
        const updated = [json.data, ...history.filter((h: any) => h.id !== json.data.id)].slice(0, 20);
        localStorage.setItem("gitroast_history", JSON.stringify(updated));
      } catch {}

      // Smooth scroll to result
      setTimeout(() => {
        document.getElementById("result-section")?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (err: any) {
      setError(err.message || "오류가 발생했습니다.");
    } finally {
      clearInterval(stepInterval);
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-start px-4 sm:px-6 lg:px-8 py-12 xl:pt-[13vh] xl:pb-24 max-w-5xl xl:max-w-6xl mx-auto w-full">
      {/* Hero Title */}
      <h1 className="text-4xl sm:text-6xl xl:text-7xl font-black text-center tracking-tight text-white max-w-3xl xl:max-w-5xl leading-tight text-balance">
        당신의 깃허브,{" "}
        <span className="gradient-text-roast">잔디밭</span>인가요{" "}
        <span className="gradient-text-roast">사막</span>인가요?
      </h1>

      <p className="text-slate-400 text-sm sm:text-base xl:text-lg text-center max-w-xl mt-4">
        GitHub 아이디나 리포지토리 URL을 넣으면 AI가 분석 카드를 만들어 줍니다.
      </p>

      {/* Mode Selector Toggle */}
      <div className="flex items-center p-1.5 rounded-2xl bg-slate-900 border border-slate-800 mt-8 shadow-inner">
        <button
          type="button"
          onClick={() => setMode("roast")}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-xs sm:text-sm transition-all ${
            mode === "roast"
              ? "bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-lg shadow-orange-500/25"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Flame className="w-4 h-4" />
          매운맛 팩폭
        </button>
        <button
          type="button"
          onClick={() => setMode("review")}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-xs sm:text-sm transition-all ${
            mode === "review"
              ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-cyan-500/25"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Briefcase className="w-4 h-4" />
          순한맛 리뷰
        </button>
      </div>

      {/* Input Search Form */}
      <div className="w-full max-w-2xl xl:max-w-3xl mt-6 xl:mt-8">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAnalyze();
          }}
          className="relative flex items-center"
        >
          <div className="absolute left-4 pointer-events-none text-slate-500">
            {isRepoDetected ? (
              <FolderGit2 className="w-5 h-5 text-purple-400" />
            ) : (
              <Github className="w-5 h-5" />
            )}
          </div>
          <input
            type="text"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setError(null);
            }}
            placeholder="공개 GitHub 아이디 또는 Public 리포지토리 URL (예: torvalds, rome777/aiffel_test...)"
            className="w-full pl-12 pr-32 py-4 xl:py-5 rounded-2xl bg-slate-900/90 border border-slate-800 text-white placeholder-slate-500 text-sm sm:text-base xl:text-lg font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all shadow-xl"
          />
          <button
            type="submit"
            disabled={loading}
            className="absolute right-2 px-6 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-black text-xs sm:text-sm shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
          >
            {loading ? (
              <span className="flex items-center gap-1">
                <span className="animate-spin text-sm">⏳</span> 분석중
              </span>
            ) : (
              <>
                분석하기 <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Public Repository Notice */}
        <p className="mt-2 text-xs text-slate-400 text-center">
          공개(Public) 리포지토리만 분석 가능합니다
        </p>

        {/* 입력 대상 자동 감지 */}
        {username.trim() && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 mt-2 rounded-xl bg-slate-900/60 border border-slate-800/80 text-[11px] xl:text-xs text-slate-400">
            {isRepoDetected ? (
              <>
                <FolderGit2 className="w-3.5 h-3.5 text-purple-400" />
                <strong className="text-purple-300">리포지토리</strong> 분석
              </>
            ) : (
              <>
                <User className="w-3.5 h-3.5 text-orange-400" />
                <strong className="text-orange-300">개발자 프로필</strong> 분석
              </>
            )}
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mt-3 p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs text-center font-medium animate-shake">
            {error}
          </div>
        )}

        {/* Quick Sample Chips */}
        <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
          <span className="text-xs text-slate-500 font-medium">빠른 체험:</span>
          {SAMPLE_TARGETS.map((sample, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setUsername(sample.name);
                setMode(sample.mode);
                handleAnalyze(sample.name, sample.mode);
              }}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-all flex items-center gap-1"
            >
              {sample.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading Progress State */}
      {loading && (
        <div className="w-full max-w-md mt-12 p-6 rounded-3xl bg-slate-900/50 border border-slate-800 text-center flex flex-col items-center animate-pulse">
          <div className="w-12 h-12 rounded-2xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center mb-4">
            <Cpu className="w-6 h-6 text-orange-400 animate-spin" />
          </div>
          <p className="text-sm font-bold text-white mb-2">AI 엔지니어가 분석을 집도하고 있습니다</p>
          <p className="text-xs font-semibold text-orange-400 transition-all duration-300">
            {(isRepoDetected ? REPO_LOADING_STEPS : USER_LOADING_STEPS)[loadingStepIdx]}
          </p>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-4 overflow-hidden">
            <div
              className="bg-gradient-to-r from-orange-500 to-pink-500 h-full transition-all duration-500"
              style={{
                width: `${
                  ((loadingStepIdx + 1) /
                    (isRepoDetected ? REPO_LOADING_STEPS.length : USER_LOADING_STEPS.length)) *
                  100
                }%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Evaluation Result Section */}
      {result && !loading && (
        <section id="result-section" className="w-full mt-16 scroll-mt-24">
          <EvaluationCard
            data={result}
            onBookmark={() => {
              alert("현재 평가 카드가 내 히스토리에 보관되었습니다!");
            }}
          />
        </section>
      )}

    </div>
  );
}
