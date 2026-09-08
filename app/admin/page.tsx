"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Shield,
  Users,
  Database,
  Search,
  Filter,
  Trash2,
  ExternalLink,
  Flame,
  Briefcase,
  FolderGit2,
  User,
  ArrowUpDown,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { TierBadge } from "@/components/evaluation/TierBadge";

interface AdminEvaluation {
  id: string;
  user_id: string;
  user_email: string;
  target_type: "user" | "repo";
  target_name: string;
  mode: "roast" | "review";
  tier: any;
  score: number;
  title: string;
  one_liner: string;
  summary: string;
  details: string;
  created_at: string;
}

interface AdminStats {
  dbType?: "PostgreSQL" | "SQLite";
  totalEvaluations: number;
  totalUsers: number;
  repoEvaluations: number;
  userEvaluations: number;
  usersWithCounts: Array<{ user_email: string; eval_count: number }>;
}

export default function AdminPage() {
  const [evaluations, setEvaluations] = useState<AdminEvaluation[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [selectedMode, setSelectedMode] = useState<"all" | "roast" | "review">("all");
  const [selectedTargetType, setSelectedTargetType] = useState<"all" | "user" | "repo">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [denied, setDenied] = useState<"unauthorized" | "forbidden" | null>(null);

  const fetchAdminData = async (filterEmail?: string) => {
    try {
      setRefreshing(true);
      const url = filterEmail && filterEmail !== "all"
        ? `/api/admin/evaluations?userEmail=${encodeURIComponent(filterEmail)}`
        : "/api/admin/evaluations";

      const res = await fetch(url);

      // 서버가 권한을 판정한다. 클라이언트는 그 결과를 표시만 한다.
      if (res.status === 401 || res.status === 403) {
        setDenied(res.status === 401 ? "unauthorized" : "forbidden");
        return;
      }

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "데이터를 불러오지 못했습니다.");
      }

      setDenied(null);
      setEvaluations(Array.isArray(json.evaluations) ? json.evaluations : []);
      setStats(json.stats || null);
    } catch (err: any) {
      setError(err.message || "오류가 발생했습니다.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleFilterUser = (email: string) => {
    setSelectedUser(email);
    fetchAdminData(email);
  };

  const handleDelete = async (id: string, targetName: string) => {
    if (!confirm(`'${targetName}' 평가 기록을 DB에서 영구 삭제하시겠습니까?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/evaluations?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });

      if (res.status === 401 || res.status === 403) {
        setDenied(res.status === 401 ? "unauthorized" : "forbidden");
        return;
      }
      if (!res.ok) throw new Error("삭제에 실패했습니다.");

      setEvaluations((prev) => (Array.isArray(prev) ? prev.filter((item) => item.id !== id) : []));
      if (stats) {
        setStats({
          ...stats,
          totalEvaluations: Math.max(0, stats.totalEvaluations - 1),
        });
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const list = Array.isArray(evaluations) ? evaluations : [];
  const roastCount = list.filter((item) => item.mode === "roast").length;
  const reviewCount = list.filter((item) => item.mode === "review").length;
  const repoCount = list.filter((item) => item.target_type === "repo").length;
  const userCount = list.filter((item) => item.target_type === "user").length;

  const filteredList = list.filter((item) => {
    if (selectedMode !== "all" && item.mode !== selectedMode) return false;
    if (selectedTargetType !== "all" && item.target_type !== selectedTargetType) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (item.target_name || "").toLowerCase().includes(q) ||
      (item.user_email || "").toLowerCase().includes(q) ||
      (item.title || "").toLowerCase().includes(q) ||
      (item.one_liner || "").toLowerCase().includes(q)
    );
  });

  if (denied) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-20 text-center">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-4">
          <Shield className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-black text-white mb-2">
          {denied === "unauthorized" ? "로그인이 필요합니다" : "접근 권한이 없습니다"}
        </h1>
        <p className="text-xs xl:text-sm text-slate-400 mb-6 max-w-sm">
          {denied === "unauthorized"
            ? "관리자 콘솔은 로그인한 관리자 계정만 열람할 수 있습니다."
            : "이 계정에는 관리자 권한이 없습니다. 관리자 계정으로 다시 로그인해 주세요."}
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
    <div className="flex-1 flex flex-col max-w-6xl xl:max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 xl:py-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6 mb-8">
        <div>
          <div className="flex items-center gap-2 text-xs xl:text-sm font-bold text-amber-400 uppercase tracking-wider mb-1 flex-wrap">
            <span className="flex items-center gap-1.5">
              <Shield className="w-4 h-4" /> 시스템 관리자 콘솔 (Admin Console)
            </span>
            {stats?.dbType && (
              <span className="px-2 py-0.5 rounded-full text-[11px] xl:text-xs xl:text-sm font-semibold bg-blue-950/60 text-blue-300 border border-blue-800/60 flex items-center gap-1">
                {stats.dbType === "PostgreSQL" ? "🐘 PostgreSQL 활성화" : "🗄️ SQLite 로컬 모드"}
              </span>
            )}
          </div>
          <h1 className="text-3xl xl:text-4xl font-black text-white">전체 사용자 저장 히스토리 관리</h1>
          <p className="text-xs xl:text-sm sm:text-sm text-slate-400 mt-1">
            {stats?.dbType === "PostgreSQL"
              ? "PostgreSQL 데이터베이스에 실시간 영구 저장된 모든 회원의 분석 리포트 및 작성자 현황입니다."
              : "서버 SQLite DB(`data/gitroast.db`)에 영구 저장된 모든 회원의 분석 리포트 및 작성자 현황입니다."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchAdminData(selectedUser)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs xl:text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            새로고침
          </button>
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs xl:text-sm font-bold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition-all"
          >
            내 개인 대시보드로 가기
          </Link>
        </div>
      </div>

      {/* Stats Summary Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs xl:text-sm font-bold">총 저장된 분석 리포트</span>
              <Database className="w-4 h-4 text-orange-400" />
            </div>
            <div className="text-2xl xl:text-3xl font-black text-white">{stats.totalEvaluations}건</div>
            <div className="text-[11px] xl:text-xs xl:text-sm text-slate-500 mt-1">서버 DB 실시간 집계</div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs xl:text-sm font-bold">등록된 총 사용자</span>
              <Users className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl xl:text-3xl font-black text-white">{stats.totalUsers}명</div>
            <div className="text-[11px] xl:text-xs xl:text-sm text-slate-500 mt-1">
              관리자 & 일반 사용자 포함
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs xl:text-sm font-bold">리포지토리 분석 건수</span>
              <FolderGit2 className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl xl:text-3xl font-black text-white">{stats.repoEvaluations}건</div>
            <div className="text-[11px] xl:text-xs xl:text-sm text-slate-500 mt-1">단일 저장소 정밀 진단</div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs xl:text-sm font-bold">개발자 프로필 분석</span>
              <User className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl xl:text-3xl font-black text-white">{stats.userEvaluations}건</div>
            <div className="text-[11px] xl:text-xs xl:text-sm text-slate-500 mt-1">전체 계정 활동 진단</div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar Container */}
      <div className="flex flex-col gap-3 p-4 sm:p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 mb-6 shadow-sm">
        {/* Row 1: Mode Filter (Roast vs Review) & Target Type */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800/60 pb-3">
          {/* Mode Tabs */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs xl:text-sm text-slate-400 font-bold mr-1 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-orange-400" /> 맛 모드 필터:
            </span>
            <button
              onClick={() => setSelectedMode("all")}
              className={`px-3 py-1.5 rounded-xl text-xs xl:text-sm font-bold transition-all ${
                selectedMode === "all"
                  ? "bg-slate-700 text-white shadow-sm border border-slate-600"
                  : "bg-slate-800/70 text-slate-400 hover:text-white border border-transparent"
              }`}
            >
              전체 모드 <span className="text-[10px] opacity-75 font-mono">({list.length})</span>
            </button>
            <button
              onClick={() => setSelectedMode("roast")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs xl:text-sm font-bold transition-all ${
                selectedMode === "roast"
                  ? "bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-md shadow-orange-500/25 border border-orange-400/30"
                  : "bg-slate-800/70 text-slate-400 hover:text-orange-300 border border-slate-700/50"
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              🔥 매운맛 팩폭만 <span className="text-[10px] opacity-80 font-mono">({roastCount})</span>
            </button>
            <button
              onClick={() => setSelectedMode("review")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs xl:text-sm font-bold transition-all ${
                selectedMode === "review"
                  ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md shadow-cyan-500/25 border border-cyan-400/30"
                  : "bg-slate-800/70 text-slate-400 hover:text-cyan-300 border border-slate-700/50"
              }`}
            >
              <Briefcase className="w-3.5 h-3.5 text-cyan-400" />
              💼 순한맛 리뷰만 <span className="text-[10px] opacity-80 font-mono">({reviewCount})</span>
            </button>
          </div>

          {/* Target Type Filter */}
          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <span className="text-xs xl:text-sm text-slate-400 font-bold mr-1">대상:</span>
            <button
              onClick={() => setSelectedTargetType("all")}
              className={`px-2.5 py-1 rounded-lg text-xs xl:text-sm font-semibold transition-all ${
                selectedTargetType === "all"
                  ? "bg-slate-700 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              전체
            </button>
            <button
              onClick={() => setSelectedTargetType("repo")}
              className={`px-2.5 py-1 rounded-lg text-xs xl:text-sm font-semibold flex items-center gap-1 transition-all ${
                selectedTargetType === "repo"
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <FolderGit2 className="w-3 h-3 text-purple-400" /> 리포지토리 <span className="text-[10px] font-mono">({repoCount})</span>
            </button>
            <button
              onClick={() => setSelectedTargetType("user")}
              className={`px-2.5 py-1 rounded-lg text-xs xl:text-sm font-semibold flex items-center gap-1 transition-all ${
                selectedTargetType === "user"
                  ? "bg-orange-500/20 text-orange-300 border border-orange-500/40"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <User className="w-3 h-3 text-orange-400" /> 개발자 <span className="text-[10px] font-mono">({userCount})</span>
            </button>
          </div>
        </div>

        {/* Row 2: User Filter Tabs & Search Input */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-1">
          {/* User filter tabs */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs xl:text-sm text-slate-400 font-bold mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-amber-400" /> 작성자:
            </span>
            <button
              onClick={() => handleFilterUser("all")}
              className={`px-3 py-1.5 rounded-xl text-xs xl:text-sm font-bold transition-all ${
                selectedUser === "all"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm"
                  : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              전체 작성자
            </button>
            {(stats?.usersWithCounts || []).map((u) => (
              <button
                key={u.user_email}
                onClick={() => handleFilterUser(u.user_email)}
                className={`px-3 py-1.5 rounded-xl text-xs xl:text-sm font-semibold transition-all ${
                  selectedUser === u.user_email
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                    : "bg-slate-800/80 text-slate-400 hover:text-white"
                }`}
              >
                {u.user_email} <span className="text-[10px] text-slate-500 font-mono">({u.eval_count})</span>
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative flex items-center min-w-[280px]">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="타겟명, 이메일, 키워드 검색..."
              className="w-full pl-9 xl:pl-10 pr-3 py-2 xl:py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-xs xl:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40"
            />
          </div>
        </div>
      </div>

      {/* Main Evaluations Table */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 text-sm animate-pulse">
          데이터베이스에서 히스토리를 불러오는 중입니다...
        </div>
      ) : filteredList.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-slate-900/40 border border-slate-800 text-slate-400 text-sm">
          조건에 부합하는 저장된 평가 내역이 없습니다.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-800 shadow-xl bg-slate-900/40">
          <table className="w-full text-left text-xs xl:text-[13px] text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 text-[11px] xl:text-xs uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-2 px-3 font-bold">작성자</th>
                <th className="py-2 px-3 font-bold">분석 대상</th>
                <th className="py-2 px-3 font-bold">모드</th>
                <th className="py-2 px-3 font-bold">티어</th>
                <th className="py-2 px-3 font-bold">핵심 팩폭</th>
                <th className="py-2 px-3 font-bold whitespace-nowrap">저장 일시</th>
                <th className="py-2 px-3 font-bold text-center">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredList.map((row) => {
                const isRoast = row.mode === "roast";
                const isRepo = row.target_type === "repo";

                return (
                  <tr
                    key={row.id}
                    className="hover:bg-slate-800/40 transition-colors [&>td]:py-1.5 [&>td]:px-3 [&>td]:whitespace-nowrap [&>td]:align-middle"
                  >
                    {/* 작성자 */}
                    <td className="max-w-[190px]">
                      <span className="block truncate text-slate-300" title={`${row.user_email} (ID: ${row.user_id})`}>
                        {row.user_email}
                      </span>
                    </td>

                    {/* 분석 대상 */}
                    <td className="max-w-[220px]">
                      <Link
                        href={`/result/${encodeURIComponent(row.id)}`}
                        className="flex items-center gap-1.5 font-bold text-white hover:text-cyan-300 hover:underline"
                        title={`${row.target_name} — ${isRepo ? "리포지토리" : "개발자 계정"}`}
                      >
                        {isRepo ? (
                          <FolderGit2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        ) : (
                          <User className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                        )}
                        <span className="truncate">{row.target_name}</span>
                      </Link>
                    </td>

                    {/* 모드 */}
                    <td>
                      {isRoast ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] xl:text-[11px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30">
                          <Flame className="w-3 h-3" /> 매운맛
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] xl:text-[11px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                          <Briefcase className="w-3 h-3" /> 순한맛
                        </span>
                      )}
                    </td>

                    {/* 티어 / 점수 */}
                    <td>
                      <div className="flex items-center gap-1.5">
                        <TierBadge tier={row.tier as any} size="sm" />
                        <span className="font-bold text-white tabular-nums">{row.score}</span>
                      </div>
                    </td>

                    {/* 핵심 팩폭 — 한 줄. 한줄평은 툴팁으로 */}
                    <td className="max-w-[280px]">
                      <span
                        className="block truncate font-medium text-slate-200"
                        title={`${row.title}
"${row.one_liner}"`}
                      >
                        {row.title}
                      </span>
                    </td>

                    {/* 저장 일시 */}
                    <td className="text-slate-400 text-[11px] xl:text-xs tabular-nums">
                      {new Date(row.created_at).toLocaleString("ko-KR", {
                        year: "2-digit",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>

                    {/* 관리 */}
                    <td className="text-center">
                      <div className="flex items-center justify-center gap-0.5">
                        <Link
                          href={`/result/${encodeURIComponent(row.id)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="카드 보기 (새 탭)"
                          className="p-1 rounded text-slate-500 hover:text-cyan-400 hover:bg-slate-800 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                        <button
                          onClick={() => handleDelete(row.id, row.target_name)}
                          title="DB에서 영구 삭제"
                          className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/20 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
