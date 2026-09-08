"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Flame,
  UserPlus,
  Mail,
  Lock,
  AlertCircle,
  ShieldCheck,
  UserCheck,
  ArrowRight,
  MailCheck,
  Check,
} from "lucide-react";
import { CaptchaWidget, isCaptchaEnabled } from "@/components/auth/CaptchaWidget";
import { Spinner, FormSkeleton } from "@/components/ui/Spinner";
import { validateNewPassword, PASSWORD_RULES } from "@/lib/auth/password-rules";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ email: string } | null>(null);
  /** 서버에 로그인 여부를 묻는 동안 폼을 그리지 않는다(깜빡임 방지). */
  const [checkingSession, setCheckingSession] = useState(true);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);

  /** 확인 메일을 보낸 뒤의 화면. null 이면 아직 폼 단계다. */
  const [pending, setPending] = useState<{ email: string; message: string } | null>(null);
  const [resendNote, setResendNote] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  /**
   * 가입 버튼에 지금 무엇을 하고 있는지 적는다.
   *
   * 가입 한 번에 CAPTCHA 검증 → 유출 목록 조회 → 계정 생성 → 메일 발송까지
   * 외부 호출이 네 번 붙어 수 초가 걸린다. "처리 중" 한 마디로 뭉뚱그리면
   * 멈춘 것처럼 보인다.
   */
  const [step, setStep] = useState<string | null>(null);

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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 서버와 같은 규칙 함수를 쓴다. 문구가 갈리지 않도록.
    const pwError = validateNewPassword(password, email);
    if (pwError) {
      setError(pwError);
      return;
    }

    if (password !== passwordConfirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    if (isCaptchaEnabled() && !captchaToken) {
      setError("자동 가입 방지 확인을 먼저 완료해 주세요.");
      return;
    }

    setLoading(true);

    // 서버가 실제로 밟는 순서대로 문구를 넘긴다(captcha → 유출 검사 → 계정 생성 → 메일).
    // 마지막 단계에서 멈춰 두고 되돌아가지 않는다 — 계속 돌면 가짜 진행률처럼 보인다.
    const steps = [
      isCaptchaEnabled() ? "자동 가입 방지 확인 중..." : "입력값 확인 중...",
      "비밀번호가 유출된 적 있는지 대조 중...",
      "계정 만드는 중...",
      "확인 메일 보내는 중...",
    ];
    setStep(steps[0]);
    let navigating = false;
    let stepIdx = 0;
    const stepTimer = setInterval(() => {
      stepIdx = Math.min(stepIdx + 1, steps.length - 1);
      setStep(steps[stepIdx]);
    }, 900);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, captchaToken }),
      });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "회원가입에 실패했습니다.");
      }

      if (json?.verificationRequired) {
        // 확인 전에는 세션이 없다. 대시보드로 보내면 로그인 안내만 보게 된다.
        setPending({ email: json.email, message: json.message });
        return;
      }

      // 이동이 끝날 때까지 버튼을 되돌리지 않는다. 여기서 loading 을 끄면
      // 페이지가 넘어가기 전 한순간 "무료 회원가입" 으로 돌아가 다시 눌린다.
      navigating = true;
      setStep("대시보드로 이동 중...");
      window.dispatchEvent(new Event("gitroast-auth-change"));
      window.location.href = "/dashboard";
      return;
    } catch (err: any) {
      setError(err.message || "회원가입 처리 중 오류가 발생했습니다.");
      // 토큰은 1회용이다. 실패했으면 위젯을 새로 그려야 다시 시도할 수 있다.
      setCaptchaToken(null);
      setCaptchaKey((k) => k + 1);
    } finally {
      clearInterval(stepTimer);
      // 다른 페이지로 넘어가는 중이면 버튼을 되돌리지 않는다.
      if (!navigating) {
        setStep(null);
        setLoading(false);
      }
    }
  };

  const handleResend = async () => {
    if (!pending || resending) return;
    setResendNote(null);
    setResending(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pending.email }),
      });
      const json = await res.json();
      setResendNote(json?.message || json?.error || "재발송 요청을 보냈습니다.");
    } catch {
      setResendNote("재발송에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setResending(false);
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
            무료 회원가입 후 깃허브 무제한 팩폭 &amp; 진단 카드를 발급받으세요.
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
        ) : pending ? (
          <div className="p-6 rounded-2xl bg-slate-950/80 border border-slate-800 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-orange-500/10 border border-orange-500/30 flex items-center justify-center mx-auto text-orange-400">
              <MailCheck className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-white">이메일을 확인해 주세요</p>
              <p className="text-sm font-bold text-orange-300">{pending.email}</p>
              <p className="text-xs text-slate-400 leading-relaxed pt-1">{pending.message}</p>
              <p className="text-xs text-slate-500 pt-1">링크는 24시간 동안 유효합니다.</p>
            </div>
            {resendNote && (
              <p className="text-xs text-emerald-300 bg-emerald-950/40 border border-emerald-800/60 rounded-xl p-2.5">
                {resendNote}
              </p>
            )}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                aria-busy={resending}
                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed text-slate-300 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                {resending ? (
                  <>
                    <Spinner className="w-3.5 h-3.5" /> 보내는 중...
                  </>
                ) : (
                  "확인 메일 다시 보내기"
                )}
              </button>
              <Link
                href="/login"
                className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
              >
                확인했어요 — 로그인하기 <ArrowRight className="w-4 h-4" />
              </Link>
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

            <form onSubmit={handleSignup} className="space-y-4">
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
                    placeholder="영문 + 숫자 + 특수문자"
                    required
                    className="w-full pl-10 xl:pl-11 pr-4 py-2.5 xl:py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-sm xl:text-base focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all"
                  />
                </div>
                <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                  {PASSWORD_RULES.map((rule) => (
                    <li key={rule} className="flex items-center gap-1 text-[11px] text-slate-500">
                      <Check className="w-3 h-3 text-slate-600" />
                      {rule}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <label className="block text-xs xl:text-sm font-bold text-slate-400 mb-1 xl:mb-1.5">
                  비밀번호 확인
                </label>
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
                    <span className="truncate">{step ?? "처리 중..."}</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" /> 무료 회원가입
                  </>
                )}
              </button>
              {/* 화면을 못 보는 사용자에게도 진행 상황이 전달되어야 한다. */}
              <p role="status" aria-live="polite" className="sr-only">
                {loading ? step : ""}
              </p>
            </form>

            <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-600 mt-4 text-center">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-emerald-500/70" />
              비밀번호는 알려진 유출 목록과 대조합니다 (원문은 전송하지 않습니다).
            </p>

            <p className="text-center text-xs text-slate-500 mt-4">
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
