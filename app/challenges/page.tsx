"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Plus, Play, Forward, BellRing } from "lucide-react";
import { copyText } from "@/lib/clipboard";
import {
  getSuggestions,
  markSuggestionCompleted,
  dismissSuggestion,
  acceptSuggestion,
  remindSuggestion,
} from "@/lib/data/suggestions";
import { getCatalogBySlugs } from "@/lib/data/problems";
import { logFeedEvent } from "@/lib/data/feed";
import { getSquadProfiles } from "@/lib/data/profiles";
import { orderChainOldestFirst } from "@/lib/chains";
import { useAuth } from "@/components/providers/AuthProvider";
import { useSolving } from "@/components/providers/SolvingProvider";
import { problemUrl } from "@/components/ui/ProblemLink";
import { ChallengeHeroSkeleton, ChallengeListSkeleton } from "@/components/skeletons/ChallengesSkeleton";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorCard } from "@/components/ui/States";
import { UnderlineTabs } from "@/components/ui/ProblemRow";
import { SendChallengeModal } from "@/components/modals/SendChallengeModal";
import { ChallengePass, type ProblemMeta } from "@/components/challenges/ChallengePass";
import { ChallengeRow, type RowAction } from "@/components/challenges/ChallengeRow";
import type { OverflowItem } from "@/components/practice/OverflowMenu";
import { Suggestion, Profile, Difficulty } from "@/types/database";
import { track } from "@/lib/analytics";
import { useCachedQuery, useInvalidate } from "@/lib/cache/query";

type TabKey = "all" | "for_you" | "sent" | "done";
const TABS = ["All", "For you", "Sent", "Done"] as const;
type TabLabel = (typeof TABS)[number];
const TAB_TO_KEY: Record<TabLabel, TabKey> = {
  All: "all",
  "For you": "for_you",
  Sent: "sent",
  Done: "done",
};

// Stable empty values: a fresh [] per render would re-run every memo.
const NO_SUGGESTIONS: Suggestion[] = [];
const NO_PROFILES: Profile[] = [];
const NO_CATALOG_ROWS: Awaited<ReturnType<typeof getCatalogBySlugs>> = [];

/** What the composer opens with: a fresh challenge, a URL prefill, or a pass-on. */
interface ComposerSeed {
  initialTo?: string;
  initialProblem?: { slug: string; title: string; difficulty: Difficulty };
  initialBeatSec?: number | null;
  passParent?: Suggestion | null;
}

