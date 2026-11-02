"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { ChevronDown, Plus } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useSolving } from "@/components/providers/SolvingProvider";
import { DiscussComposer } from "@/components/feed/DiscussComposer";
import { FeedComposer } from "@/components/feed/FeedComposer";
import { FeedEventCard, timeAgo, type ProblemMeta } from "@/components/feed/FeedEventCard";
import { DiscussionCard } from "@/components/feed/DiscussionCard";
import {
  SquadWeekBanner,
  SquadWeekRail,
  useSquadPulse,
  type WeekStats,
} from "@/components/feed/SquadWeekRail";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState, ErrorCard } from "@/components/ui/States";
import { FeedListSkeleton, FeedSkeleton } from "@/components/skeletons/FeedSkeleton";
import { UnderlineTabs } from "@/components/ui/ProblemRow";
import {
  getDiscussions,
  getPlatformPosts,
  getRankedFeed,
  getMyLoggedSolveCount,
  type Discussion,
  type PlatformPost,
  type RankedFeedEvent,
} from "@/lib/data/feed";
import { getCatalogBySlugs } from "@/lib/data/problems";
import { dataErrorMessage } from "@/lib/data/errors";
import { type FeedScope } from "@/lib/feedPolicy";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { useCachedQuery, useInvalidate } from "@/lib/cache/query";

const PAGE_SIZE = 20;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const TAB_LABELS = ["Squad", "Following", "Global", "Updates"] as const;
type TabLabel = (typeof TAB_LABELS)[number];
const TAB_TO_SCOPE: Record<TabLabel, FeedScope> = {
  Squad: "squad",
  Following: "following",
  Global: "global",
  Updates: "platform",
};
const SCOPE_TO_TAB: Record<FeedScope, TabLabel> = {
  squad: "Squad",
  following: "Following",
  global: "Global",
  platform: "Updates",
};

// Stable empty values: a fresh [] per render would re-run every memo.
const NO_EVENTS: RankedFeedEvent[] = [];
const NO_PLATFORM: PlatformPost[] = [];
const NO_DISCUSSIONS: Discussion[] = [];
const NO_CATALOG_ROWS: Awaited<ReturnType<typeof getCatalogBySlugs>> = [];

/** Rail counts: the squad scope only, and only the last seven days of it. */
function weekStats(rows: RankedFeedEvent[]): WeekStats {
  const since = Date.now() - WEEK_MS;
  const week = rows.filter((e) => new Date(e.created_at).getTime() >= since);
  const count = (...types: string[]) => week.filter((e) => types.includes(e.event_type)).length;
  return {
    solves: count("solve", "solved"),
    challengesSent: count("challenge"),
    challengesDone: count("complete", "completed"),
    approaches: count("teach"),
    stuck: count("stuck"),
  };
}

