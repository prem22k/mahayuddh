"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  ExternalLink,
  Flame,
  Trophy,
  Calendar,
  Zap,
  Award,
  Check,
  Share2,
  Shield,
  Activity,
} from "lucide-react";
import confetti from "canvas-confetti";
import { cn } from "@/lib/utils";
import { Profile } from "@/types/database";
import {
  getTierInfo,
  calculatePowerLevel,
  calculateStreaks,
  computeDomainMastery,
  generateDossierShareText,
} from "@/lib/stats";
import { CURATED_SHEETS } from "@/lib/data/curatedSheetsData";
import { AlgorithmicCombatRadar } from "./AlgorithmicCombatRadar";
import { TriForceEnergyRings } from "./TriForceEnergyRings";

interface UserStatsDossierModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: Profile | null;
  statusMap?: Record<string, string>;
  userCalendarJson?: string | Record<string, number> | null;
}

export function UserStatsDossierModal({
  isOpen,
  onClose,
  profile,
  statusMap = {},
  userCalendarJson,
}: UserStatsDossierModalProps) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "radar">("overview");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !profile) return null;

  const rating = profile.contest_rating || 1500;
  const tier = getTierInfo(rating);
  const powerLevel = calculatePowerLevel(profile);
  const streakStats = calculateStreaks(userCalendarJson);
  const effectiveCurrentStreak = profile.streak || streakStats.currentStreak;
  const effectiveMaxStreak = Math.max(effectiveCurrentStreak, streakStats.maxStreak || effectiveCurrentStreak);

  // Flatten all curated problems for domain mastery computation
  const allCurated = CURATED_SHEETS.flatMap((s) => s.problems);
  const masteryPoints = computeDomainMastery(statusMap, allCurated);

  const totalSolved =
    (profile.total_easy || 0) + (profile.total_medium || 0) + (profile.total_hard || 0);

  const handleCopyShare = () => {
    const text = generateDossierShareText(profile, powerLevel, tier);
    navigator.clipboard.writeText(text);
    setCopied(true);
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.8 },
      colors: ["#fa586a", "#ffffff", "#ffd60a", "#30d158"],
    });
    setTimeout(() => setCopied(false), 2500);
  };

  const daysOfWeek = ["M", "T", "W", "T", "F", "S", "S"];

  // Achievements
  const achievements = [
    {
      id: "hard_slayer",
      title: "Hard Slayer",
      desc: "Solved complex Hard algorithmic problems",
      unlocked: (profile.total_hard || 0) >= 5,
      icon: "⚔️",
      color: "#fa586a",
    },
    {
      id: "streak_titan",
      title: "Consistency Titan",
      desc: "Maintained a 7+ day consecutive streak",
      unlocked: effectiveMaxStreak >= 7,
      icon: "🔥",
      color: "#ff9f0a",
    },
    {
      id: "century_club",
      title: "Century Warrior",
      desc: "Solved 100+ total problems",
      unlocked: totalSolved >= 100,
      icon: "👑",
      color: "#ffd60a",
    },
    {
      id: "contest_veteran",
      title: "Contest Veteran",
      desc: "Achieved 1600+ contest battle rating",
      unlocked: rating >= 1600,
      icon: "🏆",
      color: "#bf5af2",
    },
  ];

  return (
    <div className="fixed inset-0 z-[350] flex items-center justify-center p-3 sm:p-4 select-none overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/85 backdrop-blur-xl transition-opacity"
        onClick={onClose}
      />

      {/* Holographic Battle Dossier Container */}
      <div
        className={cn(
          "relative w-full max-w-2xl bg-[#141416]/95 border rounded-3xl overflow-hidden z-10 shadow-[0_25px_80px_rgba(0,0,0,0.9)] animate-in fade-in zoom-in-95 my-auto",
          tier.borderColor
        )}
      >
        {/* Ambient Top Glow Banner */}
        <div
          className={cn(
            "absolute top-0 inset-x-0 h-44 bg-gradient-to-b opacity-40 pointer-events-none",
            tier.bgGradient
          )}
        />

        {/* ── Modal Header ── */}
        <div className="relative p-6 pb-4 border-b border-white/[0.06] flex items-start justify-between">
          <div className="flex items-center gap-4">
            {/* Avatar with Animated Tier Glow */}
            <div className="relative">
              <div
                className="w-16 h-16 rounded-2xl p-0.5 bg-gradient-to-br from-white/20 to-white/5 border border-white/10 flex items-center justify-center overflow-hidden shadow-lg"
                style={{ borderColor: tier.badgeColor }}
              >
                {profile.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatar_url}
                    alt={profile.username}
                    className="w-full h-full object-cover rounded-xl"
                  />
                ) : (
                  <span className="text-2xl font-black text-white">
                    {profile.username.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div
                className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider text-black border border-white/20 shadow-md"
                style={{ backgroundColor: tier.badgeColor }}
              >
                {tier.tier}
              </div>
            </div>

            {/* Identity & Rank */}
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-extrabold text-white tracking-tight">
                  @{profile.username}
                </h2>
                {profile.leetcode_username && (
                  <a
                    href={`https://leetcode.com/${profile.leetcode_username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/40 hover:text-white transition-colors"
                    title="View Official LeetCode Profile"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{ color: tier.badgeColor }}
                >
                  {tier.title}
                </span>
                <span className="text-white/20">•</span>
                <span className="text-xs text-white/50 font-mono">
                  {profile.global_rank
                    ? `Global Rank #${profile.global_rank.toLocaleString()}`
                    : "Rank Unassigned"}
                </span>
              </div>
            </div>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
            aria-label="Close dossier"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Navigation Tabs ── */}
        <div className="px-6 pt-3 flex items-center justify-between border-b border-white/[0.06] bg-white/[0.01]">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("overview")}
              className={cn(
                "px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer",
                activeTab === "overview"
                  ? "border-[#fa586a] text-white"
                  : "border-transparent text-white/40 hover:text-white/80"
              )}
            >
              Overview & Matrix
            </button>
            <button
              onClick={() => setActiveTab("radar")}
              className={cn(
                "px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5",
                activeTab === "radar"
                  ? "border-[#fa586a] text-white"
                  : "border-transparent text-white/40 hover:text-white/80"
              )}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Combat Radar</span>
            </button>
          </div>

          {/* Copy / Share Button */}
          <button
            onClick={handleCopyShare}
            className="text-xs font-semibold text-[#fa586a] hover:text-[#fa586a]/80 flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#fa586a]/10 border border-[#fa586a]/20 transition-all cursor-pointer mb-2"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[#30d158]" /> : <Share2 className="w-3.5 h-3.5" />}
            <span>{copied ? "Copied Dossier!" : "Share Dossier"}</span>
          </button>
        </div>

        {/* ── Modal Body Content ── */}
        <div className="p-6 space-y-6 max-h-[65vh] overflow-y-auto">
          {/* Hero Battle Rating Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Power Level */}
            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex flex-col justify-between">
              <div className="flex items-center justify-between text-white/40 text-[11px] font-semibold uppercase">
                <span>Power Level</span>
                <Zap className="w-3.5 h-3.5 text-[#ffd60a]" />
              </div>
              <div className="text-2xl font-black text-white font-mono mt-2">
                {powerLevel.toLocaleString()}
              </div>
              <div className="text-[10px] text-white/40 mt-0.5">Combat Potential</div>
            </div>

            {/* Contest Rating */}
            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex flex-col justify-between">
              <div className="flex items-center justify-between text-white/40 text-[11px] font-semibold uppercase">
                <span>Contest Rating</span>
                <Trophy className="w-3.5 h-3.5 text-[#bf5af2]" />
              </div>
              <div className="text-2xl font-black text-white font-mono mt-2">
                {Math.round(rating)}
              </div>
              <div className="text-[10px] text-white/40 mt-0.5">{tier.tier} Division</div>
            </div>

            {/* Current Streak */}
            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex flex-col justify-between">
              <div className="flex items-center justify-between text-white/40 text-[11px] font-semibold uppercase">
                <span>Current Streak</span>
                <Flame className="w-3.5 h-3.5 text-[#fa586a]" />
              </div>
              <div className="text-2xl font-black text-white font-mono mt-2">
                {effectiveCurrentStreak} <span className="text-xs font-normal text-white/50">days</span>
              </div>
              <div className="text-[10px] text-white/40 mt-0.5">
                {effectiveCurrentStreak > 0 ? "Active Flame 🔥" : "Streak Idle"}
              </div>
            </div>

            {/* All-Time Max Streak */}
            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex flex-col justify-between">
              <div className="flex items-center justify-between text-white/40 text-[11px] font-semibold uppercase">
                <span>Max Streak</span>
                <Award className="w-3.5 h-3.5 text-[#30d158]" />
              </div>
              <div className="text-2xl font-black text-white font-mono mt-2">
                {effectiveMaxStreak} <span className="text-xs font-normal text-white/50">days</span>
              </div>
              <div className="text-[10px] text-white/40 mt-0.5">Personal Record</div>
            </div>
          </div>

          {activeTab === "overview" ? (
            <>
              {/* ── Tri-Force Radial Energy Rings ── */}
              <div className="p-5 rounded-2xl bg-[#1c1c1e]/60 border border-white/[0.06] shadow-subtle flex flex-col items-center">
                <div className="w-full flex items-center justify-between mb-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-white/50">
                    Solved Problem Matrix
                  </div>
                  <div className="text-[11px] font-mono text-[#fa586a]">
                    Total Solved: {totalSolved}
                  </div>
                </div>

                <TriForceEnergyRings
                  easy={profile.total_easy || 0}
                  medium={profile.total_medium || 0}
                  hard={profile.total_hard || 0}
                  size={190}
                />
              </div>

              {/* ── Consistency & Solar Weekly Pulse ── */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#64d2ff]" />
                    <span>7-Day Activity Pulse</span>
                  </div>
                  <p className="text-[11px] text-white/40 mt-0.5">
                    Total Active Days Recorded: {streakStats.totalActiveDays || effectiveMaxStreak}
                  </p>
                </div>

                {/* 7-Day Indicators */}
                <div className="flex items-center gap-2">
                  {streakStats.recentActiveDays.map((active, idx) => (
                    <div key={idx} className="flex flex-col items-center gap-1">
                      <span className="text-[9px] font-mono text-white/30">{daysOfWeek[idx]}</span>
                      <div
                        className={cn(
                          "w-5 h-5 rounded-md flex items-center justify-center transition-all",
                          active
                            ? "bg-[#30d158] text-black shadow-[0_0_8px_#30d158]"
                            : "bg-white/[0.04] border border-white/[0.08]"
                        )}
                      >
                        {active && <span className="text-[10px] font-bold">✓</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Combat Badges & Milestones ── */}
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-white/50 mb-3">
                  Battle Achievements
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {achievements.map((a) => (
                    <div
                      key={a.id}
                      className={cn(
                        "p-3 rounded-xl border flex items-center gap-3 transition-all",
                        a.unlocked
                          ? "bg-white/[0.04] border-white/[0.12] shadow-sm"
                          : "bg-white/[0.01] border-white/[0.04] opacity-40 grayscale"
                      )}
                    >
                      <div className="text-2xl shrink-0">{a.icon}</div>
                      <div className="truncate">
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>{a.title}</span>
                          {a.unlocked && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-[#30d158]/20 text-[#30d158] font-semibold">
                              UNLOCKED
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-white/40 truncate mt-0.5">{a.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            /* ── Algorithmic Combat Radar ── */
            <div className="p-6 rounded-2xl bg-[#1c1c1e]/60 border border-white/[0.06] flex flex-col items-center justify-center">
              <div className="w-full flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm font-bold text-white">Algorithmic Combat Radar</div>
                  <p className="text-[11px] text-white/40">
                    6-Pillar Domain Mastery plotted from your roadmap submissions
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-[#fa586a]/15 text-[#fa586a] border border-[#fa586a]/30 text-[10px] font-bold">
                  LIVE RADAR
                </span>
              </div>

              <AlgorithmicCombatRadar points={masteryPoints} size={280} />
            </div>
          )}
        </div>

        {/* ── Modal Footer ── */}
        <div className="p-4 bg-black/50 border-t border-white/[0.06] flex items-center justify-between text-xs text-white/40">
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-[#fa586a]" />
            <span>Mahayuddh Tactical Dossier</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.1] text-white font-semibold transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
