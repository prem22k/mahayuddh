"use client";

import React, { useState, useEffect } from "react";
import {
  Inbox,
  Send,
  CheckCircle2,
  Clock,
  ExternalLink,
  Plus,
  MessageSquare,
  Loader2,
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
        return "text-apple-green bg-apple-green/10 border-apple-green/30";
      case "medium":
        return "text-apple-orange bg-apple-orange/10 border-apple-orange/30";
      case "hard":
        return "text-apple-red bg-apple-red/10 border-apple-red/30";
      default:
        return "text-txt-secondary";
    }
  };

  const filteredList = suggestions.filter((s) => {
    if (activeTab === "pending") return s.status === "pending";
    if (activeTab === "completed") return s.status === "completed";
    return true;
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-apple-accent tracking-wider uppercase mb-1">
            <Inbox className="w-3.5 h-3.5" />
            <span>Targeted Skill Challenges</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-txt-primary tracking-tight">
            Suggestion Box
          </h1>
          <p className="text-xs text-txt-secondary mt-1">
            Recommend questions with custom intuition hints, verified automatically in Supabase via LeetCode sync.
          </p>
        </div>

        {/* Action Button */}
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 rounded-pill bg-apple-accent hover:opacity-90 text-white font-semibold text-xs flex items-center gap-2 shadow-glow self-start md:self-auto transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Challenge a Friend</span>
        </button>
      </div>

      {/* Tab Filter */}
      <div className="flex items-center gap-2 border-b border-border-subtle pb-3">
        <button
          onClick={() => setActiveTab("all")}
          className={cn(
            "px-3.5 py-1.5 rounded-pill text-xs font-semibold transition-all",
            activeTab === "all"
              ? "bg-surface-raised text-txt-primary border border-border-strong"
              : "text-txt-secondary hover:text-txt-primary"
          )}
        >
          All Challenges ({suggestions.length})
        </button>
        <button
          onClick={() => setActiveTab("pending")}
          className={cn(
            "px-3.5 py-1.5 rounded-pill text-xs font-semibold transition-all",
            activeTab === "pending"
              ? "bg-surface-raised text-txt-primary border border-border-strong"
              : "text-txt-secondary hover:text-txt-primary"
          )}
        >
          Pending ({suggestions.filter((s) => s.status === "pending").length})
        </button>
        <button
          onClick={() => setActiveTab("completed")}
          className={cn(
            "px-3.5 py-1.5 rounded-pill text-xs font-semibold transition-all",
            activeTab === "completed"
              ? "bg-surface-raised text-txt-primary border border-border-strong"
              : "text-txt-secondary hover:text-txt-primary"
          )}
        >
          Completed ({suggestions.filter((s) => s.status === "completed").length})
        </button>
      </div>

      {/* Suggestion Cards Grid */}
      {loading ? (
        <div className="h-60 flex items-center justify-center gap-3 text-txt-secondary">
          <Loader2 className="w-6 h-6 animate-spin text-apple-accent" />
          <span className="text-xs">Loading challenges from database...</span>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="p-12 text-center text-txt-secondary text-xs bg-surface-sidebar rounded-2xl border border-border-subtle">
          No suggestions found in this view. Click &ldquo;Challenge a Friend&rdquo; above!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredList.map((item) => (
            <div
              key={item.id}
              className="bg-surface-sidebar border border-border-subtle hover:border-border-strong rounded-2xl p-5 flex flex-col justify-between shadow-subtle transition-all space-y-4"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-txt-secondary font-medium">
                    {item.from_profile ? `@${item.from_profile.username}` : "Squad Member"} •{" "}
                    {new Date(item.created_at).toLocaleDateString()}
                  </span>
                  {item.status === "completed" ? (
                    <span className="px-2 py-0.5 rounded-full bg-apple-green/15 text-apple-green border border-apple-green/30 text-[10px] font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Solved & Verified</span>
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-apple-orange/15 text-apple-orange border border-apple-orange/30 text-[10px] font-bold flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>Pending Verification</span>
                    </span>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <h3 className="text-base font-bold text-txt-primary">{item.problem_title}</h3>
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
                  <div className="mt-3 p-3 rounded-xl bg-surface-muted border border-border-subtle text-xs text-txt-secondary flex items-start gap-2 italic">
                    <MessageSquare className="w-3.5 h-3.5 text-apple-accent shrink-0 mt-0.5" />
                    <span>&ldquo;{item.note}&rdquo;</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border-subtle/50 text-xs">
                <span className="text-[11px] text-txt-tertiary">
                  Auto-syncs with LeetCode submissions
                </span>
                <a
                  href={`https://leetcode.com/problems/${item.problem_slug}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-pill bg-surface-muted hover:bg-surface-raised border border-border-subtle text-txt-primary font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <span>Solve on LeetCode</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Challenge Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsModalOpen(false)} />
          <div className="relative w-full max-w-lg bg-surface-muted border border-border-strong rounded-2xl shadow-modal p-6 z-10 animate-in fade-in zoom-in-95">
            <h2 className="text-xl font-bold text-txt-primary mb-1">Challenge a Friend</h2>
            <p className="text-xs text-txt-secondary mb-5">
              Send a targeted LeetCode problem with an intuition hint.
            </p>

            <form onSubmit={handleSendChallenge} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-txt-secondary mb-1">
                  Recipient Friend
                </label>
                <select
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  className="w-full bg-surface-sidebar border border-border-subtle rounded-lg p-2.5 text-xs text-txt-primary focus:outline-none focus:border-apple-accent"
                >
                  {profiles.length === 0 ? (
                    <option value="demo">Squad Friends</option>
                  ) : (
                    profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.username} (@{p.leetcode_username})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-txt-secondary mb-1">
                  Problem Title
                </label>
                <input
                  type="text"
                  value={problemTitle}
                  onChange={(e) => setProblemTitle(e.target.value)}
                  placeholder="e.g., 'Word Ladder II' or 'Course Schedule'"
                  className="w-full bg-surface-sidebar border border-border-subtle rounded-lg p-2.5 text-xs text-txt-primary focus:outline-none focus:border-apple-accent"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-txt-secondary mb-1">
                    Problem Slug (Optional)
                  </label>
                  <input
                    type="text"
                    value={problemSlug}
                    onChange={(e) => setProblemSlug(e.target.value)}
                    placeholder="e.g., 'word-ladder-ii'"
                    className="w-full bg-surface-sidebar border border-border-subtle rounded-lg p-2.5 text-xs text-txt-primary focus:outline-none focus:border-apple-accent font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-txt-secondary mb-1">
                    Difficulty
                  </label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                    className="w-full bg-surface-sidebar border border-border-subtle rounded-lg p-2.5 text-xs text-txt-primary focus:outline-none focus:border-apple-accent"
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-txt-secondary mb-1">
                  Intuition / Hint Note (3 lines max)
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g., 'Try monotonic decreasing stack to find next greater element in O(N)'"
                  rows={3}
                  className="w-full bg-surface-sidebar border border-border-subtle rounded-lg p-2.5 text-xs text-txt-primary focus:outline-none focus:border-apple-accent resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-pill bg-surface-raised text-txt-secondary hover:text-txt-primary text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-pill bg-apple-accent hover:opacity-90 text-white text-xs font-semibold shadow-glow flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Send Challenge</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
