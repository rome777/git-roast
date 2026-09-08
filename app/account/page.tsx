"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { UserCircle } from "lucide-react";
import { LoadingScreen } from "@/components/ui/Spinner";
import { DeleteAccountSection } from "@/components/auth/DeleteAccountSection";

export default function AccountPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [evaluationCount, setEvaluationCount] = useState(0);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 계정 정보와 삭제 시 사라질 건수 모두 서버 세션 기준으로만 판정한다.
    const load = async () => {
      try {
        const res = await fetch("/api/history");

        if (res.status === 401) {
          setNeedsLogin(true);
          return;
        }

        if (res.ok) {
          const json = await res.json();
          if (json.email) setEmail(json.email);
          setEvaluationCount(Array.isArray(json.evaluations) ? json.evaluations.length : 0);
        }
      } catch (err) {
        console.warn("계정 정보 조회 실패:", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  if (loading) {
    return <LoadingScreen message="계정 정보 불러오는 중..." />;
  }

  if (needsLogin || !email) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-20 text-center">
        <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400 mb-4">
          <UserCircle className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-black text-white mb-2">로그인이 필요합니다</h1>
        <p className="text-xs xl:text-sm text-slate-400 mb-6 max-w-sm">
          계정 설정은 로그인한 사용자만 볼 수 있습니다.
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
    <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 xl:py-14">
      <div className="border-b border-slate-800 pb-6 mb-8">
        <div className="flex items-center gap-2 text-xs xl:text-sm font-bold text-orange-400 uppercase tracking-wider mb-1">
          <UserCircle className="w-4 h-4" /> 계정 설정
        </div>
        <h1 className="text-2xl sm:text-3xl xl:text-4xl font-black text-white">{email}</h1>
        <p className="text-xs xl:text-sm text-slate-400 mt-1">
          로그인 계정 정보와 회원 탈퇴를 이 페이지에서 관리합니다.
        </p>
      </div>

      <DeleteAccountSection email={email} evaluationCount={evaluationCount} />
    </div>
  );
}
