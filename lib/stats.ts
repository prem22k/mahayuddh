import { Profile } from "@/types/database";

export interface StreakStats {
  currentStreak: number;
  maxStreak: number;
  totalActiveDays: number;
  recentActiveDays: boolean[]; // Last 7 days [Mon ... Sun]
}

export interface MasteryRadarPoint {
  axis: string;
  label: string;
  value: number; // 0 - 100
  solved: number;
  total: number;
  icon: string;
}

export interface TierInfo {
  tier: string;
  title: string;
  badgeColor: string;
  bgGradient: string;
  borderColor: string;
  glowColor: string;
  minRating: number;
}

export function getTierInfo(rating: number = 1500): TierInfo {
  if (rating >= 2200) {
    return {
      tier: "GRANDMASTER",
      title: "Supreme Guardian",
      badgeColor: "#fa586a",
      bgGradient: "from-[#fa586a]/20 via-[#ff2a6d]/10 to-transparent",
      borderColor: "border-[#fa586a]/40",
      glowColor: "shadow-[0_0_30px_rgba(250,88,106,0.35)]",
      minRating: 2200,
    };
  }
  if (rating >= 1900) {
    return {
      tier: "MASTER",
      title: "Astral Knight",
      badgeColor: "#bf5af2",
      bgGradient: "from-[#bf5af2]/20 via-[#9d4edd]/10 to-transparent",
      borderColor: "border-[#bf5af2]/40",
      glowColor: "shadow-[0_0_30px_rgba(191,90,242,0.35)]",
      minRating: 1900,
    };
  }
  if (rating >= 1650) {
    return {
      tier: "DIAMOND",
      title: "Arena Gladiator",
      badgeColor: "#30d158",
      bgGradient: "from-[#30d158]/20 via-[#2ec4b6]/10 to-transparent",
      borderColor: "border-[#30d158]/40",
      glowColor: "shadow-[0_0_30px_rgba(48,209,88,0.35)]",
      minRating: 1650,
    };
  }
  if (rating >= 1450) {
    return {
      tier: "GOLD",
      title: "Algorithmic Specialist",
      badgeColor: "#ff9f0a",
      bgGradient: "from-[#ff9f0a]/20 via-[#f77f00]/10 to-transparent",
      borderColor: "border-[#ff9f0a]/40",
      glowColor: "shadow-[0_0_30px_rgba(255,159,10,0.35)]",
      minRating: 1450,
    };
  }
  return {
    tier: "VANGUARD",
    title: "Rising Challenger",
    badgeColor: "#64d2ff",
    bgGradient: "from-[#64d2ff]/20 via-[#0077b6]/10 to-transparent",
    borderColor: "border-[#64d2ff]/40",
    glowColor: "shadow-[0_0_30px_rgba(100,210,255,0.35)]",
    minRating: 0,
  };
}

export function calculatePowerLevel(profile: Profile): number {
  const rating = profile.contest_rating || 1500;
  const hard = profile.total_hard || 0;
  const medium = profile.total_medium || 0;
  const easy = profile.total_easy || 0;
  const streak = profile.streak || 0;

  const basePoints = rating * 1.5 + hard * 30 + medium * 10 + easy * 3;
  const streakBonus = 1 + Math.min(streak * 0.02, 0.4); // max 40% streak bonus
  return Math.round(basePoints * streakBonus);
}

