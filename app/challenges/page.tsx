"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Plus,
  Play,
  CheckCircle2,
  ArrowRight,
  Clock,
  Link2,
  Check,
  Forward,
  BellRing,
} from "lucide-react";
import confetti from "canvas-confetti";
import { cn } from "@/lib/utils";
import { slugifyTitle } from "@/lib/slug";
import { copyText } from "@/lib/clipboard";
import {
  getSuggestions,
  createSuggestion,
  markSuggestionCompleted,
  dismissSuggestion,
  acceptSuggestion,
  remindSuggestion,
} from "@/lib/data/suggestions";
import { getLatestBattle } from "@/lib/data/battles";
import { logFeedEvent } from "@/lib/data/feed";
import { notify } from "@/lib/data/notifications";
import { getSquadProfiles } from "@/lib/data/profiles";
import { useAuth } from "@/components/providers/AuthProvider";
import { useSolving } from "@/components/providers/SolvingProvider";
import { DifficultyBadge } from "@/components/ui/DifficultyBadge";
import { ProblemLink } from "@/components/ui/ProblemLink";
import { ModalShell } from "@/components/ui/ModalShell";
import { PageLoader } from "@/components/ui/PageLoader";
import { Suggestion, Profile, Difficulty } from "@/types/database";
import { track } from "@/lib/analytics";

