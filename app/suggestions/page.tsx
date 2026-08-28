"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ExternalLink,
  Plus,
  Play,
  CheckCircle2,
  ArrowRight,
  Clock,
} from "lucide-react";
import confetti from "canvas-confetti";
import { cn } from "@/lib/utils";
import { getSuggestions, createSuggestion, markSuggestionCompleted } from "@/lib/data/suggestions";
import { getSquadProfiles } from "@/lib/data/profiles";
import { useAuth } from "@/components/providers/AuthProvider";
import { useSolving } from "@/components/providers/SolvingProvider";
import { Suggestion, Profile, Difficulty } from "@/types/database";

export default function SuggestionsPage() {
  const { user } = useAuth();
  const { startSolving } = useSolving();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "for_you" | "pending" | "completed">("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [targetUserId, setTargetUserId] = useState("");
  const [problemTitle, setProblemTitle] = useState("");
  const [problemSlug, setProblemSlug] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("Medium");
  const [note, setNote] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [suggestionsData, profilesData] = await Promise.all([
        getSuggestions(),
        getSquadProfiles(),
      ]);
      setSuggestions(suggestionsData);
      setProfiles(profilesData);
      const otherProfiles = profilesData.filter((p) => p.id !== user?.id);
      if (otherProfiles.length > 0 && !targetUserId) {
        setTargetUserId(otherProfiles[0].id);
      } else if (profilesData.length > 0 && !targetUserId) {
        setTargetUserId(profilesData[0].id);
      }
    } catch (err) {
      console.error("Error loading suggestions:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, targetUserId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Honor ?to=<user_id> from the leaderboard "Challenge" action.
  useEffect(() => {
    if (typeof window !== "undefined") {
      const to = new URLSearchParams(window.location.search).get("to");
      if (to) {
        setTargetUserId(to);
        setIsModalOpen(true);
      }
    }
  }, []);

  const handleSendChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!problemTitle || !user) return;
    if (!targetUserId || targetUserId === "demo") {
      setSubmitting(false);
      return;
    }

    setSubmitting(true);
    try {
      const slug = problemSlug.trim() || problemTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const created = await createSuggestion({
        fromUser: user.id,
        toUser: targetUserId,
        problemTitle: problemTitle.trim(),
        problemSlug: slug,
        difficulty,
        note: note.trim(),
      });

      if (created) {
        setSuggestions([created, ...suggestions]);
        setIsModalOpen(false);
        setProblemTitle("");
        setProblemSlug("");
        setNote("");

        confetti({
          particleCount: 60,
          spread: 60,
          origin: { y: 0.8 },
          colors: ["#fa586a", "#ffffff", "#ffd60a"],
        });
      }
    } catch (err) {
      console.error("Error creating challenge:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartSolvingChallenge = (item: Suggestion) => {
    startSolving({
      id: 1,
      title: item.problem_title,
      slug: item.problem_slug,
      difficulty: item.difficulty,
      category: "Squad Challenge",
    });
  };

  const handleMarkCompleted = async (item: Suggestion) => {
    const ok = await markSuggestionCompleted(item.id);
    if (ok) {
      setSuggestions((prev) =>
        prev.map((s) => (s.id === item.id ? { ...s, status: "completed", completed_at: new Date().toISOString() } : s))
      );
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
        colors: ["#30d158", "#ffffff"],
      });
    }
  };

  const getDifficultyBadge = (diff: string) => {
    switch (diff?.toLowerCase()) {
      case "easy":
        return "text-[#30d158] bg-[#30d158]/10 border-[#30d158]/25";
      case "medium":
        return "text-[#ff9f0a] bg-[#ff9f0a]/10 border-[#ff9f0a]/25";
      case "hard":
        return "text-[#ff453a] bg-[#ff453a]/10 border-[#ff453a]/25";
      default:
        return "text-white/40";
    }
  };

  const filteredList = suggestions.filter((s) => {
    if (activeTab === "for_you") return s.to_user === user?.id;
    if (activeTab === "pending") return s.status === "pending";
    if (activeTab === "completed") return s.status === "completed";
    return true;
  });

  const forYouCount = suggestions.filter((s) => s.to_user === user?.id && s.status === "pending").length;
  const eligibleRecipientProfiles = profiles.filter((p) => p.id !== user?.id);

  return (
    <div className="space-y-8 select-none">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold text-[#fa586a] tracking-[0.2em] uppercase mb-1">
            Squad Challenges & Accountability
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
            Suggestion Box
          </h1>
          <p className="text-xs text-white/40 mt-1">
            Challenge squad mates with curated problems, hints, and automated sync verification.
          </p>
        </div>

        {/* Action Button */}
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 rounded-full bg-[#fa586a] hover:bg-[#fa586a]/90 text-white font-semibold text-xs flex items-center gap-1.5 shadow-[0_0_20px_rgba(250,88,106,0.35)] self-start md:self-auto transition-all cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Challenge a Friend</span>
        </button>
      </div>

      {/* ── Tab Filter ── */}
      <div className="flex items-center gap-2 p-1 bg-white/[0.04] rounded-full border border-white/[0.06] w-fit flex-wrap">
        <button
          onClick={() => setActiveTab("all")}
          className={cn(
            "px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer",
            activeTab === "all"
              ? "bg-white/[0.12] text-white shadow-sm"
              : "text-white/40 hover:text-white/80"
          )}
        >
          All ({suggestions.length})
        </button>
        {user && (
          <button
            onClick={() => setActiveTab("for_you")}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5",
              activeTab === "for_you"
                ? "bg-[#fa586a]/20 border border-[#fa586a]/30 text-white shadow-sm"
                : "text-white/40 hover:text-white/80"
            )}
          >
            <span>Targeting You</span>
            {forYouCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-[#fa586a] text-white font-bold text-[10px]">
                {forYouCount}
              </span>
            )}
          </button>
        )}
        <button
          onClick={() => setActiveTab("pending")}
          className={cn(
            "px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer",
            activeTab === "pending"
              ? "bg-white/[0.12] text-white shadow-sm"
              : "text-white/40 hover:text-white/80"
          )}
        >
          Pending ({suggestions.filter((s) => s.status === "pending").length})
        </button>
        <button
          onClick={() => setActiveTab("completed")}
          className={cn(
            "px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer",
            activeTab === "completed"
              ? "bg-white/[0.12] text-white shadow-sm"
              : "text-white/40 hover:text-white/80"
          )}
        >
          Completed ({suggestions.filter((s) => s.status === "completed").length})
        </button>
      </div>

      {/* ── Suggestion Cards Grid ── */}
      {loading ? (
        <div className="h-60 flex flex-col items-center justify-center gap-3 text-white/40">
          <div className="w-7 h-7 animate-spin rounded-full border-2 border-white/10 border-t-[#fa586a]" />
          <span className="text-xs">Loading challenges...</span>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="p-12 text-center text-white/40 text-xs bg-[#1c1c1e]/60 rounded-2xl border border-white/[0.06]">
          {activeTab === "for_you"
            ? "No incoming challenges for you right now. You are all caught up!"
            : "No suggestions found in this view. Click 'Challenge a Friend' above."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredList.map((item) => {
            const isTarget = item.to_user === user?.id;
            const isSender = item.from_user === user?.id;
            const isCompleted = item.status === "completed";

            return (
              <div
                key={item.id}
                className={cn(
                  "bg-[#1c1c1e]/60 border rounded-2xl p-5 flex flex-col justify-between shadow-subtle transition-all space-y-4 backdrop-blur-xl",
                  isTarget && !isCompleted
                    ? "border-[#fa586a]/40 bg-gradient-to-br from-[#fa586a]/10 via-[#1c1c1e]/60 to-[#1c1c1e]/60 shadow-[0_0_25px_rgba(250,88,106,0.15)]"
                    : "border-white/[0.06] hover:border-white/[0.12]"
                )}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[11px] text-white/50 font-medium">
                      <span className="text-white font-bold">
                        @{item.from_profile?.username || "Member"}
                      </span>
                      <ArrowRight className="w-3 h-3 text-white/30" />
                      <span className="text-white font-bold">
                        @{item.to_profile?.username || "Member"}
                      </span>
                      {isTarget && (
                        <span className="px-1.5 py-0.2 rounded-full bg-[#fa586a] text-white text-[9px] font-black uppercase tracking-wider">
                          YOU
                        </span>
                      )}
                    </div>

                    {isCompleted ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-[#30d158]/15 text-[#30d158] border border-[#30d158]/30 text-[10px] font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Solved</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-[#ff9f0a]/15 text-[#ff9f0a] border border-[#ff9f0a]/30 text-[10px] font-bold flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>Pending</span>
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <h3 className="text-base font-bold text-white">{item.problem_title}</h3>
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                        getDifficultyBadge(item.difficulty)
                      )}
                    >
                      {item.difficulty}
                    </span>
                  </div>

                  {item.note && (
                    <div className="mt-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs text-white/70 italic">
                      &ldquo;{item.note}&rdquo;
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-white/[0.04] text-xs gap-2">
                  <div className="flex items-center gap-2">
                    {/* Start Solving in Dock */}
                    <button
                      onClick={() => handleStartSolvingChallenge(item)}
                      className="px-3 py-1.5 rounded-full bg-[#fa586a]/15 hover:bg-[#fa586a]/25 text-[#fa586a] border border-[#fa586a]/30 font-semibold flex items-center gap-1.5 transition-colors text-[11px] cursor-pointer"
                      title="Load into Player Dock"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Solve in Dock</span>
                    </button>

                    {(isTarget || isSender) && !isCompleted && (
                      <button
                        onClick={() => handleMarkCompleted(item)}
                        className="px-3 py-1.5 rounded-full bg-white/[0.04] hover:bg-[#30d158]/15 hover:text-[#30d158] hover:border-[#30d158]/30 border border-white/[0.08] text-white/60 font-semibold flex items-center gap-1.5 transition-colors text-[11px] cursor-pointer"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Mark Solved</span>
                      </button>
                    )}
                  </div>

                  <a
                    href={`https://leetcode.com/problems/${item.problem_slug}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white/80 hover:text-white font-semibold flex items-center gap-1.5 transition-colors text-[11px]"
                  >
                    <span>LeetCode</span>
                    <ExternalLink className="w-3 h-3 text-white/50" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Challenge Modal ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsModalOpen(false)} />
          <div className="relative w-full max-w-lg bg-[#1c1c1e] border border-white/[0.1] rounded-3xl shadow-modal p-6 z-10 animate-in fade-in zoom-in-95">
            <h2 className="text-xl font-bold text-white mb-1">Challenge a Friend</h2>
            <p className="text-xs text-white/40 mb-5">
              Send a targeted algorithmic challenge with your custom intuition notes.
            </p>

            <form onSubmit={handleSendChallenge} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-1.5 pl-1">
                  Recipient Squad Member
                </label>
                <select
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#fa586a]/60 cursor-pointer"
                >
                  {(eligibleRecipientProfiles.length > 0 ? eligibleRecipientProfiles : profiles).map((p) => (
                    <option key={p.id} value={p.id} className="bg-[#1c1c1e] text-white">
                      @{p.username} {p.leetcode_username ? `(${p.leetcode_username})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-1.5 pl-1">
                  Problem Title
                </label>
                <input
                  type="text"
                  value={problemTitle}
                  onChange={(e) => setProblemTitle(e.target.value)}
                  placeholder="e.g. Word Ladder II or Course Schedule"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl p-2.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-[#fa586a]/60"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-1.5 pl-1">
                    Problem Slug (Optional)
                  </label>
                  <input
                    type="text"
                    value={problemSlug}
                    onChange={(e) => setProblemSlug(e.target.value)}
                    placeholder="e.g. word-ladder-ii"
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl p-2.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-[#fa586a]/60 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-1.5 pl-1">
                    Difficulty
                  </label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#fa586a]/60 cursor-pointer"
                  >
                    <option value="Easy" className="bg-[#1c1c1e] text-white">Easy</option>
                    <option value="Medium" className="bg-[#1c1c1e] text-white">Medium</option>
                    <option value="Hard" className="bg-[#1c1c1e] text-white">Hard</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-1.5 pl-1">
                  Intuition / Hint Note
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Try monotonic decreasing stack to find next greater element in O(N)"
                  rows={3}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl p-2.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-[#fa586a]/60 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-full bg-white/[0.04] text-white/50 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-full bg-[#fa586a] hover:bg-[#fa586a]/90 text-white text-xs font-semibold shadow-glow transition-all disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? "Sending..." : "Send Challenge"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