export default function SuggestionsPage() {
  const { user, profile } = useAuth();
  const { startSolving } = useSolving();
  const invalidate = useInvalidate();
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [composer, setComposer] = useState<ComposerSeed | null>(null);
  const [remindId, setRemindId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  // ?to= / ?problem= / ?pass= prefill, applied once the data it may need is loaded.
  const [urlPrefill, setUrlPrefill] = useState<(ComposerSeed & { passId?: string }) | null>(null);

  // Every read below goes through the client cache (lib/cache/query.tsx): a
  // revisit renders from cache at once and refreshes in the background; the
  // skeleton only shows on the very first load.
  const suggestionsQuery = useCachedQuery(["suggestions"], getSuggestions, { freshForMs: 10_000 });
  const suggestions = suggestionsQuery.data ?? NO_SUGGESTIONS;

  const profilesQuery = useCachedQuery(["squad-profiles"], () => getSquadProfiles());
  const profiles = profilesQuery.data ?? NO_PROFILES;
  // Profiles must be in before the composer mounts, or its recipient default is empty.
  const profilesReady = profilesQuery.data !== undefined;

  const loading = suggestionsQuery.isLoading;
  const loadError =
    (suggestionsQuery.error && suggestionsQuery.data === undefined) ||
    (profilesQuery.error && profilesQuery.data === undefined)
      ? "Couldn't load challenges. Check your connection and retry."
      : null;
  const handleRetry = () => {
    void suggestionsQuery.refresh();
    void profilesQuery.refresh();
  };

  // Honor ?to=<user_id> (leaderboard), ?problem=&title=&difficulty=&time=
  // (post-solve "Challenge someone" on Today's Battle) and ?pass=<id> (the
  // /c/ page's "Pass it on") — the prefill path exists so no next action is
  // ever a dead form.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const to = params.get("to");
    const slug = params.get("problem");
    const title = params.get("title");
    const passId = params.get("pass");
    const seed: ComposerSeed & { passId?: string } = {};
    if (to) seed.initialTo = to;
    if (slug && title) {
      const d = params.get("difficulty");
      seed.initialProblem = {
        slug,
        title,
        difficulty: d === "Easy" || d === "Medium" || d === "Hard" ? d : "Medium",
      };
      // Prefill the beat-my-time target from the solve we just finished.
      const time = params.get("time");
      const secs = time ? Number.parseInt(time, 10) : NaN;
      if (Number.isFinite(secs) && secs >= 0) seed.initialBeatSec = secs;
    }
    if (passId) seed.passId = passId;
    if (to || (slug && title) || passId) setUrlPrefill(seed);
  }, []);

  // Apply the prefill once the load that may supply its parent has finished,
  // then clear it so a later reload does not reopen a closed composer.
  useEffect(() => {
    if (!urlPrefill || loading || !profilesReady || suggestionsQuery.data === undefined || !user?.id) return;
    const prefill = urlPrefill;
    const parent = prefill.passId ? suggestions.find((s) => s.id === prefill.passId) : undefined;
    setComposer(parent ? { passParent: parent } : prefill);
    setUrlPrefill(null);
  }, [urlPrefill, loading, profilesReady, suggestionsQuery.data, user?.id, suggestions]);

  // No. and pattern for every listed problem, one batched catalog read.
  // Decoration only: a failed lookup leaves them off.
  const slugKey = useMemo(
    () => Array.from(new Set(suggestions.map((s) => s.problem_slug))).sort().join(","),
    [suggestions]
  );
  const catalogQuery = useCachedQuery(
    slugKey ? ["catalog-by-slugs", slugKey] : null,
    () => getCatalogBySlugs(slugKey.split(",")),
    { freshForMs: 10 * 60_000 }
  );
  const catalogRows = catalogQuery.data ?? NO_CATALOG_ROWS;
  const catalog = useMemo(
    () =>
      new Map<string, ProblemMeta>(
        catalogRows.map(
          (r) =>
            [r.title_slug, { number: String(r.question_id), pattern: r.topics?.[0] ?? null }] as const
        )
      ),
    [catalogRows]
  );

  const openComposer = (seed: ComposerSeed = {}) => setComposer(seed);

  const handleStartSolvingChallenge = async (item: Suggestion) => {
    // Persist the accept so the sender sees it in progress and the battle can be
    // attached to the challenge (plan Step 10).
    try {
      const res = await acceptSuggestion(item.id, user?.id ?? "");
      if (res.ok) {
        void suggestionsQuery.refresh();
        void invalidate("challenges-for-slug");
      }
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
      await suggestionsQuery.refresh();
    } catch {
      setActionNotice("Couldn't send that reminder. Try again.");
    } finally {
      setRemindId(null);
    }
  };

  const handleDecline = async (item: Suggestion) => {
    try {
      const ok = await dismissSuggestion(item.id);
      if (ok) {
        await suggestionsQuery.setData((current) => (current ?? []).filter((s) => s.id !== item.id));
        void invalidate("incoming-suggestion-count", "first-incoming-challenge", "challenges-for-slug");
      }
    } catch {
      setActionNotice("Couldn't dismiss that challenge. Try again.");
    }
  };

  const handleCopyLink = async (item: Suggestion) => {
    if (await copyText(`${window.location.origin}/c/${item.id}`)) {
      setActionNotice("Challenge link copied.");
    }
  };

  // Pass the challenge along: prefill problem, link chain via parent_id.
  const handlePass = (item: Suggestion) => openComposer({ passParent: item });

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
      await suggestionsQuery.setData((current) =>
        (current ?? []).map((s) =>
          s.id === item.id ? { ...s, status: "completed", completed_at: new Date().toISOString() } : s
        )
      );
      void invalidate(
        "incoming-suggestion-count",
        "first-incoming-challenge",
        "challenges-for-slug",
        "ranked-feed",
        "home-squad",
        "slug-events",
        "problem-timeline"
      );
      try {
        const confetti = (await import("canvas-confetti")).default;
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.8 },
          colors: ["#F5B83D", "#3DDC97", "#8B91F7", "#EDEDEF"],
        });
      } catch {
        // ignore
      }
    } else if (res.reason === "not_solved") {
      setCompleteError("Mark the problem solved first (battle dock or roadmap), then mark complete. LeetCode sync only adds an evidence badge.");
    } else {
      setCompleteError("Only the challenged member can complete this.");
    }
  };

  /** One visible action per row (the one the row exists for); the rest go in ⋯. */
  const rowControls = (item: Suggestion): { action: RowAction; menu: OverflowItem[] } => {
    const isTarget = item.to_user === user?.id;
    const isSender = item.from_user === user?.id;
    const pending = item.status === "pending";
    const iconCls = "h-3.5 w-3.5";
    const solve: RowAction = {
      label: isTarget && pending ? "Accept" : "Solve in dock",
      icon: <Play className={iconCls} strokeWidth={1.5} aria-hidden />,
      onClick: () => handleStartSolvingChallenge(item),
      title: "Load into solve dock",
    };
    const remindTitle = item.reminded_at
      ? `Last nudged ${new Date(item.reminded_at).toLocaleDateString()}, one nudge per 24h`
      : "Nudge them (once per 24h)";
    const remind: RowAction = {
      label: remindId === item.id ? "…" : "Remind",
      icon: <BellRing className={iconCls} strokeWidth={1.5} aria-hidden />,
      onClick: () => handleRemind(item),
      disabled: remindId === item.id,
      title: remindTitle,
    };
    const action = isSender && pending && !isTarget ? remind : solve;

    const menu: OverflowItem[] = [];
    if (action !== solve) menu.push({ label: "Solve in dock", onSelect: solve.onClick });
    if (isTarget && pending) {
      menu.push({ label: "Mark solved", onSelect: () => handleMarkCompleted(item) });
      menu.push({ label: "Decline", onSelect: () => handleDecline(item) });
    }
    if (pending && action !== remind && remindId !== item.id) {
      menu.push({ label: "Remind", onSelect: () => handleRemind(item) });
    }
    if (pending) menu.push({ label: "Pass it on", onSelect: () => handlePass(item) });
    menu.push({ label: "Copy challenge link", onSelect: () => handleCopyLink(item) });
    menu.push({
      label: "Open on LeetCode",
      onSelect: () => window.open(problemUrl(item.problem_slug), "_blank", "noopener,noreferrer"),
    });
    return { action, menu };
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
  const tabLabel = (Object.keys(TAB_TO_KEY) as TabLabel[]).find((k) => TAB_TO_KEY[k] === activeTab) ?? "All";
  const tabCounts: Record<TabLabel, number> = {
    All: suggestions.length,
    "For you": forYouCount,
    Sent: sentCount,
    Done: doneCount,
  };

  return (
    <div className="space-y-8 md:space-y-10">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="type-display-md text-text-primary">Challenges</h1>
          <p className="mt-1 max-w-[240px] text-[13px] leading-5 text-text-secondary sm:max-w-none md:text-[15px] md:leading-6">
            Friendly 1v1s. Solve it, beat their time, pass it on.
          </p>
        </div>
        <Button
          variant="secondary"
          className="h-11 shrink-0 border border-hairline px-3 md:h-10 md:px-4"
          onClick={() => openComposer()}
        >
          <Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden />
          New challenge
        </Button>
      </div>

      {loadError && <ErrorCard message={loadError} onRetry={handleRetry} />}

      {openForYou ? (
        <ChallengePass
          item={openForYou}
          viewerId={user?.id}
          meta={catalog.get(openForYou.problem_slug)}
          // The inbox hero is always addressed to the viewer, who may read the note.
          noteVisible={!(openForYou.spoiler && openForYou.to_user !== user?.id)}
          lockedCopy="A hint unlocks when you finish."
          actions={
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
              <Button
                variant="primary"
                size="lg"
                className="w-full font-semibold md:w-auto"
                onClick={() => handleStartSolvingChallenge(openForYou)}
              >
                <Play className="h-4 w-4" strokeWidth={1.5} fill="currentColor" aria-hidden />
                Accept challenge
              </Button>
              <div className="grid grid-cols-2 gap-2 md:contents">
                <Button
                  variant="secondary"
                  className="h-11 border border-hairline bg-transparent max-md:text-[13px] md:h-12 md:bg-surface-overlay md:px-5"
                  onClick={() => handlePass(openForYou)}
                >
                  <Forward className="h-4 w-4 text-text-secondary" strokeWidth={1.5} aria-hidden />
                  Pass it on
                </Button>
                <Button
                  variant="ghost"
                  className="h-11 border border-hairline text-text-tertiary max-md:text-[13px] md:ml-auto md:h-12 md:border-transparent"
                  onClick={() => handleDecline(openForYou)}
                >
                  Not now
                </Button>
              </div>
            </div>
          }
        />
      ) : loading ? (
        <ChallengeHeroSkeleton />
      ) : (
        <div className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold leading-[26px] text-text-primary">
              No open challenges for you
            </h2>
            <p className="mt-1 text-sm leading-6 text-text-secondary">
              Send one to someone in your squad.
            </p>
          </div>
          <Button variant="secondary" onClick={() => openComposer()}>
            New challenge
          </Button>
        </div>
      )}

      <div className="space-y-4">
        <UnderlineTabs
          tabs={TABS}
          counts={tabCounts}
          value={tabLabel}
          onChange={(v) => {
            const base = (Object.keys(TAB_TO_KEY) as TabLabel[]).find((k) => k === v);
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
          <ChallengeListSkeleton />
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
          <div className="space-y-3 md:space-y-2">
            {filteredList.map((item) => {
              const { action, menu } = rowControls(item);
              return (
                <ChallengeRow
                  key={item.id}
                  item={item}
                  viewerId={user?.id}
                  meta={catalog.get(item.problem_slug)}
                  lineage={item.parent_id ? orderChainOldestFirst(suggestions, item.id) : []}
                  action={action}
                  menu={menu}
                />
              );
            })}
          </div>
        )}
      </div>

      {composer && profilesReady && (
        <SendChallengeModal
          // Remount per opening so a pass-on never inherits a previous draft.
          key={composer.passParent?.id ?? `new-${composer.initialTo ?? ""}-${composer.initialProblem?.slug ?? ""}`}
          profiles={profiles}
          initialTo={composer.initialTo}
          initialProblem={composer.initialProblem}
          initialBeatSec={composer.initialBeatSec}
          passParent={composer.passParent}
          onClose={() => setComposer(null)}
          onSent={(s) => {
            void suggestionsQuery.setData((current) => [s, ...(current ?? [])]);
            void invalidate("challenges-for-slug", "ranked-feed", "home-squad");
          }}
        />
      )}
    </div>
  );
}
