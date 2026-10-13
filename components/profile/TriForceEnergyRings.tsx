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
              <stop offset="0%" stopColor="#3DDC97" />
              <stop offset="100%" stopColor="#8B91F7" />
            </linearGradient>
            <linearGradient id="medGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F5B83D" />
              <stop offset="100%" stopColor="#FFC95E" />
            </linearGradient>
            <linearGradient id="hardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F5B83D" />
              <stop offset="100%" stopColor="#E0A32B" />
            </linearGradient>
          </defs>

          {/* Background Track Rings */}
          <circle
            cx={center}
            cy={center}
            r={rEasy}
            fill="none"
            stroke="rgba(61, 220, 151, 0.12)"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={center}
            cy={center}
            r={rMedium}
            fill="none"
            stroke="rgba(245, 184, 61, 0.12)"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={center}
            cy={center}
            r={rHard}
            fill="none"
            stroke="rgba(245, 184, 61, 0.12)"
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
          <span className="text-2xl sm:text-3xl font-bold text-text-primary leading-none tracking-tight">
            {totalSolved}
          </span>
          <span className="text-[10px] uppercase font-bold tracking-widest text-text-secondary mt-1">
            Solved
          </span>
        </div>
      </div>

      {/* Difficulty Breakdown Badges */}
      <div className="flex sm:flex-col gap-3">
        {/* Easy */}
        <div className="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-surface-overlay border border-verified/20">
          <div className="w-2.5 h-2.5 rounded-full bg-verified shadow-[0_0_8px_#3DDC97]" />
          <div>
            <div className="text-[10px] text-text-secondary font-semibold uppercase">Easy</div>
            <div className="text-sm font-bold text-text-primary font-mono">{easy}</div>
          </div>
        </div>

        {/* Medium */}
        <div className="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-surface-overlay border border-primary/20">
          <div className="w-2.5 h-2.5 rounded-full bg-primary shadow-[0_0_8px_#F5B83D]" />
          <div>
            <div className="text-[10px] text-text-secondary font-semibold uppercase">Medium</div>
            <div className="text-sm font-bold text-text-primary font-mono">{medium}</div>
          </div>
        </div>

        {/* Hard */}
        <div className="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-surface-overlay border border-primary/20">
          <div className="w-2.5 h-2.5 rounded-full bg-primary shadow-[0_0_8px_#F5B83D]" />
          <div>
            <div className="text-[10px] text-text-secondary font-semibold uppercase">Hard</div>
            <div className="text-sm font-bold text-text-primary font-mono">{hard}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
