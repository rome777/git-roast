import React from "react";
import { TierLevel } from "@/lib/ai/types";
import { cn } from "@/lib/utils";

interface TierBadgeProps {
  tier: TierLevel;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const TIER_CONFIG: Record<
  TierLevel,
  { label: string; bg: string; text: string; border: string; glow: string }
> = {
  SSS: {
    label: "신계 (SSS)",
    bg: "bg-gradient-to-r from-amber-500 via-yellow-300 to-amber-600",
    text: "text-amber-950",
    border: "border-yellow-200",
    glow: "shadow-[0_0_25px_rgba(251,191,36,0.6)]",
  },
  SS: {
    label: "고수 (SS)",
    bg: "bg-gradient-to-r from-purple-600 to-pink-500",
    text: "text-white",
    border: "border-purple-300",
    glow: "shadow-[0_0_20px_rgba(168,85,247,0.5)]",
  },
  S: {
    label: "장인 (S)",
    bg: "bg-gradient-to-r from-indigo-500 to-cyan-400",
    text: "text-white",
    border: "border-cyan-300",
    glow: "shadow-[0_0_18px_rgba(56,189,248,0.5)]",
  },
  A: {
    label: "숙련 (A)",
    bg: "bg-gradient-to-r from-emerald-600 to-teal-400",
    text: "text-white",
    border: "border-emerald-300",
    glow: "shadow-[0_0_15px_rgba(52,211,153,0.4)]",
  },
  B: {
    label: "평민 (B)",
    bg: "bg-gradient-to-r from-blue-600 to-sky-400",
    text: "text-white",
    border: "border-blue-300",
    glow: "shadow-[0_0_12px_rgba(96,165,250,0.3)]",
  },
  C: {
    label: "초보 (C)",
    bg: "bg-gradient-to-r from-orange-500 to-amber-400",
    text: "text-white",
    border: "border-orange-300",
    glow: "shadow-[0_0_10px_rgba(251,146,60,0.3)]",
  },
  D: {
    label: "방치 (D)",
    bg: "bg-gradient-to-r from-red-600 to-rose-400",
    text: "text-white",
    border: "border-red-300",
    glow: "shadow-[0_0_10px_rgba(244,63,94,0.3)]",
  },
  F: {
    label: "멸망 (F)",
    bg: "bg-gradient-to-r from-zinc-700 to-neutral-900",
    text: "text-red-400",
    border: "border-red-800",
    glow: "shadow-[0_0_10px_rgba(239,68,68,0.4)]",
  },
};

export function TierBadge({ tier, className, size = "md" }: TierBadgeProps) {
  const config = TIER_CONFIG[tier] || TIER_CONFIG.B;

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs font-bold",
    md: "px-3.5 py-1.5 text-sm font-extrabold tracking-wide",
    lg: "px-5 py-2 text-xl font-black tracking-wider",
  }[size];

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full border shadow-sm transition-all duration-300 select-none",
        config.bg,
        config.text,
        config.border,
        config.glow,
        sizeClasses,
        className
      )}
    >
      {tier} • {config.label}
    </span>
  );
}
