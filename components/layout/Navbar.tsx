"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flame, History, LogIn, LogOut, User, Github, Shield } from "lucide-react";

export function Navbar() {
  const pathname = usePathname();
  const [user, setUser] = useState<{ email: string; role?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    // 로그인 상태는 서버 세션(/api/auth/me) 하나만 신뢰한다.
    // role 도 서버가 DB 에서 읽어 준 값을 그대로 쓴다 — 이메일로 추정하지 않는다.
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const json = await res.json();
        if (json?.user?.email) {
          setUser({ email: json.user.email, role: json.user.role });
          setLoading(false);
          return;
        }
      }
    } catch {}

    setUser(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    checkAuth();

    const handleAuthChange = () => {
      checkAuth();
    };

    window.addEventListener("storage", handleAuthChange);
    window.addEventListener("gitroast-auth-change", handleAuthChange);

    return () => {
      window.removeEventListener("storage", handleAuthChange);
      window.removeEventListener("gitroast-auth-change", handleAuthChange);
    };
  }, [pathname, checkAuth]);

  const handleLogout = async () => {
    // httpOnly 세션 쿠키는 클라이언트에서 못 지운다. 서버에 만료를 요청한다.
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});

    setUser(null);
    window.dispatchEvent(new Event("gitroast-auth-change"));
    window.location.href = "/";
  };

  const isAdminUser = user?.role === "admin";

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-orange-500 to-pink-500 flex items-center justify-center shadow-lg shadow-orange-500/25 group-hover:scale-105 transition-transform">
            <Flame className="w-5 h-5 text-white" />
          </div>
          <span className="font-black text-xl tracking-tight text-white">
            GIT<span className="text-orange-500">ROAST</span>
          </span>
        </Link>

        {/* Navigation items */}
        <div className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/dashboard"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
              pathname === "/dashboard"
                ? "bg-slate-800 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <History className="w-4 h-4" />
            <span className="hidden sm:inline">내 히스토리</span>
          </Link>

          {/* Admin Console Link (Shown if user is admin) */}
          {isAdminUser && (
            <Link
              href="/admin"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                pathname === "/admin"
                  ? "bg-amber-500/25 text-amber-300 border border-amber-500/50 shadow-sm"
                  : "bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30"
              }`}
            >
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <span>관리자 콘솔</span>
            </Link>
          )}

          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="text-slate-400 hover:text-slate-200 p-2 rounded-lg transition-colors hidden sm:block"
          >
            <Github className="w-5 h-5" />
          </a>

          <div className="h-4 w-px bg-slate-800 mx-1 hidden sm:block" />

          {/* User Profile / Auth Action */}
          {!loading && (
            <>
              {user ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 border border-slate-700/80 text-xs text-slate-200 font-medium shadow-sm">
                    <User className="w-3.5 h-3.5 text-orange-400" />
                    <span className="max-w-[130px] truncate font-semibold">
                      {user.email.split("@")[0]}
                    </span>
                    {isAdminUser && (
                      <span className="text-[10px] font-bold text-amber-400 bg-amber-500/20 px-1.5 py-0.2 rounded border border-amber-500/30">
                        ADMIN
                      </span>
                    )}
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
                  </div>
                  <button
                    onClick={handleLogout}
                    title="로그아웃"
                    className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/20 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    href="/login"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>로그인</span>
                  </Link>
                  <Link
                    href="/signup"
                    className="px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-md shadow-orange-500/20 hover:brightness-110 transition-all"
                  >
                    시작하기
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
