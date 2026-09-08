"use client";

import { Loader2 } from "lucide-react";

/**
 * 비동기 작업 중임을 알리는 공용 표시.
 *
 * 규칙: **네트워크를 타는 동작에는 예외 없이 이 표시가 붙는다.**
 * 눌렀는데 아무 반응이 없으면 사용자는 안 눌렸다고 판단하고 다시 누른다.
 * 그 두 번째 클릭이 중복 가입·중복 삭제가 된다.
 *
 * `label` 을 주면 스크린 리더가 읽을 수 있게 텍스트를 함께 넣는다.
 */
export function Spinner({
  className = "w-4 h-4",
  label,
}: {
  className?: string;
  label?: string;
}) {
  return (
    <>
      <Loader2 className={`${className} animate-spin shrink-0`} aria-hidden="true" />
      {label ? <span className="sr-only">{label}</span> : null}
    </>
  );
}

/**
 * 화면 전체를 채우는 로딩 안내. 첫 진입에서 데이터를 기다리는 동안 쓴다.
 * 빈 화면을 보여 주면 사용자는 "고장났다" 로 읽는다.
 */
export function LoadingScreen({ message }: { message: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex-1 flex flex-col items-center justify-center gap-3 py-20 text-slate-400"
    >
      <Loader2 className="w-6 h-6 animate-spin text-orange-500" aria-hidden="true" />
      <span className="text-sm animate-pulse">{message}</span>
    </div>
  );
}

/**
 * 폼이 뜨기 전 자리를 잡아 두는 뼈대.
 *
 * 로그인 여부를 서버에 물어보는 동안 폼을 먼저 그리면, 답이 온 뒤 화면이
 * 통째로 바뀌면서 깜빡인다. 이미 로그인한 사람에게는 있지도 않은 가입 폼이
 * 한 번 스쳐 지나간다.
 */
export function FormSkeleton() {
  return (
    <div role="status" aria-live="polite" className="space-y-4 animate-pulse">
      <span className="sr-only">로그인 상태를 확인하는 중입니다</span>
      <div className="h-3 w-20 rounded bg-slate-800" />
      <div className="h-11 rounded-xl bg-slate-800/70" />
      <div className="h-3 w-20 rounded bg-slate-800" />
      <div className="h-11 rounded-xl bg-slate-800/70" />
      <div className="h-12 rounded-xl bg-slate-800/50" />
    </div>
  );
}
