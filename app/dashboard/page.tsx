"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { History, Bookmark, Sparkles, Trash2, ArrowRight, ExternalLink, Flame, Briefcase } from "lucide-react";
import { Spinner, LoadingScreen } from "@/components/ui/Spinner";
import { EvaluationResult } from "@/lib/ai/types";
import { TierBadge } from "@/components/evaluation/TierBadge";

export default function DashboardPage() {
  const [history, setHistory] = useState<EvaluationResult[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "roast" | "review">("all");
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState<{ email: string } | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    // 히스토리는 서버가 세션으로 소유자를 판정해 돌려준다.
    // localStorage 로는 대체하지 않는다 — 공용 브라우저에서 이전 계정 기록이 새는 경로였다.
    const load = async () => {
      try {
        const res = await fetch("/api/history");

        if (res.status === 401) {
          setNeedsLogin(true);
          setHistory([]);
          return;
        }

        if (res.ok) {
          const json = await res.json();
          setNeedsLogin(false);
          if (json.email) setCurrentUser({ email: json.email });
          setHistory(Array.isArray(json.evaluations) ? json.evaluations : []);
        }
      } catch (err) {
        console.warn("히스토리 조회 실패:", err);
      } finally {
        setLoading(false);
      }
    };

    load();

    try {
      const savedBookmarks = localStorage.getItem("gitroast_bookmarks");
      if (savedBookmarks) {
        setBookmarkedIds(JSON.parse(savedBookmarks));
      }
    } catch {}
  }, []);

  const handleToggleBookmark = (username: string) => {
    const updated = bookmarkedIds.includes(username)
      ? bookmarkedIds.filter((id) => id !== username)
      : [...bookmarkedIds, username];
    setBookmarkedIds(updated);
    localStorage.setItem("gitroast_bookmarks", JSON.stringify(updated));
  };

  const handleClearHistory = async () => {
    if (clearing) return;
    if (!confirm("모든 분석 히스토리를 DB에서 삭제하시겠습니까?")) return;

    // 전체 삭제는 되돌릴 수 없다. 진행 중임을 보여 주지 않으면 사용자가
    // 안 눌렸다고 생각해 한 번 더 누른다.
    setClearing(true);
    try {
      await fetch("/api/history", { method: "DELETE" });
      setHistory([]);
    } catch {
      alert("삭제에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setClearing(false);
    }
  };

  const filteredHistory = history.filter((item) => {
    if (activeTab === "roast") return item.mode === "roast";
    if (activeTab === "review") return item.mode === "review";
    return true;
  });

  if (loading) {
    return <LoadingScreen message="보관함 불러오는 중..." />;
  }

  if (needsLogin) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-20 text-center">
        <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400 mb-4">
          <History className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-black text-white mb-2">로그인이 필요합니다</h1>
        <p className="text-xs xl:text-sm text-slate-400 mb-6 max-w-sm">
          내 평가 보관함은 로그인한 계정에만 표시됩니다. 로그인하면 이 계정으로 분석한 기록만 모아서 볼 수 있습니다.
        </p>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs xl:text-sm transition-colors"
          >
            로그인 하러 가기
          </Link>
          <Link
            href="/"
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs xl:text-sm transition-colors"
          >
            메인으로
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col max-w-5xl xl:max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 xl:py-14">
      {/* Dashboard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6 mb-8">
        <div>
          <div className="flex items-center gap-2 text-xs xl:text-sm font-bold text-orange-400 uppercase tracking-wider mb-1">
            <History className="w-4 h-4" /> {currentUser ? `${currentUser.email}님의 평가 보관함` : "내 평가 보관함"}
          </div>
          <h1 className="text-2xl sm:text-3xl xl:text-4xl font-black text-white">분석 히스토리 & 즐겨찾기</h1>
          <p className="text-xs xl:text-sm sm:text-sm xl:text-base text-slate-400 mt-1">
            {currentUser
              ? `환영합니다! ${currentUser.email} 계정으로 동기화된 GitHub 분석 기록입니다.`
              : "내가 지금까지 진단했던 GitHub 계정들의 평가 리포트 모음입니다."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {history.length > 0 && (
            <button
              onClick={handleClearHistory}
              disabled={clearing}
              aria-busy={clearing}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs xl:text-sm font-semibold text-slate-400 hover:text-rose-400 hover:bg-rose-950/20 disabled:opacity-60 disabled:cursor-not-allowed border border-slate-800 transition-colors"
            >
              {clearing ? (
                <>
                  <Spinner className="w-3.5 h-3.5" /> 비우는 중...
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" /> 비우기
                </>
              )}
            </button>
          )}
          <Link
            href="/"
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs xl:text-sm sm:text-sm font-bold bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-md shadow-orange-500/20 hover:brightness-110 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" /> 새 분석하기
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6 border-b border-slate-800/50 pb-2">
        <button
          onClick={() => setActiveTab("all")}
          className={`px-3.5 py-1.5 rounded-lg text-xs xl:text-sm sm:text-sm font-bold transition-all ${
            activeTab === "all" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          전체 ({history.length})
        </button>
        <button
          onClick={() => setActiveTab("roast")}
          className={`flex items-center gap-1 px-3.5 py-1.5 rounded-lg text-xs xl:text-sm sm:text-sm font-bold transition-all ${
            activeTab === "roast"
              ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Flame className="w-3 h-3" /> 매운맛
        </button>
        <button
          onClick={() => setActiveTab("review")}
          className={`flex items-center gap-1 px-3.5 py-1.5 rounded-lg text-xs xl:text-sm sm:text-sm font-bold transition-all ${
            activeTab === "review"
              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Briefcase className="w-3 h-3" /> 순한맛
        </button>
      </div>

      {/* History Grid */}
      {filteredHistory.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 text-center rounded-3xl bg-slate-900/40 border border-slate-800 min-h-[300px]">
          <History className="w-12 h-12 text-slate-600 mb-3" />
          <h3 className="text-base font-bold text-slate-300">저장된 분석 내역이 없습니다</h3>
          <p className="text-xs xl:text-sm text-slate-500 mt-1 mb-6">
            메인 페이지에서 GitHub 아이디를 입력하고 첫 번째 평가 카드를 발급받아 보세요!
          </p>
          <Link
            href="/"
            className="px-5 py-2.5 rounded-xl text-xs xl:text-sm font-bold bg-orange-600 text-white hover:bg-orange-500 transition-colors"
          >
            첫 분석 시작하기
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 xl:gap-6">
          {filteredHistory.map((item, idx) => {
            const isRoast = item.mode === "roast";
            const isBookmarked = bookmarkedIds.includes(item.targetUsername);

            return (
              <div
                key={idx}
                className={`group relative p-5 xl:p-6 rounded-2xl bg-slate-900/80 border transition-all hover:scale-[1.01] ${
                  item.id ? "cursor-pointer" : ""
                } ${
                  isRoast
                    ? "border-slate-800 hover:border-orange-500/50"
                    : "border-slate-800 hover:border-cyan-500/50"
                }`}
              >
                {/* 카드 전면을 덮는 링크 — 어디를 눌러도 상세로 간다.
                    즐겨찾기 버튼만 위(z-20)로 올려 클릭을 가로챈다. */}
                {item.id && (
                  <Link
                    href={`/result/${encodeURIComponent(item.id)}`}
                    aria-label={`${item.targetUsername} 분석 카드 열기`}
                    className="absolute inset-0 z-10 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/70"
                  />
                )}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={`https://github.com/${item.targetUsername}.png`}
                      alt={item.targetUsername}
                      className="w-12 h-12 rounded-xl object-cover border border-slate-700 bg-slate-800"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "https://avatars.githubusercontent.com/u/9919?s=200&v=4";
                      }}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-white text-base">
                          @{item.targetUsername}
                        </span>
                        <TierBadge tier={item.tier} size="sm" />
                      </div>
                      <p className="text-xs xl:text-sm font-medium text-slate-400 line-clamp-1 mt-0.5">
                        {item.title}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleBookmark(item.targetUsername)}
                    title={isBookmarked ? "즐겨찾기 해제" : "즐겨찾기 추가"}
                    className={`relative z-20 p-1.5 rounded-lg border transition-colors ${
                      isBookmarked
                        ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                        : "bg-slate-800 text-slate-400 border-slate-700 hover:text-white"
                    }`}
                  >
                    <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? "fill-amber-400" : ""}`} />
                  </button>
                </div>

                {/* Punchline snippet */}
                <p className="text-xs xl:text-sm text-slate-300 italic line-clamp-2 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60 mb-3">
                  &ldquo;{item.oneLiner}&rdquo;
                </p>

                {/* Card footer */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs xl:text-sm">
                  <span className="text-[11px] xl:text-xs xl:text-sm text-slate-500 font-medium">
                    {new Date(item.analyzedAt).toLocaleDateString("ko-KR")} 분석
                  </span>
                  {item.id ? (
                    <span className="flex items-center gap-1 font-bold text-orange-400 group-hover:text-orange-300 transition-colors">
                      카드 보기
                      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  ) : (
                    <span className="text-[11px] xl:text-xs text-slate-600">링크 없음</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