export function calculateStreaks(submissionCalendarJson?: string | Record<string, number> | null): StreakStats {
  if (!submissionCalendarJson) {
    return { currentStreak: 0, maxStreak: 0, totalActiveDays: 0, recentActiveDays: [false, false, false, false, false, false, false] };
  }

  let calendar: Record<string, number> = {};
  try {
    calendar = typeof submissionCalendarJson === "string" ? JSON.parse(submissionCalendarJson) : submissionCalendarJson;
  } catch {
    return { currentStreak: 0, maxStreak: 0, totalActiveDays: 0, recentActiveDays: [false, false, false, false, false, false, false] };
  }

  const timestamps = Object.keys(calendar).map(Number).sort((a, b) => a - b);
  if (timestamps.length === 0) {
    return { currentStreak: 0, maxStreak: 0, totalActiveDays: 0, recentActiveDays: [false, false, false, false, false, false, false] };
  }

  const daySet = new Set(
    timestamps.map((ts) => {
      const d = new Date(ts * 1000);
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    })
  );

  const days = Array.from(daySet).sort();
  let maxStreak = 1;
  let running = 1;

  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1]).getTime();
    const curr = new Date(days[i]).getTime();
    const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      running += 1;
      if (running > maxStreak) maxStreak = running;
    } else {
      running = 1;
    }
  }

  const now = new Date();
  const todayStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
  const yesterday = new Date(Date.now() - 86400000);
  const yesterdayStr = `${yesterday.getUTCFullYear()}-${String(yesterday.getUTCMonth() + 1).padStart(2, "0")}-${String(yesterday.getUTCDate()).padStart(2, "0")}`;

  const lastActiveDay = days[days.length - 1];
  const currentStreak = lastActiveDay === todayStr || lastActiveDay === yesterdayStr ? running : 0;

  // Last 7 days activity
  const recentActiveDays: boolean[] = [];
  for (let i = 6; i >= 0; i--) {
    const target = new Date(Date.now() - i * 86400000);
    const dateStr = `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, "0")}-${String(target.getUTCDate()).padStart(2, "0")}`;
    recentActiveDays.push(daySet.has(dateStr));
  }

  return {
    currentStreak,
    maxStreak,
    totalActiveDays: days.length,
    recentActiveDays,
  };
}

export function computeDomainMastery(
  statusMap: Record<string, string>,
  allCuratedProblems: Array<{ title_slug: string; category: string; difficulty: string }>
): MasteryRadarPoint[] {
  const domains = [
    { axis: "dp", label: "Dynamic Prog", keywords: ["dynamic programming", "dp", "1-d", "2-d"], icon: "⚡" },
    { axis: "graphs", label: "Graphs & Networks", keywords: ["graph", "graphs", "bfs", "dfs", "topological"], icon: "🌐" },
    { axis: "trees", label: "Trees & Recursion", keywords: ["tree", "trees", "bst", "trie", "recursion"], icon: "🌲" },
    { axis: "arrays", label: "Arrays & Hashing", keywords: ["array", "arrays", "hash", "hashing", "stack", "queue"], icon: "📦" },
    { axis: "pointers", label: "Pointers & Windows", keywords: ["two pointers", "sliding window", "linked list", "intervals"], icon: "🎯" },
    { axis: "math", label: "Search & Math", keywords: ["binary search", "math", "geometry", "bit manipulation", "greedy", "backtracking"], icon: "📐" },
  ];

  return domains.map((domain) => {
    const matching = allCuratedProblems.filter((p) =>
      domain.keywords.some((k) => (p.category || "").toLowerCase().includes(k))
    );

    const total = matching.length || 1;
    const solved = matching.filter((p) => statusMap[p.title_slug] === "solved").length;
    const percentage = Math.min(Math.round((solved / total) * 100), 100);

    return {
      axis: domain.axis,
      label: domain.label,
      value: percentage,
      solved,
      total,
      icon: domain.icon,
    };
  });
}

export function generateDossierShareText(profile: Profile, powerLevel: number, tier: TierInfo): string {
  const total = (profile.total_easy || 0) + (profile.total_medium || 0) + (profile.total_hard || 0);
  return `⚔️ MAHAYUDDH WARRIOR DOSSIER: @${profile.username}
🏅 Tier: ${tier.title} (${tier.tier})
🔥 Power Level: ${powerLevel.toLocaleString()}
⚡ Rating: ${Math.round(profile.contest_rating || 1500)} | Streak: ${profile.streak} Days
🧩 Solved: ${total} (🟩 ${profile.total_easy} | 🟨 ${profile.total_medium} | 🟥 ${profile.total_hard})
🚀 Track & Battle: https://mahayuddh.app`;
}