export default function SuggestionsPage() {
  const { user, profile } = useAuth();
  const { startSolving } = useSolving();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "for_you" | "pending" | "completed">("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form State
  const [targetUserId, setTargetUserId] = useState("");
  const [problemTitle, setProblemTitle] = useState("");
  const [problemSlug, setProblemSlug] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("Medium");
  const [note, setNote] = useState("");
  const [beatTime, setBeatTime] = useState(false);
  const [myTime, setMyTime] = useState("");
  const [deadline, setDeadline] = useState("");
  // Off by default (Bible §12: least help first). Explicit opt-in only.
  const [spoiler, setSpoiler] = useState(false);
  const [passParent, setPassParent] = useState<Suggestion | null>(null);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [remindId, setRemindId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  function parseMmSs(v: string): number | null {
    const m = v.trim().match(/^(?:(\d+):)?([0-5]?\d)$/);
    if (!m) return null;
    const mins = m[1] ? parseInt(m[1], 10) : 0;
    return mins * 60 + parseInt(m[2], 10);
  }

  function fmtTime(sec: number): string {
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
  }

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
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
      setLoadError("Couldn't load challenges. Check your connection and retry.");
    } finally {
      setLoading(false);
    }
  }, [user?.id, targetUserId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Honor ?to=<user_id> (leaderboard) and ?problem=&title=&difficulty=&time=
  // (post-solve "Challenge someone" on Today's Battle) — the prefill path
  // exists so no next action is ever a dead form.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const to = params.get("to");
    if (to) setTargetUserId(to);

    const slug = params.get("problem");
    const title = params.get("title");
    if (slug && title) {
      setProblemSlug(slug);
      setProblemTitle(title);
      const d = params.get("difficulty");
      if (d === "Easy" || d === "Medium" || d === "Hard") setDifficulty(d);
      // Prefill the beat-my-time target from the solve we just finished.
      const time = params.get("time");
      const secs = time ? Number.parseInt(time, 10) : NaN;
      if (Number.isFinite(secs) && secs >= 0) {
        setBeatTime(true);
        setMyTime(`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`);
      }
    }
    if (to || (slug && title)) setIsModalOpen(true);
  }, []);

  const handleSendChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!problemTitle.trim() || !user) return;
    if (!targetUserId || targetUserId === "demo") {
      setCreateError("Pick a squad member to challenge.");
      setSubmitting(false);
      return;
    }
    if (targetUserId === user.id) {
      setCreateError("Challenge a squad mate, not yourself.");
      setSubmitting(false);
      return;
    }

    setSubmitting(true);
    setCreateError(null);
    try {
      const slug = (problemSlug.trim().toLowerCase() || slugifyTitle(problemTitle)).slice(0, 80);
      const senderSecs = beatTime ? parseMmSs(myTime) : null;
      if (beatTime && senderSecs == null) {
        setCreateError("Enter your solve time as m:ss (or uncheck “beat my time”).");
        setSubmitting(false);
        return;
      }
      const res = await createSuggestion({
        fromUser: user.id,
        toUser: targetUserId,
        problemTitle: problemTitle.trim(),
        problemSlug: slug,
        difficulty,
        message: note.trim(),
        senderTimeSec: senderSecs,
        beatTime,
        deadlineAt: deadline ? new Date(deadline + "T23:59:59").toISOString() : null,
        parentId: passParent?.id ?? null,
        // Off by default: a challenge is an invitation to think, not to copy.
        spoiler,
      });

      if (res.ok) {
        track("challenge_sent", { problem_slug: slug, beat_time: beatTime, pass: !!passParent });
        // The recipient is owed an answer — this is Loop A's return mechanism.
        notify({
          userId: targetUserId,
          kind: "challenge",
          title: `${profile ? `@${profile.username}` : "A squad mate"} challenged you`,
          body: `${problemTitle.trim()} · ${difficulty}`,
          deepLink: `/c/${res.suggestion.id}`,
          actorId: user.id,
          urgent: true,
        }).catch(() => {});
        logFeedEvent({
          eventType: "challenge",
          squadId: profile?.active_squad_id ?? null,
          problemTitle: problemTitle.trim(),
          problemSlug: slug,
          difficulty,
          objectId: res.suggestion.id,
          metadata: passParent ? { parent_id: passParent.id } : {},
        }).catch(() => {});
        setSuggestions([res.suggestion, ...suggestions]);
        setIsModalOpen(false);
        setProblemTitle("");
        setProblemSlug("");
        setNote("");
        setBeatTime(false);
        setMyTime("");
        setDeadline("");
        setSpoiler(false);
        setPassParent(null);
        setCreateError(null);

        confetti({
          particleCount: 60,
          spread: 60,
          origin: { y: 0.8 },
          colors: ["#fa586a", "#ffffff", "#ffd60a"],
        });
      } else if (res.reason === "duplicate") {
        setCreateError("This squad mate already has a pending challenge for that problem.");
      } else if (res.reason === "invalid") {
        setCreateError("Check the problem slug (lowercase letters, numbers, dashes) and keep hints under 2000 characters.");
      } else {
        setCreateError("Couldn't send the challenge. Please try again.");
      }
    } catch (err) {
      console.error("Error creating challenge:", err);
      setCreateError("Couldn't send the challenge. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartSolvingChallenge = async (item: Suggestion) => {
    // Persist the accept so the sender sees it in progress and the battle can be
    // attached to the challenge (plan Step 10).
    try {
      await acceptSuggestion(item.id, user?.id ?? "");
    } catch {
      // Not fatal: the battle still starts, accept state retries on next attempt.
    }
    track("challenge_accepted", { suggestion_id: item.id });
    startSolving({
      id: 1,
      title: item.problem_title,
      slug: item.problem_slug,
      difficulty: item.difficulty,
      category: "Squad Challenge",
      challengeId: item.id,
    });
  };

  const handleRemind = async (item: Suggestion) => {
    setRemindId(item.id);
    try {
      const res = await remindSuggestion(item.id, user?.id ?? "");
      if (!res.ok && res.reason === "throttled") {
        setActionNotice("You already nudged about this challenge in the last 24 hours.");
      } else if (res.ok) {
        setActionNotice("Reminder sent.");
      }
      // Server stamped reminded_at, so reload to reflect the throttle state.
      await loadData();
    } catch {
      setActionNotice("Couldn't send that reminder. Try again.");
    } finally {
      setRemindId(null);
    }
  };

  const handleDecline = async (item: Suggestion) => {
    const ok = await dismissSuggestion(item.id);
    if (ok) setSuggestions((prev) => prev.filter((s) => s.id !== item.id));
  };

  const handleCopyLink = async (item: Suggestion) => {
    if (await copyText(`${window.location.origin}/c/${item.id}`)) {
      setCopiedLinkId(item.id);
      setTimeout(() => setCopiedLinkId(null), 2000);
    }
  };

  const handlePass = (item: Suggestion) => {
    // Pass the challenge along: prefill problem, link chain via parent_id.
    setPassParent(item);
    setProblemTitle(item.problem_title);
    setProblemSlug(item.problem_slug);
    setDifficulty(item.difficulty);
    setNote("");
    setBeatTime(false);
    setMyTime("");
    setDeadline("");
    setSpoiler(false);
    setCreateError(null);
    setIsModalOpen(true);
  };

  const fillLatestTime = async () => {
    const slug = (problemSlug.trim().toLowerCase() || slugifyTitle(problemTitle)).slice(0, 80);
    if (!slug) return;
    const latest = await getLatestBattle(slug).catch(() => null);
    if (latest?.duration_sec != null) setMyTime(fmtTime(latest.duration_sec));
  };

  const [completeError, setCompleteError] = useState<string | null>(null);

  const handleMarkCompleted = async (item: Suggestion) => {
    if (!user) return;
    setCompleteError(null);
    const res = await markSuggestionCompleted(item.id, user.id);
    if (res.ok) {
      track("challenge_completed", { suggestion_id: item.id });
      logFeedEvent({
        eventType: "complete",
        squadId: profile?.active_squad_id ?? null,
        problemTitle: item.problem_title,
        problemSlug: item.problem_slug,
        difficulty: item.difficulty,
        objectId: item.id,
      }).catch(() => {});
      setSuggestions((prev) =>
        prev.map((s) => (s.id === item.id ? { ...s, status: "completed", completed_at: new Date().toISOString() } : s))
      );
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
        colors: ["#30d158", "#ffffff"],
      });
    } else if (res.reason === "not_solved") {
      setCompleteError("Mark the problem solved first (battle dock or roadmap), then mark complete. LeetCode sync only adds an evidence badge.");
    } else {
      setCompleteError("Only the challenged member can complete this.");
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
          <p className="text-xs text-white/55 mt-1">
            Challenge squad mates with curated problems, hints, and automated sync verification.
          </p>
        </div>

        {/* Action Button */}
        <button
          onClick={() => {
            setCreateError(null);
            setPassParent(null);
            setIsModalOpen(true);
          }}
          className="px-4 py-2 rounded-full btn-accent text-white font-semibold text-xs flex items-center gap-1.5 shadow-[0_0_20px_rgba(250,88,106,0.35)] self-start md:self-auto transition-all cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Challenge a Friend</span>
        </button>
      </div>

      {loadError && (
        <div role="alert" className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-5 py-4 rounded-2xl bg-[#ff453a]/10 border border-[#ff453a]/30">
          <span className="text-xs text-[#ff453a] font-medium">{loadError}</span>
          <button
            onClick={loadData}
            className="px-4 py-1.5 rounded-full bg-[#ff453a]/15 hover:bg-[#ff453a]/25 border border-[#ff453a]/30 text-[#ff453a] text-xs font-bold transition-all cursor-pointer shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Tab Filter ── */}
      <div className="flex items-center gap-2 p-1 bg-white/[0.04] rounded-full border border-white/[0.06] w-fit flex-wrap">
        <button
          onClick={() => setActiveTab("all")}
          className={cn(
            "px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer",
            activeTab === "all"
              ? "bg-white/[0.12] text-white shadow-sm"
              : "text-white/55 hover:text-white/80"
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
                ? "btn-accent border border-[#fa586a]/30 text-white shadow-sm"
                : "text-white/55 hover:text-white/80"
            )}
          >
            <span>Targeting You</span>
            {forYouCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full btn-accent text-white font-bold text-[10px]">
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
              : "text-white/55 hover:text-white/80"
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
              : "text-white/55 hover:text-white/80"
          )}
        >
          Completed ({suggestions.filter((s) => s.status === "completed").length})
        </button>
      </div>

      {/* ── Suggestion Cards Grid ── */}
      {completeError && (
        <div role="alert" className="px-4 py-2.5 rounded-xl bg-[#ff9f0a]/10 border border-[#ff9f0a]/30 text-[#ff9f0a] text-xs font-medium">
          {completeError}
        </div>
      )}
      {actionNotice && (
        <div role="status" className="px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/60 text-xs">
          {actionNotice}
        </div>
      )}
      {loading ? (
        <PageLoader label="Loading challenges..." className="h-60" />
      ) : filteredList.length === 0 ? (
        <div className="p-12 text-center space-y-3 bg-[#1c1c1e]/60 rounded-2xl border border-white/[0.06]">
          <p className="text-white/55 text-xs">
            {activeTab === "for_you"
              ? "No challenges yet. Solve a battle and challenge a friend — theirs will land here."
              : suggestions.length === 0
                ? "No challenges yet. Solve a battle and challenge a friend to start your squad loop."
                : "Nothing in this view. Try another tab."}
          </p>
          <Link href="/" className="inline-block px-4 py-2 rounded-full bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] text-white text-xs font-bold transition-all">
            Start a battle
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredList.map((item) => {
            const isTarget = item.to_user === user?.id;
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
                      <ArrowRight className="w-3 h-3 text-white/50" />
                      <span className="text-white font-bold">
                        @{item.to_profile?.username || "Member"}
                      </span>
                      {isTarget && (
                        <span className="px-1.5 py-0.2 rounded-full btn-accent text-white text-[9px] font-black uppercase tracking-wider">
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

                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-white">{item.problem_title}</h3>
                    <DifficultyBadge difficulty={item.difficulty} />
                    {item.sender_time_sec != null && (
                      <span className="px-2 py-0.5 rounded-full bg-[#0a84ff]/15 text-[#0a84ff] border border-[#0a84ff]/30 text-[10px] font-bold font-mono">
                        {item.beat_time ? `Beat ${fmtTime(item.sender_time_sec)}` : `Solved in ${fmtTime(item.sender_time_sec)}`}
                      </span>
                    )}
                    {item.deadline_at && item.status === "pending" && (
                      <span className="text-[10px] text-white/55 font-mono">
                        due {new Date(item.deadline_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {item.note && !(item.spoiler && !isTarget && !isCompleted) && (
                    <div className="mt-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs text-white/70 italic">
                      &ldquo;{item.note}&rdquo;
                    </div>
                  )}
                  {item.spoiler && !isTarget && !isCompleted && (
                    <div className="mt-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs text-white/50 italic">
                      Hidden hint — reveals when accepted.
                    </div>
                  )}
                  {item.parent_id && (
                    <Link href={`/c/${item.id}`} className="mt-2 inline-block text-[11px] text-[#bf5af2] font-semibold hover:underline">
                      View challenge chain →
                    </Link>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-white/[0.04] text-xs gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Start Solving in Dock */}
                    <button
                      onClick={() => handleStartSolvingChallenge(item)}
                      className="px-3 py-1.5 rounded-full bg-[#fa586a]/15 hover:bg-[#fa586a]/25 text-[#fa586a] border border-[#fa586a]/30 font-semibold flex items-center gap-1.5 transition-colors text-[11px] cursor-pointer"
                      title="Load into Player Dock"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>{isTarget && !isCompleted ? "Accept + Solve" : "Solve in Dock"}</span>
                    </button>

                    {/* Only the challenged member can complete (enforced server-side too). */}
                    {isTarget && !isCompleted && item.status === "pending" && (
                      <>
                        <button
                          onClick={() => handleMarkCompleted(item)}
                          className="px-3 py-1.5 rounded-full bg-white/[0.04] hover:bg-[#30d158]/15 hover:text-[#30d158] hover:border-[#30d158]/30 border border-white/[0.08] text-white/60 font-semibold flex items-center gap-1.5 transition-colors text-[11px] cursor-pointer"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Mark Solved</span>
                        </button>
                        <button
                          onClick={() => handleDecline(item)}
                          className="px-3 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white/55 hover:text-white font-semibold transition-colors text-[11px] cursor-pointer"
                        >
                          Decline
                        </button>
                      </>
                    )}

                    {/* Remind — throttled to 1 per 24h server-side (low noise). */}
                    {item.status === "pending" && (
                      <button
                        onClick={() => handleRemind(item)}
                        disabled={remindId === item.id}
                        className="px-3 py-1.5 rounded-full bg-white/[0.04] hover:bg-[#ff9f0a]/15 hover:text-[#ff9f0a] hover:border-[#ff9f0a]/30 border border-white/[0.08] text-white/60 font-semibold flex items-center gap-1.5 transition-colors text-[11px] cursor-pointer disabled:opacity-40"
                        title={
                          item.reminded_at
                            ? `Last nudged ${new Date(item.reminded_at).toLocaleDateString()} — one nudge per 24h`
                            : "Nudge them (once per 24h)"
                        }
                      >
                        <BellRing className="w-3 h-3" />
                        <span>{remindId === item.id ? "…" : "Remind"}</span>
                      </button>
                    )}

                    {/* Pass it on — anyone holding a challenge can forward it (chains). */}
                    {item.status === "pending" && (
                      <button
                        onClick={() => handlePass(item)}
                        className="px-3 py-1.5 rounded-full bg-white/[0.04] hover:bg-[#bf5af2]/15 hover:text-[#bf5af2] hover:border-[#bf5af2]/30 border border-white/[0.08] text-white/60 font-semibold flex items-center gap-1.5 transition-colors text-[11px] cursor-pointer"
                        title="Forward to another squad mate"
                      >
                        <Forward className="w-3 h-3" />
                        <span>Pass</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleCopyLink(item)}
                      className="p-1.5 rounded-full text-white/55 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                      title="Copy challenge link (nudge them on WhatsApp)"
                    >
                      {copiedLinkId === item.id ? <Check className="w-3.5 h-3.5 text-[#30d158]" /> : <Link2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <ProblemLink slug={item.problem_slug} variant="pill" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Challenge Modal ── */}
      {isModalOpen && (
        <ModalShell
          label="Challenge a friend"
          onClose={() => { setCreateError(null); setIsModalOpen(false); }}
          panelClassName="shadow-modal p-6"
        >
            <h2 className="text-xl font-bold text-white mb-1">{passParent ? "Pass the Challenge" : "Challenge a Friend"}</h2>
            <p className="text-xs text-white/55 mb-5">
              {passParent
                ? `Forwarding @${passParent.from_profile?.username || "a squad mate"}'s ${passParent.problem_title} challenge — the chain grows.`
                : "I solved X → I challenge you to solve X. Async by default; no spoiler unless you say so."}
            </p>

            {createError && (
              <div role="alert" className="mb-4 px-4 py-2.5 rounded-xl bg-[#ff453a]/10 border border-[#ff453a]/30 text-[#ff453a] text-xs font-medium">
                {createError}
              </div>
            )}

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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="flex items-center gap-2 text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-1.5 pl-1 cursor-pointer">
                    <input type="checkbox" checked={beatTime} onChange={(e) => setBeatTime(e.target.checked)} className="accent-[#fa586a]" />
                    <span>Beat my time</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={myTime}
                      onChange={(e) => setMyTime(e.target.value)}
                      placeholder="21:43"
                      disabled={!beatTime}
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl p-2.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-[#fa586a]/60 font-mono disabled:opacity-40"
                    />
                    {beatTime && (
                      <button type="button" onClick={fillLatestTime} className="text-[11px] text-[#fa586a] font-semibold hover:underline shrink-0 cursor-pointer">
                        My latest
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-1.5 pl-1">
                    Deadline (Optional)
                  </label>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#fa586a]/60"
                  />
                </div>
              </div>

              <label className="flex items-start gap-2.5 text-[11px] text-white/55 cursor-pointer">
                <input
                  type="checkbox"
                  checked={spoiler}
                  onChange={(e) => setSpoiler(e.target.checked)}
                  className="accent-[#fa586a] mt-0.5"
                />
                <span>
                  <span className="text-white/60 font-semibold">Mark as a spoiler</span>
                  <br />
                  Off by default. When on, your note stays hidden until the challenge is
                  accepted — a challenge should invite thinking, not copy an answer.
                </span>
              </label>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => { setCreateError(null); setPassParent(null); setIsModalOpen(false); }}
                  className="px-4 py-2 rounded-full bg-white/[0.04] text-white/50 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-full btn-accent text-white text-xs font-semibold shadow-glow transition-all disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? "Sending..." : "Send Challenge"}
                </button>
              </div>
            </form>
        </ModalShell>
      )}
    </div>
  );
}
