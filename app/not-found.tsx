import React from "react";
import Link from "next/link";
import { Flame, Home, History } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-20 xl:py-32 text-center">
      <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400 mb-5">
        <Flame className="w-7 h-7" />
      </div>

      <p className="text-5xl xl:text-6xl font-black text-slate-700 mb-2 tabular-nums">404</p>
      <h1 className="text-xl xl:text-2xl font-black text-white mb-2">페이지를 찾을 수 없습니다</h1>
      <p className="text-xs xl:text-sm text-slate-400 mb-8 max-w-sm">
        주소가 바뀌었거나 삭제된 페이지입니다. 아래에서 이어서 이용해 주세요.
      </p>

      <div className="flex items-center gap-2 flex-wrap justify-center">
        <Link
          href="/"
          className="flex items-center gap-1.5 px-4 py-2 xl:px-5 xl:py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs xl:text-sm transition-colors"
        >
          <Home className="w-4 h-4" /> 새 분석하러 가기
        </Link>
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 px-4 py-2 xl:px-5 xl:py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs xl:text-sm transition-colors"
        >
          <History className="w-4 h-4" /> 내 보관함
        </Link>
      </div>
    </div>
  );
}
