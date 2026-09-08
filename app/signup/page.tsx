"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Flame, UserPlus, Mail, Lock, AlertCircle, ShieldCheck, UserCheck, ArrowRight } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError("모든 필드를 입력해 주세요.");
      return;
    }

    if (password.length < 8) {
      setError("비밀번호는 최소 8자 이상이어야 합니다 (보안 수칙 준수).");
      return;
    }

    if (password !== passwordConfirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "회원가입에 실패했습니다.");
      }

      setSuccessMessage("가입이 완료되었습니다. 대시보드로 이동합니다...");
      window.dispatchEvent(new Event("gitroast-auth-change"));
      window.location.href = "/dashboard";
    } catch (err: any) {
      setError(err.message || "회원가입 처리 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 xl:py-20">
      <div className="w-full max-w-md xl:max-w-lg p-8 xl:p-10 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl relative overflow-hidden">
        {/* Glow */}
        <div className="absolute -top-20 -left-20 w-40 h-40 bg-pink-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-500 to-pink-500 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-orange-500/30">
            <Flame className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl xl:text-3xl font-black text-white">GitRoast 회원가입</h1>
          <p className="text-xs xl:text-sm text-slate-400 mt-1">
            무료 회원가입 후 깃허브 무제한 팩폭 & 진단 카드를 발급받으세요.
          </p>
        </div>

        {currentUser ? (
          <div className="p-6 rounded-2xl bg-slate-950/80 border border-slate-800 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400">이미 로그인된 상태입니다</p>
              <p className="text-sm font-bold text-white mt-0.5">{currentUser.email}</p>
            </div>
            <Link
              href="/dashboard"
              className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
            >
              내 대시보드로 이동 <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {successMessage ? (
              <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs text-center space-y-3">
                <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto" />
                <p className="font-bold">{successMessage}</p>
                <Link
                  href="/login"
                  className="inline-block px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-500"
                >
                  로그인 페이지로 이동
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSignup} className="space-y-4">
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
                  <label className="block text-xs xl:text-sm font-bold text-slate-400 mb-1 xl:mb-1.5">
                    비밀번호 (8자 이상)
                  </label>
                  <div className="relative flex items-center">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 pointer-events-none" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="최소 8자 이상"
                      required
                      minLength={8}
                      className="w-full pl-10 xl:pl-11 pr-4 py-2.5 xl:py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-sm xl:text-base focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs xl:text-sm font-bold text-slate-400 mb-1 xl:mb-1.5">비밀번호 확인</label>
                  <div className="relative flex items-center">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 pointer-events-none" />
                    <input
                      type="password"
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      placeholder="비밀번호 재입력"
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
                    <span>계정 생성 중...</span>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" /> 무료 회원가입
                    </>
                  )}
                </button>
              </form>
            )}

            <p className="text-center text-xs text-slate-500 mt-6">
              이미 계정이 있으신가요?{" "}
              <Link href="/login" className="text-orange-400 font-bold hover:underline">
                로그인하기
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
