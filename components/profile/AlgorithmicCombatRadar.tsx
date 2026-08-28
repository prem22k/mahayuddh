"use client";

import React, { useState } from "react";
import { MasteryRadarPoint } from "@/lib/stats";

interface AlgorithmicCombatRadarProps {
  points: MasteryRadarPoint[];
  size?: number;
}

export function AlgorithmicCombatRadar({ points, size = 280 }: AlgorithmicCombatRadarProps) {
  const [hoveredPoint, setHoveredPoint] = useState<MasteryRadarPoint | null>(null);

  const center = size / 2;
  const radius = size * 0.36;
  const numPoints = points.length || 6;
  const angleStep = (Math.PI * 2) / numPoints;

  // Grid levels (25%, 50%, 75%, 100%)
  const gridLevels = [0.25, 0.5, 0.75, 1.0];

  const getCoordinates = (index: number, valPercent: number) => {
    // Start from top (- PI / 2)
    const angle = index * angleStep - Math.PI / 2;
    const r = radius * (Math.max(valPercent, 5) / 100);
    const x = center + r * Math.cos(angle);
    const y = center + r * Math.sin(angle);
    return { x, y };
  };

  const getLabelCoordinates = (index: number) => {
    const angle = index * angleStep - Math.PI / 2;
    const r = radius + 26;
    const x = center + r * Math.cos(angle);
    const y = center + r * Math.sin(angle);
    return { x, y };
  };

  // Polygon path for current mastery points
  const polygonPoints = points
    .map((p, idx) => {
      const { x, y } = getCoordinates(idx, p.value);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="flex flex-col items-center justify-center relative select-none">
      <svg
        width={size}
        height={size}
        className="overflow-visible"
        viewBox={`0 0 ${size} ${size}`}
      >
        <defs>
          <radialGradient id="radarFill" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fa586a" stopOpacity="0.4" />
            <stop offset="60%" stopColor="#fa586a" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#ff2a6d" stopOpacity="0.0" />
          </radialGradient>
          <linearGradient id="radarStroke" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fa586a" />
            <stop offset="50%" stopColor="#bf5af2" />
            <stop offset="100%" stopColor="#64d2ff" />
          </linearGradient>
          <filter id="radarGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Concentric Web Grid Polygons */}
        {gridLevels.map((lvl) => {
          const polyCoords = Array.from({ length: numPoints })
            .map((_, idx) => {
              const angle = idx * angleStep - Math.PI / 2;
              const r = radius * lvl;
              const x = center + r * Math.cos(angle);
              const y = center + r * Math.sin(angle);
              return `${x},${y}`;
            })
            .join(" ");

          return (
            <polygon
              key={lvl}
              points={polyCoords}
              fill="none"
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth="1"
              strokeDasharray={lvl < 1 ? "3 3" : undefined}
            />
          );
        })}

        {/* Axis Spokes from Center */}
        {points.map((_, idx) => {
          const { x, y } = getCoordinates(idx, 100);
          return (
            <line
              key={idx}
              x1={center}
              y1={center}
              x2={x}
              y2={y}
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth="1"
            />
          );
        })}

        {/* Dynamic Mastery Filled Area */}
        <polygon
          points={polygonPoints}
          fill="url(#radarFill)"
          stroke="url(#radarStroke)"
          strokeWidth="2"
          filter="url(#radarGlow)"
          className="transition-all duration-700 ease-out"
        />

        {/* Vertex Nodes */}
        {points.map((p, idx) => {
          const { x, y } = getCoordinates(idx, p.value);
          const isHovered = hoveredPoint?.axis === p.axis;

          return (
            <g
              key={p.axis}
              className="cursor-pointer group"
              onMouseEnter={() => setHoveredPoint(p)}
              onMouseLeave={() => setHoveredPoint(null)}
            >
              <circle
                cx={x}
                y={y}
                r={isHovered ? 6 : 4}
                fill={isHovered ? "#ffffff" : "#fa586a"}
                stroke="#1c1c1e"
                strokeWidth="2"
                className="transition-all duration-300"
              />
              <circle
                cx={x}
                y={y}
                r={isHovered ? 12 : 6}
                fill="#fa586a"
                opacity={isHovered ? 0.4 : 0.15}
                className="transition-all duration-300 animate-pulse"
              />
            </g>
          );
        })}

        {/* Outer Axis Labels */}
        {points.map((p, idx) => {
          const { x, y } = getLabelCoordinates(idx);
          const isHovered = hoveredPoint?.axis === p.axis;

          return (
            <text
              key={`label-${p.axis}`}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              className={`text-[10px] font-bold tracking-tight transition-colors cursor-pointer ${
                isHovered ? "fill-[#fa586a]" : "fill-white/60"
              }`}
              onMouseEnter={() => setHoveredPoint(p)}
              onMouseLeave={() => setHoveredPoint(null)}
            >
              {p.label}
            </text>
          );
        })}
      </svg>

      {/* Interactive Tooltip Card / Center Inspection */}
      <div className="h-9 flex items-center justify-center mt-1">
        {hoveredPoint ? (
          <div className="px-3 py-1 rounded-full bg-white/[0.08] border border-[#fa586a]/30 backdrop-blur-md flex items-center gap-2 text-xs animate-in fade-in zoom-in-95">
            <span>{hoveredPoint.icon}</span>
            <span className="font-semibold text-white">{hoveredPoint.label}:</span>
            <span className="font-mono text-[#fa586a] font-bold">{hoveredPoint.value}%</span>
            <span className="text-white/40 text-[11px]">
              ({hoveredPoint.solved}/{hoveredPoint.total} solved)
            </span>
          </div>
        ) : (
          <span className="text-[11px] text-white/35 font-medium">
            Hover vertices to inspect algorithmic domain mastery
          </span>
        )}
      </div>
    </div>
  );
}
