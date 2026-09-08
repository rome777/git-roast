import React from "react";
import { RadarScores } from "@/lib/ai/types";

interface RadarChartProps {
  scores: RadarScores;
  customLabels?: Record<string, string>;
  size?: number;
  className?: string;
}

export function RadarChart({ scores, customLabels, size = 260, className = "" }: RadarChartProps) {
  const metrics = [
    {
      key: "commitActivity",
      label: customLabels?.commitActivity || "커밋 활동",
      value: scores.commitActivity || 50,
    },
    {
      key: "documentation",
      label: customLabels?.documentation || "문서화",
      value: scores.documentation || 50,
    },
    {
      key: "stackDiversity",
      label: customLabels?.stackDiversity || "기술 다양성",
      value: scores.stackDiversity || 50,
    },
    {
      key: "codePopularity",
      label: customLabels?.codePopularity || "스타/인기",
      value: scores.codePopularity || 50,
    },
    {
      key: "consistency",
      label: customLabels?.consistency || "지속성",
      value: scores.consistency || 50,
    },
  ];

  const total = metrics.length;
  const center = size / 2;
  const radius = size * 0.38;

  // Function to calculate point coordinates
  const getCoordinates = (index: number, value: number) => {
    const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
    const r = (value / 100) * radius;
    const x = center + r * Math.cos(angle);
    const y = center + r * Math.sin(angle);
    return { x, y };
  };

  // Polygon points for data
  const pointsString = metrics
    .map((m, i) => {
      const { x, y } = getCoordinates(i, m.value);
      return `${x},${y}`;
    })
    .join(" ");

  // Background grid levels (20%, 40%, 60%, 80%, 100%)
  const levels = [0.2, 0.4, 0.6, 0.8, 1.0];

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <svg width={size} height={size} className="overflow-visible">
        {/* Background web polygons */}
        {levels.map((level, lvlIdx) => {
          const levelPoints = metrics
            .map((_, i) => {
              const angle = (Math.PI * 2 * i) / total - Math.PI / 2;
              const r = level * radius;
              return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
            })
            .join(" ");
          return (
            <polygon
              key={lvlIdx}
              points={levelPoints}
              fill={lvlIdx === levels.length - 1 ? "rgba(30, 41, 59, 0.4)" : "none"}
              stroke="rgba(148, 163, 184, 0.2)"
              strokeWidth="1"
            />
          );
        })}

        {/* Axis lines from center */}
        {metrics.map((_, i) => {
          const angle = (Math.PI * 2 * i) / total - Math.PI / 2;
          const x = center + radius * Math.cos(angle);
          const y = center + radius * Math.sin(angle);
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={x}
              y2={y}
              stroke="rgba(148, 163, 184, 0.25)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          );
        })}

        {/* Data polygon filled with neon gradient */}
        <defs>
          <linearGradient id="radarGlow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.6" />
            <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.6" />
          </linearGradient>
        </defs>

        <polygon
          points={pointsString}
          fill="url(#radarGlow)"
          stroke="#c084fc"
          strokeWidth="2.5"
          className="drop-shadow-[0_0_8px_rgba(192,132,252,0.8)]"
        />

        {/* Data points */}
        {metrics.map((m, i) => {
          const { x, y } = getCoordinates(i, m.value);
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="4"
              fill="#ffffff"
              stroke="#a855f7"
              strokeWidth="2"
            />
          );
        })}

        {/* Labels */}
        {metrics.map((m, i) => {
          const angle = (Math.PI * 2 * i) / total - Math.PI / 2;
          const labelRadius = radius + 22;
          const x = center + labelRadius * Math.cos(angle);
          const y = center + labelRadius * Math.sin(angle) + 4;
          return (
            <text
              key={i}
              x={x}
              y={y}
              textAnchor="middle"
              className="text-[11px] font-bold fill-slate-300"
            >
              {m.label} ({m.value})
            </text>
          );
        })}
      </svg>
    </div>
  );
}
