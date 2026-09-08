"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Flame, LogIn, Mail, Lock, AlertCircle, Sparkles, UserCheck, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ email: string } | null>(null);

  useEffect(() => {
    // 로그인 여부는 서버 세션 하나만 본다.
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((json) => {
        if (json?.user?.email) setCurrentUser({ email: json.user.email });
      })
      .catch(() => {});
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError("이메일과 비밀번호를 모두 입력해 주세요.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "로그인에 실패했습니다.");
      }

      window.dispatchEvent(new Event("gitroast-auth-change"));
      window.location.href = "/dashboard";
    } catch (err: any) {
      setError(err.message || "로그인에 실패했습니다. 이메일과 비밀번호를 확인해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/demo", { method: "POST" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error || "데모 로그인에 실패했습니다.");
      }
      window.dispatchEvent(new Event("gitroast-auth-change"));
      window.location.href = "/dashboard";
    } catch (err: any) {
      setError(err.message || "데모 로그인에 실패했습니다.");
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setCurrentUser(null);
    window.dispatchEvent(new Event("gitroast-auth-change"));
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 xl:py-20">
      <div className="w-full max-w-md xl:max-w-lg p-8 xl:p-10 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl relative overflow-hidden">
        {/* Glow */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-orange-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-500 to-pink-500 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-orange-500/30">
            <Flame className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl xl:text-3xl font-black text-white">GitRoast 로그인</h1>
          <p className="text-xs xl:text-sm text-slate-400 mt-1">
            계정에 로그인하여 내 GitHub 분석 히스토리를 관리하세요.
          </p>
        </div>

        {currentUser ? (
          <div className="p-6 rounded-2xl bg-slate-950/80 border border-slate-800 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400">현재 로그인된 계정</p>
              <p className="text-sm font-bold text-white mt-0.5">{currentUser.email}</p>
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <Link
                href="/dashboard"
                className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
              >
                내 대시보드로 이동 <ArrowRight className="w-4 h-4" />
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors"
              >
                다른 계정으로 로그인 (로그아웃)
              </button>
            </div>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs xl:text-sm font-bold text-slate-400 mb-1 xl:mb-1.5">이메일 주소</label>
                <div className="relative flex items-center">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="developer@example.com"
                    required
                    className="w-full pl-10 xl:pl-11 pr-4 py-2.5 xl:py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-sm xl:text-base focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs xl:text-sm font-bold text-slate-400 mb-1 xl:mb-1.5">비밀번호</label>
                <div className="relative flex items-center">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 pointer-events-none" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-10 xl:pl-11 pr-4 py-2.5 xl:py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-sm xl:text-base focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 xl:py-3.5 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 hover:brightness-110 text-white font-bold text-sm xl:text-base shadow-lg shadow-orange-500/25 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span>로그인 중...</span>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" /> 로그인
                  </>
                )}
              </button>
            </form>

            {/* Quick Demo Login button */}
            <div className="mt-4 pt-4 border-t border-slate-800/80 text-center">
              <button
                type="button"
                onClick={handleQuickDemoLogin}
                className="w-full py-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 font-semibold text-xs border border-slate-700 transition-all flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                데모 계정으로 1초 로그인 (테스트용)
              </button>
            </div>

            <p className="text-center text-xs text-slate-500 mt-6">
              아직 계정이 없으신가요?{" "}
              <Link href="/signup" className="text-orange-400 font-bold hover:underline">
                회원가입하기
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
