"use client";

import React, { useState, useEffect } from "react";
import {
  ExternalLink,
  Plus,
} from "lucide-react";
import confetti from "canvas-confetti";
import { cn } from "@/lib/utils";
import { getSuggestions, createSuggestion } from "@/lib/data/suggestions";
import { getSquadProfiles } from "@/lib/data/profiles";
import { useAuth } from "@/components/providers/AuthProvider";
import { Suggestion, Profile, Difficulty } from "@/types/database";

export default function SuggestionsPage() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "pending" | "completed">("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [targetUserId, setTargetUserId] = useState("");
  const [problemTitle, setProblemTitle] = useState("");
  const [problemSlug, setProblemSlug] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("Medium");
  const [note, setNote] = useState("");

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [suggestionsData, profilesData] = await Promise.all([
          getSuggestions(),
          getSquadProfiles(),
        ]);
        setSuggestions(suggestionsData);
        setProfiles(profilesData);
        if (profilesData.length > 0) {
          setTargetUserId(profilesData[0].id);
        }
      } catch (err) {
        console.error("Error loading suggestions:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const { user } = useAuth();

  const handleSendChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!problemTitle || !user) return;

    setSubmitting(true);
    try {
      const slug = problemSlug || problemTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const created = await createSuggestion({
        fromUser: user.id,
        toUser: targetUserId || user.id,
        problemTitle,
        problemSlug: slug,
        difficulty,
        note,
      });

      if (created) {
        setSuggestions([created, ...suggestions]);
        setIsModalOpen(false);
        setProblemTitle("");
        setProblemSlug("");
        setNote("");

        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.8 },
          colors: ["#fa586a", "#ffffff"],
        });
      }
    } catch (err) {
      console.error("Error creating challenge:", err);
    } finally {
      setSubmitting(false);
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
    if (activeTab === "pending") return s.status === "pending";
    if (activeTab === "completed") return s.status === "completed";
    return true;
  });

  return (
    <div className="space-y-8 select-none">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold text-[#fa586a] tracking-[0.2em] uppercase mb-1">
            Peer Accountability
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
            Suggestions
          </h1>
          <p className="text-xs text-white/40 mt-1">
            Recommend questions with custom intuition hints, verified automatically via LeetCode sync.
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
      <div className="flex items-center gap-2 p-1 bg-white/[0.04] rounded-full border border-white/[0.06] w-fit">
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
          No suggestions in this view. Click &ldquo;Challenge a Friend&rdquo; above.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredList.map((item) => (
            <div
              key={item.id}
              className="bg-[#1c1c1e]/60 border border-white/[0.06] hover:border-white/[0.12] rounded-2xl p-5 flex flex-col justify-between shadow-subtle transition-all space-y-4 backdrop-blur-xl"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-white/40 font-medium">
                    {item.from_profile ? `@${item.from_profile.username}` : "Squad Member"} •{" "}
                    {new Date(item.created_at).toLocaleDateString()}
                  </span>
                  {item.status === "completed" ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-[#30d158]/15 text-[#30d158] border border-[#30d158]/30 text-[10px] font-bold">
                      Solved & Verified
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full bg-[#ff9f0a]/15 text-[#ff9f0a] border border-[#ff9f0a]/30 text-[10px] font-bold">
                      Pending
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

              <div className="flex items-center justify-between pt-3 border-t border-white/[0.04] text-xs">
                <span className="text-[11px] text-white/30">
                  Auto-syncs via LeetCode
                </span>
                <a
                  href={`https://leetcode.com/problems/${item.problem_slug}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white font-semibold flex items-center gap-1.5 transition-colors text-[11px]"
                >
                  <span>Solve on LeetCode</span>
                  <ExternalLink className="w-3 h-3 text-white/50" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Challenge Modal ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsModalOpen(false)} />
          <div className="relative w-full max-w-lg bg-[#1c1c1e] border border-white/[0.1] rounded-3xl shadow-modal p-6 z-10 animate-in fade-in zoom-in-95">
            <h2 className="text-xl font-bold text-white mb-1">Challenge a Friend</h2>
            <p className="text-xs text-white/40 mb-5">
              Send a targeted LeetCode problem with an intuition hint.
            </p>

            <form onSubmit={handleSendChallenge} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-1.5 pl-1">
                  Recipient Friend
                </label>
                <select
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#fa586a]/60"
                >
                  {profiles.length === 0 ? (
                    <option value="demo">Squad Friends</option>
                  ) : (
                    profiles.map((p) => (
                      <option key={p.id} value={p.id} className="bg-[#1c1c1e] text-white">
                        {p.username} (@{p.leetcode_username})
                      </option>
                    ))
                  )}
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
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#fa586a]/60"
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
                  className="px-4 py-2 rounded-full bg-white/[0.04] text-white/50 hover:text-white text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-full bg-[#fa586a] hover:bg-[#fa586a]/90 text-white text-xs font-semibold shadow-glow transition-all disabled:opacity-50"
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