export default function FeedPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const { activeProblem } = useSolving();
  const invalidate = useInvalidate();
  const [tab, setTab] = useState<FeedScope>("squad");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [composerOpen, setComposerOpen] = useState(false);
  const [discussOpen, setDiscussOpen] = useState(false);

  const squadId = profile?.active_squad_id ?? null;
  const pulse = useSquadPulse(squadId);
  const noSquad = tab === "squad" && !squadId;

  // Every read below goes through the client cache (lib/cache/query.tsx): a
  // revisit renders from cache at once and refreshes in the background; the
  // skeleton only shows on the very first load.

  // Feed rows for the active scope. Platform is a separate read (announcements
  // are not activity), so this query is off on that tab and with no squad.
  const feedQuery = useCachedQuery(
    tab !== "platform" && !noSquad ? ["ranked-feed", tab, squadId, 40] : null,
    () => getRankedFeed(tab as Exclude<FeedScope, "platform">, { squadId, limit: 40 }),
    { freshForMs: 10_000 }
  );
  const events = feedQuery.data ?? NO_EVENTS;

  // The rail's week counts always describe the squad scope, even while another
  // tab is open. Same key as the squad tab, so the two share one request.
  const squadEventsQuery = useCachedQuery(
    squadId ? ["ranked-feed", "squad", squadId, 40] : null,
    () => getRankedFeed("squad", { squadId, limit: 40 }),
    { freshForMs: 10_000 }
  );
  const squadEvents = squadEventsQuery.data ?? NO_EVENTS;

  const platformQuery = useCachedQuery(
    tab === "platform" ? ["platform-posts"] : null,
    getPlatformPosts
  );
  const platform = platformQuery.data ?? NO_PLATFORM;

  const discussionsQuery = useCachedQuery(
    tab !== "platform" && !noSquad ? ["discussions", squadId, 10] : null,
    () => getDiscussions({ problemSlug: null, squadId, limit: 10 }),
    { freshForMs: 10_000 }
  );
  const discussions = discussionsQuery.data ?? NO_DISCUSSIONS;

  // Catalog facts (number, title, difficulty) for the slugs on screen. Best
  // effort: a failed lookup leaves rows exactly as the event describes them.
  const catalogSlugs = useMemo(
    () => Array.from(new Set(events.map((e) => e.problem_slug).filter((s): s is string => !!s))).sort(),
    [events]
  );
  const catalogQuery = useCachedQuery(
    catalogSlugs.length > 0 ? ["catalog-by-slugs", catalogSlugs.join(",")] : null,
    () => getCatalogBySlugs(catalogSlugs),
    { freshForMs: 10 * 60_000 }
  );
  const catalogRows = catalogQuery.data ?? NO_CATALOG_ROWS;
  const catalog = useMemo(
    () =>
      new Map<string, ProblemMeta>(
        catalogRows.map(
          (r) =>
            [
              r.title_slug,
              {
                title: r.title,
                number: r.question_id ? String(r.question_id) : null,
                difficulty: r.difficulty ?? null,
              },
            ] as const
        )
      ),
    [catalogRows]
  );

  // The Discuss composer needs the caller's logged solve count; read it only
  // while that modal is open and keep it cached for the next opening.
  const solveCountQuery = useCachedQuery(
    discussOpen ? ["my-logged-solve-count"] : null,
    getMyLoggedSolveCount
  );
  const solveCount = solveCountQuery.data ?? 0;

  const loading =
    tab === "platform"
      ? platformQuery.isLoading
      : noSquad
        ? false
        : feedQuery.isLoading || discussionsQuery.isLoading;

  const activeError = tab === "platform" ? platformQuery.error : feedQuery.error;
  const activeData = tab === "platform" ? platformQuery.data : feedQuery.data;
  const loadError =
    activeError && activeData === undefined
      ? dataErrorMessage(activeError, "Couldn't load feed. Retry.")
      : null;

  const handleRetry = () => {
    void feedQuery.refresh();
    void squadEventsQuery.refresh();
    void platformQuery.refresh();
    void discussionsQuery.refresh();
    void catalogQuery.refresh();
  };

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [tab]);

  // Analytics, not a read: one view event per tab load, including cache hits.
  useEffect(() => {
    if (tab === "platform" || feedQuery.data === undefined) return;
    track("feed_view", { scope: tab, rows: feedQuery.data.length });
  }, [tab, feedQuery.data]);

  const openComposer = () => {
    track("composer_opened", { surface: "feed" });
    setComposerOpen(true);
  };

  const visibleEvents = events.slice(0, visibleCount);
  const stats = useMemo(() => weekStats(squadEvents), [squadEvents]);
  const squadLabel = pulse.name ?? "your squad";

  if (authLoading) return <FeedSkeleton />;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="type-display-md text-text-primary max-md:text-[28px] max-md:leading-[31px]">
          Feed
        </h1>
        <p className="mt-1 text-xs text-text-secondary md:text-[15px] md:leading-6">
          What {squadLabel} has been up to.
        </p>
        <div className="mt-4 md:mt-5">
          <UnderlineTabs
            tabs={TAB_LABELS}
            value={SCOPE_TO_TAB[tab]}
            onChange={(v) => setTab(TAB_TO_SCOPE[v as TabLabel])}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_240px] lg:gap-8 xl:grid-cols-[minmax(0,680px)_minmax(0,1fr)]">
        <section aria-label="Activity feed" className="flex min-w-0 flex-col gap-3 md:gap-4">
          {squadId && <SquadWeekBanner squadId={squadId} pulse={pulse} stats={stats} />}

          <div className="hidden items-center gap-3 rounded-lg border border-hairline bg-surface p-4 md:flex">
            <Avatar
              name={profile?.username ?? "You"}
              src={profile?.avatar_url}
              size="md"
              className="h-9 w-9"
            />
            <button
              type="button"
              onClick={openComposer}
              className="min-w-0 flex-1 truncate rounded-md border border-hairline bg-well px-4 py-2.5 text-left text-sm text-text-tertiary transition-colors hover:border-hairline-strong hover:text-text-secondary"
            >
              Share a solve, teach something, or ask for help…
            </button>
            <button
              type="button"
              onClick={openComposer}
              className="h-10 shrink-0 rounded-md border border-hairline bg-surface-raised px-4 text-sm font-medium text-text-primary transition-colors hover:border-hairline-strong hover:bg-surface-overlay active:scale-[0.98]"
            >
              Post
            </button>
          </div>

          {loadError && <ErrorCard message={loadError} onRetry={handleRetry} />}

          {loading ? (
            <FeedListSkeleton />
          ) : tab === "platform" ? (
            <div className="flex flex-col gap-3 md:gap-4">
              {platform.length === 0 ? (
                <EmptyState
                  heading="No announcements right now"
                  body="Contests, product changes and maintenance notices land here, nothing else does."
                />
              ) : (
                platform.map((p) => (
                  <article
                    key={p.id}
                    className="flex flex-col gap-1.5 rounded-lg border border-hairline bg-surface p-3 md:p-4"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-medium uppercase tracking-[0.06em] text-text-tertiary">
                        {p.kind}
                      </span>
                      {p.pinned && (
                        <span className="rounded-xs border border-primary/20 bg-primary-tint px-1.5 py-0.5 font-mono text-[11px] font-medium text-primary">
                          Pinned
                        </span>
                      )}
                      <span className="ml-auto text-xs text-text-tertiary">{timeAgo(p.created_at)}</span>
                    </div>
                    <p className="text-sm font-semibold text-text-primary">{p.title}</p>
                    <p className="whitespace-pre-wrap text-sm leading-6 text-text-secondary">
                      {p.body_md}
                    </p>
                    {p.href && (
                      <a
                        href={p.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-[44px] items-center self-start text-sm font-medium text-text-primary underline decoration-hairline-strong underline-offset-[3px] hover:decoration-text-primary md:min-h-0"
                      >
                        Open
                      </a>
                    )}
                  </article>
                ))
              )}
            </div>
          ) : noSquad ? (
            <EmptyState
              heading="Join or start a squad to see your people here"
              body="Solves, challenges and approaches from your squad land here on their own."
              action={
                <Link
                  href="/squad"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium leading-5 text-on-primary transition-colors hover:bg-primary-hover"
                >
                  Start a squad
                </Link>
              }
            />
          ) : events.length === 0 && discussions.length === 0 ? (
            <EmptyState
              heading={tab === "following" ? "Nobody followed yet" : "Quiet, for now"}
              body={
                tab === "following"
                  ? "Follow people from their profile to see their solves here."
                  : tab === "global"
                    ? "Nothing public yet. Global posts need a problem, a pattern, and something for the reader to try."
                    : "Solves, challenges, and completions land here on their own. Start today's battle."
              }
              action={
                <Link
                  href={tab === "following" ? "/leaderboard" : "/home"}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-surface-overlay px-4 text-sm font-medium leading-5 text-text-primary transition-colors hover:bg-[#272830]"
                >
                  {tab === "following" ? "Find people" : "Go to today's battle"}
                </Link>
              }
            />
          ) : (
            <div className="flex flex-col gap-3 md:gap-4">
              {visibleEvents.map((ev) => (
                <FeedEventCard
                  key={ev.id}
                  ev={ev}
                  meta={ev.problem_slug ? catalog.get(ev.problem_slug) : undefined}
                  viewerId={user?.id ?? null}
                  onChanged={() => void invalidate("ranked-feed", "discussions", "home-squad", "squad-pulse")}
                />
              ))}

              {visibleCount < events.length && (
                <div className="flex justify-center pt-1">
                  <button
                    type="button"
                    onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                    className="flex h-10 w-full items-center justify-center gap-1.5 rounded-md border border-hairline bg-surface-raised px-6 text-sm font-medium text-text-secondary transition-colors hover:border-hairline-strong hover:text-text-primary md:w-auto md:bg-transparent md:text-xs md:hover:bg-surface-raised"
                  >
                    Show older
                    <ChevronDown className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                  </button>
                </div>
              )}

              {discussions.length > 0 && (
                <>
                  {discussions.slice(0, visibleCount).map((d) => (
                    <DiscussionCard key={d.id} d={d} />
                  ))}
                </>
              )}
            </div>
          )}
        </section>

        {squadId && <SquadWeekRail squadId={squadId} pulse={pulse} stats={stats} />}
      </div>

      {/* Phones post from a floating button (Stitch mobile frame); it rides
          above the solve capsule while a battle is running. */}
      <button
        type="button"
        onClick={openComposer}
        aria-label="Post to feed"
        className={cn(
          "fixed right-4 z-40 flex h-12 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-on-primary shadow-[0_8px_24px_-8px_rgba(0,0,0,0.7)] transition-transform hover:bg-primary-hover active:scale-95 md:hidden",
          activeProblem
            ? "bottom-[calc(136px+env(safe-area-inset-bottom))]"
            : "bottom-[calc(80px+env(safe-area-inset-bottom))]"
        )}
      >
        <Plus className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        Post
      </button>

      {composerOpen && (
        <FeedComposer
          squadName={pulse.name}
          onClose={() => setComposerOpen(false)}
          onPosted={() => void invalidate("ranked-feed", "discussions", "home-squad", "squad-pulse")}
          onDiscuss={() => {
            setComposerOpen(false);
            setDiscussOpen(true);
          }}
        />
      )}

      {discussOpen && (
        <DiscussComposer
          squadId={squadId}
          solveCount={solveCount}
          onClose={() => setDiscussOpen(false)}
          onPosted={() => {
            track("discuss_posted", { visibility: "squad" });
            void invalidate("ranked-feed", "discussions", "home-squad", "squad-pulse");
          }}
        />
      )}
    </div>
  );
}
