"use client";

import React, { useState } from "react";
import {
  Inbox,
  Send,
  CheckCircle2,
  Clock,
  ExternalLink,
  Plus,
  MessageSquare,
} from "lucide-react";
import confetti from "canvas-confetti";
import { cn } from "@/lib/utils";

interface SuggestionItem {
  id: string;
  from: string;
  to: string;
  problemTitle: string;
  problemSlug: string;
  difficulty: "Easy" | "Medium" | "Hard";
  note: string;
  status: "pending" | "completed";
  time: string;
}

const SAMPLE_SUGGESTIONS: SuggestionItem[] = [
  {
    id: "1",
    from: "Rahul K",
    to: "Prem Sai",
    problemTitle: "Word Ladder II",
    problemSlug: "word-ladder-ii",
    difficulty: "Hard",
    note: "Notice how level-by-level BFS optimization avoids exponential path branching!",
    status: "pending",
    time: "2h ago",
  },
  {
    id: "2",
    from: "Arjun V",
    to: "Prem Sai",
    problemTitle: "Target Sum",
    problemSlug: "target-sum",
    difficulty: "Medium",
    note: "Translate this into standard 0/1 subset sum with rolling 1D array.",
    status: "completed",
    time: "Yesterday",
  },
  {
    id: "3",
    from: "Prem Sai",
    to: "Rahul K",
    problemTitle: "Daily Temperatures",
    problemSlug: "daily-temperatures",
    difficulty: "Medium",
    note: "Classic monotonic decreasing stack pattern.",
    status: "completed",
    time: "2 days ago",
  },
];

export default function SuggestionsPage() {
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>(SAMPLE_SUGGESTIONS);
  const [activeTab, setActiveTab] = useState<"inbox" | "outbox">("inbox");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [targetFriend, setTargetFriend] = useState("Rahul K");
  const [problemTitle, setProblemTitle] = useState("");
  const [problemSlug, setProblemSlug] = useState("");
  const [difficulty, setDifficulty] = useState<"Easy" | "Medium" | "Hard">("Medium");
  const [note, setNote] = useState("");

  const handleSendChallenge = (e: React.FormEvent) => {
    e.preventDefault();
    if (!problemTitle) return;

    const newSuggestion: SuggestionItem = {
      id: Date.now().toString(),
      from: "Prem Sai",
      to: targetFriend,
      problemTitle,
      problemSlug: problemSlug || problemTitle.toLowerCase().replace(/\s+/g, "-"),
      difficulty,
      note,
      status: "pending",
      time: "Just now",
    };

    setSuggestions([newSuggestion, ...suggestions]);
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
  };

  const getDifficultyBadge = (diff: string) => {
    switch (diff.toLowerCase()) {
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

  const displayedList = suggestions.filter((s) =>
    activeTab === "inbox" ? s.to === "Prem Sai" : s.from === "Prem Sai"
  );

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
            Recommend questions with custom intuition hints, verified automatically on LeetCode.
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
          onClick={() => setActiveTab("inbox")}
          className={cn(
            "px-3.5 py-1.5 rounded-pill text-xs font-semibold transition-all",
            activeTab === "inbox"
              ? "bg-surface-raised text-txt-primary border border-border-strong"
              : "text-txt-secondary hover:text-txt-primary"
          )}
        >
          Incoming Challenges ({suggestions.filter((s) => s.to === "Prem Sai").length})
        </button>
        <button
          onClick={() => setActiveTab("outbox")}
          className={cn(
            "px-3.5 py-1.5 rounded-pill text-xs font-semibold transition-all",
            activeTab === "outbox"
              ? "bg-surface-raised text-txt-primary border border-border-strong"
              : "text-txt-secondary hover:text-txt-primary"
          )}
        >
          Sent Challenges ({suggestions.filter((s) => s.from === "Prem Sai").length})
        </button>
      </div>

      {/* Suggestion Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {displayedList.length === 0 ? (
          <div className="col-span-2 p-12 text-center text-txt-secondary text-xs bg-surface-sidebar rounded-2xl border border-border-subtle">
            No suggestions found in this view. Use &ldquo;Challenge a Friend&rdquo; above!
          </div>
        ) : (
          displayedList.map((item) => (
            <div
              key={item.id}
              className="bg-surface-sidebar border border-border-subtle hover:border-border-strong rounded-2xl p-5 flex flex-col justify-between shadow-subtle transition-all space-y-4"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-txt-secondary font-medium">
                    {activeTab === "inbox" ? `From @${item.from}` : `To @${item.to}`} • {item.time}
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
                  <h3 className="text-base font-bold text-txt-primary">{item.problemTitle}</h3>
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
                  Auto-syncs with LeetCode recent submissions
                </span>
                <a
                  href={`https://leetcode.com/problems/${item.problemSlug}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-pill bg-surface-muted hover:bg-surface-raised border border-border-subtle text-txt-primary font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <span>Solve on LeetCode</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Challenge Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-md"
            onClick={() => setIsModalOpen(false)}
          />
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
                  value={targetFriend}
                  onChange={(e) => setTargetFriend(e.target.value)}
                  className="w-full bg-surface-sidebar border border-border-subtle rounded-lg p-2.5 text-xs text-txt-primary focus:outline-none focus:border-apple-accent"
                >
                  <option value="Rahul K">Rahul K (@rahulk_dev)</option>
                  <option value="Arjun V">Arjun V (@arjun_v)</option>
                  <option value="Sneha M">Sneha M (@sneha_codes)</option>
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
                    onChange={(e) => setDifficulty(e.target.value as "Easy" | "Medium" | "Hard")}
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
                  className="px-4 py-2 rounded-pill bg-apple-accent hover:opacity-90 text-white text-xs font-semibold shadow-glow flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
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
