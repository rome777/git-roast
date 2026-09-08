"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Flame,
  LogIn,
  Mail,
  Lock,
  AlertCircle,
  Sparkles,
  UserCheck,
  ArrowRight,
  MailCheck,
} from "lucide-react";
import { CaptchaWidget, isCaptchaEnabled } from "@/components/auth/CaptchaWidget";
import { Spinner, FormSkeleton } from "@/components/ui/Spinner";

/** /api/auth/verify-email 이 리다이렉트로 붙여 주는 결과 안내. */
const VERIFY_NOTICE: Record<string, { tone: "ok" | "bad"; text: string }> = {
  ok: { tone: "ok", text: "이메일 확인이 완료되었습니다. 이제 로그인할 수 있습니다." },
  invalid: {
    tone: "bad",
    text: "확인 링크가 만료되었거나 올바르지 않습니다. 아래에서 메일을 다시 받아 주세요.",
  },
  error: { tone: "bad", text: "이메일 확인 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." },
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ email: string } | null>(null);
  /** 서버에 로그인 여부를 묻는 동안 폼을 그리지 않는다(깜빡임 방지). */
  const [checkingSession, setCheckingSession] = useState(true);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);

  const [notice, setNotice] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  /** 비밀번호는 맞았는데 이메일이 아직 확인되지 않은 상태. 재발송 버튼을 띄운다. */
  const [needsVerification, setNeedsVerification] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  /** 로그인 버튼에 지금 무엇을 하는지 적는다. */
  const [step, setStep] = useState<string | null>(null);

  useEffect(() => {
    // useSearchParams 를 쓰면 Suspense 경계가 필요해진다. 마운트 뒤 한 번만 읽으면 되므로
    // 여기서는 location 을 직접 본다.
    const params = new URLSearchParams(window.location.search);
    const verify = params.get("verify");
    if (verify && VERIFY_NOTICE[verify]) {
      setNotice(VERIFY_NOTICE[verify]);
      const prefill = params.get("email");
      if (prefill) setEmail(prefill);
      if (verify !== "ok") setNeedsVerification(prefill || null);
    }
  }, []);

  useEffect(() => {
    // 로그인 여부는 서버 세션 하나만 본다.
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((json) => {
        if (json?.user?.email) setCurrentUser({ email: json.user.email });
      })
      .catch(() => {})
      .finally(() => setCheckingSession(false));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNeedsVerification(null);

    if (!email.trim() || !password.trim()) {
      setError("이메일과 비밀번호를 모두 입력해 주세요.");
      return;
    }

    if (isCaptchaEnabled() && !captchaToken) {
      setError("자동 로그인 방지 확인을 먼저 완료해 주세요.");
      return;
    }

    setLoading(true);
    setStep(isCaptchaEnabled() ? "자동 로그인 방지 확인 중..." : "로그인하는 중...");
    let navigating = false;

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, captchaToken }),
      });
      const json = await res.json();

      if (!res.ok) {
        if (json?.verificationRequired) setNeedsVerification(json.email || email.trim());
        throw new Error(json?.error || "로그인에 실패했습니다.");
      }

      // 이동이 끝날 때까지 버튼을 되돌리지 않는다(중복 제출 방지).
      navigating = true;
      setStep("대시보드로 이동 중...");
      window.dispatchEvent(new Event("gitroast-auth-change"));
      window.location.href = "/dashboard";
    } catch (err: any) {
      setError(err.message || "로그인에 실패했습니다. 이메일과 비밀번호를 확인해 주세요.");
      // 토큰은 1회용이다. 실패했으면 위젯을 새로 그려야 다시 시도할 수 있다.
      setCaptchaToken(null);
      setCaptchaKey((k) => k + 1);
    } finally {
      if (!navigating) {
        setStep(null);
        setLoading(false);
      }
    }
  };

  const handleResend = async () => {
    const target = needsVerification || email.trim();
    if (!target || resending) return;
    setResending(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: target }),
      });
      const json = await res.json();
      setNotice({ tone: "ok", text: json?.message || "재발송 요청을 보냈습니다." });
    } catch {
      setNotice({ tone: "bad", text: "재발송에 실패했습니다. 잠시 후 다시 시도해 주세요." });
    } finally {
      setResending(false);
    }
  };

  const handleQuickDemoLogin = async () => {
    setError(null);
    setLoading(true);
    setStep("데모 계정 준비 중...");
    try {
      const res = await fetch("/api/auth/demo", { method: "POST" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error || "데모 로그인에 실패했습니다.");
      }
      setStep("대시보드로 이동 중...");
      window.dispatchEvent(new Event("gitroast-auth-change"));
      window.location.href = "/dashboard";
    } catch (err: any) {
      setError(err.message || "데모 로그인에 실패했습니다.");
      setStep(null);
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
      setCurrentUser(null);
      window.dispatchEvent(new Event("gitroast-auth-change"));
    } finally {
      setLoggingOut(false);
    }
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

        {checkingSession ? (
          <FormSkeleton />
        ) : currentUser ? (
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
                disabled={loggingOut}
                aria-busy={loggingOut}
                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed text-slate-300 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                {loggingOut ? (
                  <>
                    <Spinner className="w-3.5 h-3.5" /> 로그아웃 중...
                  </>
                ) : (
                  "다른 계정으로 로그인 (로그아웃)"
                )}
              </button>
            </div>
          </div>
        ) : (
          <>
            {notice && (
              <div
                className={`mb-4 p-3 rounded-xl text-xs flex items-center gap-2 ${
                  notice.tone === "ok"
                    ? "bg-emerald-950/40 border border-emerald-800/60 text-emerald-300"
                    : "bg-amber-950/40 border border-amber-800/60 text-amber-300"
                }`}
              >
                <MailCheck className="w-4 h-4 shrink-0" />
                <span>{notice.text}</span>
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {needsVerification && (
              <div className="mb-4 p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-400 space-y-2">
                <p>메일을 못 받으셨나요? 스팸함도 확인해 보세요.</p>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending}
                  aria-busy={resending}
                  className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed text-slate-200 font-semibold transition-colors flex items-center justify-center gap-1.5"
                >
                  {resending ? (
                    <>
                      <Spinner className="w-3.5 h-3.5" /> 보내는 중...
                    </>
                  ) : (
                    "확인 메일 다시 보내기"
                  )}
                </button>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs xl:text-sm font-bold text-slate-400 mb-1 xl:mb-1.5">
                  이메일 주소
                </label>
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
                  비밀번호
                </label>
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

              <CaptchaWidget onToken={setCaptchaToken} resetKey={captchaKey} />

              <button
                type="submit"
                disabled={loading}
                aria-busy={loading}
                className="w-full py-3 xl:py-3.5 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 hover:brightness-110 text-white font-bold text-sm xl:text-base shadow-lg shadow-orange-500/25 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Spinner />
                    <span className="truncate">{step ?? "로그인 중..."}</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" /> 로그인
                  </>
                )}
              </button>
              <p role="status" aria-live="polite" className="sr-only">
                {loading ? step : ""}
              </p>
            </form>

            {/* Quick Demo Login button */}
            <div className="mt-4 pt-4 border-t border-slate-800/80 text-center">
              <button
                type="button"
                onClick={handleQuickDemoLogin}
                disabled={loading}
                aria-busy={loading}
                className="w-full py-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed text-slate-300 font-semibold text-xs border border-slate-700 transition-all flex items-center justify-center gap-1.5"
              >
                {loading ? (
                  <>
                    <Spinner className="w-3.5 h-3.5" /> 잠시만요...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    데모 계정으로 1초 로그인 (테스트용)
                  </>
                )}
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
