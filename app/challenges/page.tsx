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
  Lock,
  X,
} from "lucide-react";
import confetti from "canvas-confetti";
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
import { DifficultyBadgeNew } from "@/components/ui/Badge";
import { ProblemLink } from "@/components/ui/ProblemLink";
import { ModalShell } from "@/components/ui/ModalShell";
import { PageLoader } from "@/components/ui/PageLoader";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorCard } from "@/components/ui/States";
import { UnderlineTabs } from "@/components/ui/ProblemRow";
import { Pass, PassSerial } from "@/components/pass/Pass";
import { Avatar } from "@/components/ui/Avatar";
import { Suggestion, Profile, Difficulty } from "@/types/database";
import { track } from "@/lib/analytics";

type TabKey = "all" | "for_you" | "sent" | "done";
const TABS = ["All", "For you", "Sent", "Done"] as const;
type TabLabel = (typeof TABS)[number];
const TAB_TO_KEY: Record<TabLabel, TabKey> = {
  All: "all",
  "For you": "for_you",
  Sent: "sent",
  Done: "done",
};

export default function SuggestionsPage() {
  const { user, profile } = useAuth();
  const { startSolving } = useSolving();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("all");
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
          colors: ["#F5B83D", "#3DDC97", "#8B91F7", "#EDEDEF"],
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
        colors: ["#F5B83D", "#3DDC97", "#8B91F7", "#EDEDEF"],
      });
    } else if (res.reason === "not_solved") {
      setCompleteError("Mark the problem solved first (battle dock or roadmap), then mark complete. LeetCode sync only adds an evidence badge.");
    } else {
      setCompleteError("Only the challenged member can complete this.");
    }
  };

  const filteredList = suggestions.filter((s) => {
    if (activeTab === "for_you") return s.to_user === user?.id && s.status !== "completed";
    if (activeTab === "sent") return s.from_user === user?.id;
    if (activeTab === "done") return s.status === "completed";
    return true;
  });

  const forYouCount = suggestions.filter((s) => s.to_user === user?.id && s.status === "pending").length;
  const sentCount = suggestions.filter((s) => s.from_user === user?.id).length;
  const doneCount = suggestions.filter((s) => s.status === "completed").length;
  const openForYou =
    suggestions.find((s) => s.to_user === user?.id && s.status === "pending") ?? null;
  const eligibleRecipientProfiles = profiles.filter((p) => p.id !== user?.id);
  const tabLabel = (Object.keys(TAB_TO_KEY) as TabLabel[]).find((k) => TAB_TO_KEY[k] === activeTab) ?? "All";

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="type-display-md text-text-primary">Challenges</h1>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            Friendly 1v1s. Solve it, beat their time, pass it on.
          </p>
        </div>

        {!openForYou && (
          <span className="self-start md:self-auto">
            <Button
              variant="secondary"
              onClick={() => {
                setCreateError(null);
                setPassParent(null);
                setIsModalOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
              New challenge
            </Button>
          </span>
        )}
        {openForYou && (
          <span className="self-start md:self-auto">
            <Button
              variant="secondary"
              onClick={() => {
                setCreateError(null);
                setPassParent(null);
                setIsModalOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
              New challenge
            </Button>
          </span>
        )}
      </div>

      {loadError && <ErrorCard message={loadError} onRetry={() => void loadData()} />}

      {openForYou ? (
        <Pass
          body={
            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <Avatar
                  name={openForYou.from_profile?.username ?? "Challenger"}
                  src={openForYou.from_profile?.avatar_url}
                  size="md"
                />
                <p className="type-title text-text-primary">
                  {openForYou.from_profile?.username
                    ? `@${openForYou.from_profile.username} challenged you`
                    : "You were challenged"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="type-title text-text-primary">{openForYou.problem_title}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <DifficultyBadgeNew difficulty={openForYou.difficulty} />
                <span className="font-mono text-sm text-text-tertiary tnum">
                  No. {openForYou.problem_slug}
                </span>
              </div>
              {openForYou.sender_time_sec != null ? (
                <p className="type-mono-display text-text-primary">
                  Beat {fmtTime(openForYou.sender_time_sec)}
                </p>
              ) : (
                <p className="type-mono-display text-text-primary">Open</p>
              )}
              {openForYou.note && !(openForYou.spoiler && openForYou.to_user !== user?.id) && (
                <p className="text-sm leading-6 text-text-secondary">
                  &ldquo;{openForYou.note}&rdquo;
                </p>
              )}
              {openForYou.spoiler && openForYou.to_user !== user?.id && (
                <p className="flex items-center gap-1.5 text-sm text-text-tertiary">
                  <Lock className="h-3.5 w-3.5" strokeWidth={1.5} />
                  A hint unlocks when you finish.
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="primary" size="lg" onClick={() => handleStartSolvingChallenge(openForYou)}>
                  Accept challenge
                </Button>
                <Button variant="ghost" onClick={() => handlePass(openForYou)}>
                  Pass it on
                </Button>
                <Button variant="ghost" onClick={() => handleDecline(openForYou)}>
                  Not now
                </Button>
              </div>
            </div>
          }
          stub={
            <>
              <PassSerial>From @{openForYou.from_profile?.username ?? "squad"}</PassSerial>
              <PassSerial>To @{openForYou.to_profile?.username ?? "you"}</PassSerial>
              <PassSerial>
                {openForYou.deadline_at
                  ? `Due ${new Date(openForYou.deadline_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
                  : "No deadline"}
              </PassSerial>
              <PassSerial>Open</PassSerial>
            </>
          }
        />
      ) : (
        !loading && (
          <div className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold leading-[26px] text-text-primary">
                No open challenges for you
              </h2>
              <p className="mt-1 text-sm leading-6 text-text-secondary">
                Send one to someone in your squad.
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                setCreateError(null);
                setPassParent(null);
                setIsModalOpen(true);
              }}
            >
              New challenge
            </Button>
          </div>
        )
      )}

      <UnderlineTabs
        tabs={TABS.map((t) =>
          t === "All"
            ? `All ${suggestions.length}`
            : t === "For you"
              ? `For you ${forYouCount}`
              : t === "Sent"
                ? `Sent ${sentCount}`
                : `Done ${doneCount}`
        )}
        value={`${tabLabel} ${tabLabel === "All" ? suggestions.length : tabLabel === "For you" ? forYouCount : tabLabel === "Sent" ? sentCount : doneCount}`}
        onChange={(v) => {
          const base = (Object.keys(TAB_TO_KEY) as TabLabel[]).find((k) => v.startsWith(k));
          if (base) setActiveTab(TAB_TO_KEY[base]);
        }}
      />

      {completeError && (
        <div role="alert" className="card border-error/30 bg-error-tint">
          <p className="text-sm text-error">{completeError}</p>
        </div>
      )}
      {actionNotice && (
        <div role="status" className="card">
          <p className="text-sm text-text-secondary">{actionNotice}</p>
        </div>
      )}
      {loading ? (
        <PageLoader label="Loading challenges..." className="h-60" />
      ) : filteredList.length === 0 ? (
        <EmptyState
          heading="Nothing here yet"
          body={
            activeTab === "for_you"
              ? "No challenges waiting for you. Solve a battle and challenge a friend, theirs will land here."
              : "No challenges yet. Solve a battle and challenge a friend to start your squad loop."
          }
          action={
            <Link
              href="/home"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-surface-overlay px-4 text-sm font-medium leading-5 text-text-primary transition-colors hover:bg-[#272830]"
            >
              Start a battle
            </Link>
          }
        />
      ) : (
        <div className="mx-auto w-full max-w-reading space-y-3">
          {filteredList.map((item) => {
            const isTarget = item.to_user === user?.id;
            const isCompleted = item.status === "completed";

            return (
              <div
                key={item.id}
                className="rounded-xl border border-hairline bg-surface p-4"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5 text-sm text-text-secondary">
                      <span className="truncate font-medium text-text-primary">
                        @{item.from_profile?.username || "Member"}
                      </span>
                      <ArrowRight className="h-3 w-3 shrink-0" strokeWidth={1.5} />
                      <span className="truncate font-medium text-text-primary">
                        @{item.to_profile?.username || "Member"}
                      </span>
                      {isTarget && (
                        <span className="shrink-0 rounded-full bg-surface-overlay px-1.5 py-0.5 text-xs font-medium text-text-primary">
                          You
                        </span>
                      )}
                    </div>

                    {isCompleted ? (
                      <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-verified">
                        <CheckCircle2 className="h-3 w-3" strokeWidth={1.5} />
                        <span>Solved</span>
                      </span>
                    ) : (
                      <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-text-secondary">
                        <Clock className="h-3 w-3" strokeWidth={1.5} />
                        <span>Pending</span>
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-medium text-text-primary">{item.problem_title}</h3>
                    <DifficultyBadgeNew difficulty={item.difficulty} />
                    {item.sender_time_sec != null && (
                      <span className="font-mono text-xs text-text-secondary tnum">
                        {item.beat_time ? `Beat ${fmtTime(item.sender_time_sec)}` : `Solved in ${fmtTime(item.sender_time_sec)}`}
                      </span>
                    )}
                    {item.deadline_at && item.status === "pending" && (
                      <span className="font-mono text-xs text-text-tertiary tnum">
                        due {new Date(item.deadline_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {item.note && !(item.spoiler && !isTarget && !isCompleted) && (
                    <div className="mt-3 rounded-lg border border-hairline bg-well p-3 text-sm leading-6 text-text-secondary">
                      &ldquo;{item.note}&rdquo;
                    </div>
                  )}
                  {item.spoiler && !isTarget && !isCompleted && (
                    <div className="mt-3 flex items-center gap-1.5 rounded-lg border border-hairline bg-well p-3 text-sm text-text-tertiary">
                      <Lock className="h-3.5 w-3.5" strokeWidth={1.5} />
                      Hidden hint, reveals when accepted.
                    </div>
                  )}
                  {item.parent_id && (
                    <Link href={`/c/${item.id}`} className="mt-2 inline-flex min-h-[44px] items-center text-sm font-medium text-text-primary underline decoration-hairline-strong underline-offset-[3px] hover:decoration-text-primary md:min-h-0">
                      View challenge chain
                    </Link>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between gap-2 border-t border-hairline pt-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={() => handleStartSolvingChallenge(item)}
                      className="flex min-h-[44px] items-center gap-1.5 rounded-md px-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary md:min-h-0 md:h-10"
                      title="Load into solve dock"
                    >
                      <Play className="h-3 w-3" strokeWidth={1.5} />
                      <span>{isTarget && !isCompleted ? "Accept and solve" : "Solve in dock"}</span>
                    </button>

                    {isTarget && !isCompleted && item.status === "pending" && (
                      <>
                        <button
                          onClick={() => handleMarkCompleted(item)}
                          className="flex min-h-[44px] items-center gap-1.5 rounded-md px-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary md:min-h-0 md:h-10"
                        >
                          <CheckCircle2 className="h-3 w-3" strokeWidth={1.5} />
                          <span>Mark solved</span>
                        </button>
                        <button
                          onClick={() => handleDecline(item)}
                          className="flex min-h-[44px] items-center rounded-md px-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary md:min-h-0 md:h-10"
                        >
                          Decline
                        </button>
                      </>
                    )}

                    {item.status === "pending" && (
                      <button
                        onClick={() => handleRemind(item)}
                        disabled={remindId === item.id}
                        className="flex min-h-[44px] items-center gap-1.5 rounded-md px-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary disabled:opacity-40 md:min-h-0 md:h-10"
                        title={
                          item.reminded_at
                            ? `Last nudged ${new Date(item.reminded_at).toLocaleDateString()}, one nudge per 24h`
                            : "Nudge them (once per 24h)"
                        }
                      >
                        <BellRing className="h-3 w-3" strokeWidth={1.5} />
                        <span>{remindId === item.id ? "…" : "Remind"}</span>
                      </button>
                    )}

                    {item.status === "pending" && (
                      <button
                        onClick={() => handlePass(item)}
                        className="flex min-h-[44px] items-center gap-1.5 rounded-md px-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary md:min-h-0 md:h-10"
                        title="Forward to another squad mate"
                      >
                        <Forward className="h-3 w-3" strokeWidth={1.5} />
                        <span>Pass</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleCopyLink(item)}
                      className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary md:min-h-0 md:min-w-0 md:p-2"
                      title="Copy challenge link"
                      aria-label="Copy challenge link"
                    >
                      {copiedLinkId === item.id ? <Check className="h-3.5 w-3.5" strokeWidth={1.5} /> : <Link2 className="h-3.5 w-3.5" strokeWidth={1.5} />}
                    </button>
                  </div>

                  <ProblemLink slug={item.problem_slug} variant="pill" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isModalOpen && (
        <ModalShell
          label="Challenge someone"
          onClose={() => { setCreateError(null); setIsModalOpen(false); }}
          maxWidthClass="max-w-[560px]"
        >
            <div className="mb-1 flex items-start justify-between gap-3">
              <h2 className="font-display text-2xl font-semibold tracking-tight text-text-primary">{passParent ? "Pass it on" : "Challenge someone"}</h2>
              <button
                onClick={() => { setCreateError(null); setIsModalOpen(false); }}
                aria-label="Close"
                className="inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-md text-text-secondary hover:bg-surface-overlay hover:text-text-primary"
              >
                <X className="h-5 w-5" strokeWidth={1.5} />
              </button>
            </div>
            <p className="mb-5 text-xs leading-5 text-text-secondary">
              {passParent
                ? `Forwarding @${passParent.from_profile?.username || "a squad mate"}'s ${passParent.problem_title} challenge — the chain grows.`
                : "Pick a squad mate and a problem. They get the problem, not your solution."}
            </p>

            {createError && (
              <div role="alert" className="mb-4 rounded-md border border-error/30 bg-error-tint px-3 py-2 text-xs leading-5 text-error">
                {createError}
              </div>
            )}

            <form onSubmit={handleSendChallenge} className="space-y-4">
              <div>
                <label className="mb-1.5 block pl-1 text-sm font-medium text-text-secondary">
                  Squad member
                </label>
                <select
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  className="h-10 min-h-[44px] w-full rounded-md border border-hairline bg-well px-3 text-sm text-text-primary focus:border-hairline-strong focus:outline-none md:min-h-0"
                >
                  {(eligibleRecipientProfiles.length > 0 ? eligibleRecipientProfiles : profiles).map((p) => (
                    <option key={p.id} value={p.id} className="bg-surface text-text-primary">
                      @{p.username} {p.leetcode_username ? `(${p.leetcode_username})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block pl-1 text-sm font-medium text-text-secondary">
                  Problem title
                </label>
                <input
                  type="text"
                  value={problemTitle}
                  onChange={(e) => setProblemTitle(e.target.value)}
                  placeholder="e.g. Word Ladder or Course Schedule"
                  className="h-10 min-h-[44px] w-full rounded-md border border-hairline bg-well px-3 text-sm text-text-primary placeholder:text-text-disabled focus:border-hairline-strong focus:outline-none md:min-h-0"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block pl-1 text-sm font-medium text-text-secondary">
                    Problem slug
                  </label>
                  <input
                    type="text"
                    value={problemSlug}
                    onChange={(e) => setProblemSlug(e.target.value)}
                    placeholder="e.g. word-ladder"
                    className="h-10 min-h-[44px] w-full rounded-md border border-hairline bg-well px-3 font-mono text-sm text-text-primary placeholder:text-text-disabled focus:border-hairline-strong focus:outline-none md:min-h-0"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block pl-1 text-sm font-medium text-text-secondary">
                    Difficulty
                  </label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                    className="h-10 min-h-[44px] w-full rounded-md border border-hairline bg-well px-3 text-sm text-text-primary focus:border-hairline-strong focus:outline-none md:min-h-0"
                  >
                    <option value="Easy" className="bg-surface text-text-primary">Easy</option>
                    <option value="Medium" className="bg-surface text-text-primary">Medium</option>
                    <option value="Hard" className="bg-surface text-text-primary">Hard</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block pl-1 text-sm font-medium text-text-secondary">
                  Note
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Took me two tries. Think hard about the visited set."
                  rows={3}
                  className="w-full rounded-md border border-hairline bg-well p-2.5 text-sm text-text-primary placeholder:text-text-disabled focus:border-hairline-strong focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 flex min-h-[44px] cursor-pointer items-center gap-2 pl-1 text-sm font-medium text-text-secondary md:min-h-0">
                    <input type="checkbox" checked={beatTime} onChange={(e) => setBeatTime(e.target.checked)} className="accent-primary" />
                    <span>Beat my time</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={myTime}
                      onChange={(e) => setMyTime(e.target.value)}
                      placeholder="21:43"
                      disabled={!beatTime}
                      className="h-10 min-h-[44px] w-full rounded-md border border-hairline bg-well px-3 font-mono text-sm text-text-primary placeholder:text-text-disabled focus:border-hairline-strong focus:outline-none disabled:opacity-40 md:min-h-0"
                    />
                    {beatTime && (
                      <button type="button" onClick={fillLatestTime} className="flex min-h-[44px] shrink-0 items-center text-sm font-medium text-text-primary underline decoration-hairline-strong underline-offset-[3px] hover:decoration-text-primary md:min-h-0">
                        My latest
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block pl-1 text-sm font-medium text-text-secondary">
                    Deadline
                  </label>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="h-10 min-h-[44px] w-full rounded-md border border-hairline bg-well px-3 text-sm text-text-primary focus:border-hairline-strong focus:outline-none md:min-h-0"
                  />
                </div>
              </div>

              <label className="flex cursor-pointer items-start gap-2.5 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={spoiler}
                  onChange={(e) => setSpoiler(e.target.checked)}
                  className="mt-1 accent-primary"
                />
                <span>
                  <span className="font-medium text-text-primary">Hide the note until they finish</span>
                  <br />
                  Off by default. When on, your note stays hidden until the challenge is
                  accepted.
                </span>
              </label>

              <div className="flex justify-end gap-2 border-t border-hairline pt-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => { setCreateError(null); setPassParent(null); setIsModalOpen(false); }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={submitting}
                >
                  {submitting ? "Sending..." : "Send challenge"}
                </Button>
              </div>
            </form>
        </ModalShell>
      )}
    </div>
  );
}
