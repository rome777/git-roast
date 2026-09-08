"use client";

import React, { useState } from "react";
import { Check, Sparkles, UserRound, X } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import {
  MAX_NICKNAME_LENGTH,
  NICKNAME_RULES,
  validateNickname,
} from "@/lib/auth/nickname-rules";

/**
 * 닉네임 설정.
 *
 * 규칙은 lib/auth/nickname-rules.ts 하나만 본다 — 서버와 같은 함수로 미리 검사해
 * 400 을 왕복하지 않고 바로 알려 준다. 저장은 서버가 다시 검사한다.
 */
export function NicknameSection({
  nickname,
  onSaved,
}: {
  nickname: string;
  onSaved: (nickname: string) => void;
}) {
  const [value, setValue] = useState(nickname);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const changed = value.trim() !== nickname.trim();
  const localError = changed ? validateNickname(value) : null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || !changed) return;

    const invalid = validateNickname(value);
    if (invalid) {
      setError(invalid);
      return;
    }

    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const res = await fetch("/api/auth/nickname", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: value }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "닉네임을 저장하지 못했습니다.");

      // 서버가 정규화한 값을 그대로 화면의 기준으로 삼는다.
      setValue(json.nickname);
      setSaved(true);
      onSaved(json.nickname);
    } catch (err: any) {
      setError(err.message || "닉네임 변경 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-200">
          <UserRound className="w-4 h-4 text-orange-400" /> 닉네임
        </h2>
        <p className="text-[11px] xl:text-xs text-slate-500 mt-1">
          화면에 표시되는 이름입니다. 가입할 때 임의로 정해 드렸으니 원하는 이름으로 바꿔 주세요.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
          <X className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {saved && (
        <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-800/50 text-emerald-300 text-xs flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>닉네임을 저장했습니다.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-3">
        <div>
          <input
            type="text"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
              setSaved(false);
            }}
            maxLength={MAX_NICKNAME_LENGTH}
            autoComplete="nickname"
            placeholder="닉네임"
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/60 transition-all"
          />
          <div className="flex items-center justify-between gap-2 mt-1.5">
            <p className="text-[11px] text-slate-600">{NICKNAME_RULES.join(" · ")}</p>
            <span className="text-[11px] text-slate-600 shrink-0">
              {value.trim().length}/{MAX_NICKNAME_LENGTH}
            </span>
          </div>
          {localError && <p className="text-[11px] text-amber-400 mt-1">{localError}</p>}
        </div>

        <button
          type="submit"
          disabled={!changed || Boolean(localError) || saving}
          aria-busy={saving}
          className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
        >
          {saving ? (
            <>
              <Spinner className="w-3.5 h-3.5" /> 저장 중...
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" /> 닉네임 저장
            </>
          )}
        </button>
        <p role="status" aria-live="polite" className="sr-only">
          {saving ? "닉네임을 저장하는 중입니다" : ""}
        </p>
      </form>
    </section>
  );
}
