"use client";

import React from "react";

interface TriForceEnergyRingsProps {
  easy: number;
  medium: number;
  hard: number;
  totalCatalog?: number;
  size?: number;
}

export function TriForceEnergyRings({
  easy,
  medium,
  hard,
  size = 200,
}: TriForceEnergyRingsProps) {
  const totalSolved = easy + medium + hard;
  const strokeWidth = 8;
  const gap = 5;

  // Outer ring: Easy (r = 80)
  // Middle ring: Medium (r = 67)
  // Inner ring: Hard (r = 54)
  const center = size / 2;
  const rEasy = size * 0.40;
  const rMedium = rEasy - strokeWidth - gap;
  const rHard = rMedium - strokeWidth - gap;

  const circEasy = 2 * Math.PI * rEasy;
  const circMedium = 2 * Math.PI * rMedium;
  const circHard = 2 * Math.PI * rHard;

  // Expected target maximums for standard high benchmark (e.g. 500 Easy, 800 Medium, 300 Hard)
  const pctEasy = Math.min(easy / 300, 1);
  const pctMed = Math.min(medium / 400, 1);
  const pctHard = Math.min(hard / 150, 1);

  const offsetEasy = circEasy * (1 - pctEasy);
  const offsetMed = circMedium * (1 - pctMed);
  const offsetHard = circHard * (1 - pctHard);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-6 select-none">
      {/* Concentric Gauge SVG */}
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <defs>
            <linearGradient id="easyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#30d158" />
              <stop offset="100%" stopColor="#64d2ff" />
            </linearGradient>
            <linearGradient id="medGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ff9f0a" />
              <stop offset="100%" stopColor="#ffd60a" />
            </linearGradient>
            <linearGradient id="hardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fa586a" />
              <stop offset="100%" stopColor="#ff2a6d" />
            </linearGradient>
          </defs>

          {/* Background Track Rings */}
          <circle
            cx={center}
            cy={center}
            r={rEasy}
            fill="none"
            stroke="rgba(48, 209, 88, 0.12)"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={center}
            cy={center}
            r={rMedium}
            fill="none"
            stroke="rgba(255, 159, 10, 0.12)"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={center}
            cy={center}
            r={rHard}
            fill="none"
            stroke="rgba(250, 88, 106, 0.12)"
            strokeWidth={strokeWidth}
          />

          {/* Foreground Active Rings */}
          <circle
            cx={center}
            cy={center}
            r={rEasy}
            fill="none"
            stroke="url(#easyGrad)"
            strokeWidth={strokeWidth}
            strokeDasharray={circEasy}
            strokeDashoffset={offsetEasy}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
          <circle
            cx={center}
            cy={center}
            r={rMedium}
            fill="none"
            stroke="url(#medGrad)"
            strokeWidth={strokeWidth}
            strokeDasharray={circMedium}
            strokeDashoffset={offsetMed}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out delay-100"
          />
          <circle
            cx={center}
            cy={center}
            r={rHard}
            fill="none"
            stroke="url(#hardGrad)"
            strokeWidth={strokeWidth}
            strokeDasharray={circHard}
            strokeDashoffset={offsetHard}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out delay-200"
          />
        </svg>

        {/* Center Solved Metrics */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl sm:text-3xl font-black text-white leading-none tracking-tight">
            {totalSolved}
          </span>
          <span className="text-[10px] uppercase font-bold tracking-widest text-white/40 mt-1">
            Solved
          </span>
        </div>
      </div>

      {/* Difficulty Breakdown Badges */}
      <div className="flex sm:flex-col gap-3">
        {/* Easy */}
        <div className="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-[#30d158]/20">
          <div className="w-2.5 h-2.5 rounded-full bg-[#30d158] shadow-[0_0_8px_#30d158]" />
          <div>
            <div className="text-[10px] text-white/40 font-semibold uppercase">Easy</div>
            <div className="text-sm font-bold text-white font-mono">{easy}</div>
          </div>
        </div>

        {/* Medium */}
        <div className="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-[#ff9f0a]/20">
          <div className="w-2.5 h-2.5 rounded-full bg-[#ff9f0a] shadow-[0_0_8px_#ff9f0a]" />
          <div>
            <div className="text-[10px] text-white/40 font-semibold uppercase">Medium</div>
            <div className="text-sm font-bold text-white font-mono">{medium}</div>
          </div>
        </div>

        {/* Hard */}
        <div className="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-[#fa586a]/20">
          <div className="w-2.5 h-2.5 rounded-full bg-[#fa586a] shadow-[0_0_8px_#fa586a]" />
          <div>
            <div className="text-[10px] text-white/40 font-semibold uppercase">Hard</div>
            <div className="text-sm font-bold text-white font-mono">{hard}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
