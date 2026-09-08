"use client";

import React, { useState } from "react";
import { AlertTriangle, UserMinus, X } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";

/**
 * 회원 탈퇴 영역.
 *
 * 되돌릴 수 없는 동작이라 **한 번에 지워지지 않게** 만든다.
 * 접기 → 펼치기 → 이메일 직접 입력 + 비밀번호 → 실행. 각 단계가 오클릭을 거른다.
 *
 * 무엇이 사라지는지 실행 전에 전부 적는다. "정말 삭제할까요?" 만 띄우고
 * 공유 링크가 죽는다는 사실을 안 알려 주면, 그건 동의를 받은 것이 아니다.
 */
export function DeleteAccountSection({
  email,
  evaluationCount,
}: {
  email: string;
  evaluationCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const canSubmit =
    confirmEmail.trim().toLowerCase() === email.trim().toLowerCase() && password.length > 0;

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (deleting || !canSubmit) return;

    setError(null);
    setDeleting(true);
    try {
      const res = await fetch("/api/auth/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmEmail }),
      });
      const json = await res.json();

      if (!res.ok) throw new Error(json?.error || "탈퇴에 실패했습니다.");

      // 성공하면 버튼을 되돌리지 않는다. 이동이 끝날 때까지 잠가 둔다.
      setDone(json?.message || "탈퇴가 완료되었습니다.");
      window.dispatchEvent(new Event("gitroast-auth-change"));
      setTimeout(() => {
        window.location.href = "/signup?left=1";
      }, 1600);
      return;
    } catch (err: any) {
      setError(err.message || "탈퇴 처리 중 오류가 발생했습니다.");
      setDeleting(false);
    }
  };

  if (done) {
    return (
      <div className="mt-10 p-5 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-2">
        <p className="text-sm font-bold text-slate-200">{done}</p>
        <p className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
          <Spinner className="w-3.5 h-3.5" /> 잠시 후 이동합니다...
        </p>
      </div>
    );
  }

  return (
    <div className="mt-10 rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 px-5 py-4 text-left hover:bg-slate-900/60 transition-colors"
      >
        <span className="flex items-center gap-2 text-xs xl:text-sm font-bold text-slate-400">
          <UserMinus className="w-4 h-4" /> 회원 탈퇴
        </span>
        <span className="text-[11px] text-slate-600">{open ? "닫기" : "열기"}</span>
      </button>

      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-slate-800/80 space-y-4">
          <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-900/50 space-y-2">
            <p className="flex items-center gap-1.5 text-xs font-bold text-rose-300">
              <AlertTriangle className="w-4 h-4 shrink-0" /> 되돌릴 수 없습니다
            </p>
            <ul className="text-[11px] xl:text-xs text-rose-200/80 space-y-1 list-disc list-inside leading-relaxed">
              <li>
                저장된 분석 기록 <strong className="text-rose-200">{evaluationCount}건</strong>이
                DB 에서 영구 삭제됩니다.
              </li>
              <li>
                <strong className="text-rose-200">이미 공유한 카드 링크도 함께 죽습니다.</strong>{" "}
                남에게 보낸 주소가 있다면 먼저 확인해 주세요.
              </li>
              <li>계정 정보(이메일·비밀번호)가 삭제됩니다.</li>
              <li className="text-emerald-300/80">
                같은 이메일 <strong>{email}</strong> 로 언제든 다시 가입할 수 있습니다. 다만 지워진
                기록은 돌아오지 않습니다.
              </li>
            </ul>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
              <X className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleDelete} className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                확인을 위해 <span className="text-slate-200">{email}</span> 을 입력하세요
              </label>
              <input
                type="email"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                autoComplete="off"
                placeholder={email}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/40 focus:border-rose-500/60 transition-all"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                현재 비밀번호
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/40 focus:border-rose-500/60 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={!canSubmit || deleting}
              aria-busy={deleting}
              className="w-full py-2.5 rounded-xl bg-rose-900/70 hover:bg-rose-800 border border-rose-800 text-rose-100 font-bold text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              {deleting ? (
                <>
                  <Spinner className="w-3.5 h-3.5" /> 탈퇴 처리 중...
                </>
              ) : (
                <>
                  <UserMinus className="w-3.5 h-3.5" /> 영구 탈퇴하기
                </>
              )}
            </button>
            <p role="status" aria-live="polite" className="sr-only">
              {deleting ? "탈퇴를 처리하는 중입니다" : ""}
            </p>
          </form>
        </div>
      )}
    </div>
  );
}
