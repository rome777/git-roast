"use client";

import React, { useState } from "react";
import { Check, KeyRound, X } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { PASSWORD_RULES, validateNewPassword } from "@/lib/auth/password-rules";

/**
 * 비밀번호 변경.
 *
 * 규칙은 lib/auth/password-rules.ts 하나만 본다(가입 폼과 같은 함수).
 * 확인란을 따로 두는 이유: 새 비밀번호는 화면에 보이지 않으므로 오타가 나면
 * 사용자는 다음 로그인에서야 알게 되고, 그때는 무엇을 잘못 쳤는지 모른다.
 */
export function PasswordChangeSection({ email }: { email: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const ruleError = next ? validateNewPassword(next, email) : null;
  const mismatch = Boolean(confirm) && next !== confirm;
  const canSubmit =
    Boolean(current) && Boolean(next) && !ruleError && Boolean(confirm) && !mismatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || !canSubmit) return;

    setError(null);
    setDone(false);
    setSaving(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "비밀번호를 변경하지 못했습니다.");

      // 입력을 비워 둔다. 화면에 새 비밀번호를 남겨 둘 이유가 없다.
      setCurrent("");
      setNext("");
      setConfirm("");
      setDone(true);
    } catch (err: any) {
      setError(err.message || "비밀번호 변경 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/60 transition-all";

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-200">
          <KeyRound className="w-4 h-4 text-orange-400" /> 비밀번호 변경
        </h2>
        <p className="text-[11px] xl:text-xs text-slate-500 mt-1">
          본인 확인을 위해 현재 비밀번호를 함께 입력해 주세요.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
          <X className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {done && (
        <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-800/50 text-emerald-300 text-xs flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>비밀번호를 변경했습니다. 다음 로그인부터 새 비밀번호를 쓰세요.</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-[11px] font-bold text-slate-400 mb-1">현재 비밀번호</label>
          <input
            type="password"
            value={current}
            onChange={(e) => {
              setCurrent(e.target.value);
              setError(null);
              setDone(false);
            }}
            autoComplete="current-password"
            placeholder="••••••••"
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-400 mb-1">새 비밀번호</label>
          <input
            type="password"
            value={next}
            onChange={(e) => {
              setNext(e.target.value);
              setError(null);
              setDone(false);
            }}
            autoComplete="new-password"
            placeholder="••••••••"
            className={inputClass}
          />
          <p className="text-[11px] text-slate-600 mt-1.5">{PASSWORD_RULES.join(" · ")}</p>
          {ruleError && <p className="text-[11px] text-amber-400 mt-1">{ruleError}</p>}
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-400 mb-1">
            새 비밀번호 확인
          </label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value);
              setError(null);
              setDone(false);
            }}
            autoComplete="new-password"
            placeholder="••••••••"
            className={inputClass}
          />
          {mismatch && (
            <p className="text-[11px] text-amber-400 mt-1">새 비밀번호가 서로 다릅니다.</p>
          )}
        </div>

        <button
          type="submit"
          disabled={!canSubmit || saving}
          aria-busy={saving}
          className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
        >
          {saving ? (
            <>
              <Spinner className="w-3.5 h-3.5" /> 변경 중...
            </>
          ) : (
            <>
              <KeyRound className="w-3.5 h-3.5" /> 비밀번호 변경
            </>
          )}
        </button>
        <p role="status" aria-live="polite" className="sr-only">
          {saving ? "비밀번호를 변경하는 중입니다" : ""}
        </p>
      </form>
    </section>
  );
}
