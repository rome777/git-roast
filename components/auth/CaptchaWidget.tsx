"use client";

import { useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/ui/Spinner";

/**
 * Cloudflare Turnstile 위젯.
 *
 * 사이트 키가 없으면 **아무것도 렌더링하지 않고** onToken 도 부르지 않는다.
 * 서버도 같은 조건에서 검사를 건너뛰므로(lib/auth/captcha.ts) 키가 없는 배포에서는
 * 폼이 그대로 동작한다.
 *
 * ⚠️ NEXT_PUBLIC_TURNSTILE_SITE_KEY 는 **빌드 시점에 값이 박힌다.**
 * 대시보드에 나중에 넣어도 재배포 전에는 위젯이 뜨지 않는다.
 */

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
  }
}

export function isCaptchaEnabled(): boolean {
  return Boolean(SITE_KEY);
}

/** 스크립트는 페이지당 한 번만 넣는다(로그인·가입을 오가도 중복 로드하지 않게). */
function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();

  const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
  if (existing) {
    return new Promise((resolve) => existing.addEventListener("load", () => resolve(), { once: true }));
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Turnstile 스크립트를 불러오지 못했습니다."));
    document.head.appendChild(script);
  });
}

export interface CaptchaWidgetHandle {
  reset: () => void;
}

export function CaptchaWidget({
  onToken,
  resetKey = 0,
}: {
  onToken: (token: string | null) => void;
  /** 값이 바뀌면 위젯을 다시 그린다. 토큰은 1회용이라 실패 후 재시도에 필요하다. */
  resetKey?: number;
}) {
  const holderRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [failed, setFailed] = useState(false);
  /** Cloudflare 스크립트를 받아오는 동안 자리를 비워 두지 않는다. */
  const [loadingWidget, setLoadingWidget] = useState(true);

  useEffect(() => {
    if (!SITE_KEY || !holderRef.current) return;

    let cancelled = false;
    const holder = holderRef.current;
    setLoadingWidget(true);

    loadScript()
      .then(() => {
        if (cancelled || !window.turnstile) return;
        holder.innerHTML = "";
        widgetIdRef.current = window.turnstile.render(holder, {
          sitekey: SITE_KEY,
          theme: "dark",
          language: "ko",
          callback: (token: string) => onToken(token),
          "expired-callback": () => onToken(null),
          "error-callback": () => onToken(null),
        });
        setLoadingWidget(false);
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
          setLoadingWidget(false);
        }
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // 이미 제거됐을 수 있다. 화면 정리 실패는 무시한다.
        }
      }
      widgetIdRef.current = null;
    };
    // resetKey 가 바뀌면 위젯을 통째로 다시 그린다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  if (!SITE_KEY) return null;

  return (
    <div>
      {loadingWidget && !failed && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-center gap-1.5 h-[65px] text-[11px] text-slate-500"
        >
          <Spinner className="w-3.5 h-3.5" /> 자동 가입 방지 확인을 불러오는 중...
        </div>
      )}
      <div ref={holderRef} className="flex justify-center" />
      {failed && (
        <p className="mt-2 text-center text-xs text-amber-400">
          자동 가입 방지 위젯을 불러오지 못했습니다. 광고 차단 확장을 끄고 새로고침해 주세요.
        </p>
      )}
    </div>
  );
}
