"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { DiscussComposer } from "@/components/feed/DiscussComposer";
import { FeedComposer } from "@/components/feed/FeedComposer";
import { Avatar } from "@/components/ui/Avatar";
import {
  VerifiedBadge,
  SelfReportedBadge,
  DifficultyBadgeNew,
  PatternChip,
} from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorCard, Skeleton } from "@/components/ui/States";
import { UnderlineTabs } from "@/components/ui/ProblemRow";
import {
  blockUser,
  createDiscussionReply,
  getDiscussions,
  getPlatformPosts,
  getRankedFeed,
  getDiscussionReplies,
  getMyLoggedSolveCount,
  reportFeedEvent,
  type Discussion,
  type PlatformPost,
  type RankedFeedEvent,
} from "@/lib/data/feed";
import { dataErrorMessage } from "@/lib/data/errors";
import { FEED_ACTIONS, actionabilityLabel, type FeedScope } from "@/lib/feedPolicy";
import { track } from "@/lib/analytics";

const PAGE_SIZE = 20;

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

const TYPE_LABEL: Record<string, string> = {
  solve: "solved",
  solved: "solved",
  challenge: "challenged",
  complete: "completed",
  completed: "completed",
  squad_milestone: "squad",
  stuck: "stuck",
  teach: "taught",
  resource: "shared",
  contest: "contest",
  improve: "improved",
  suggested: "suggested",
  streak: "streak",
  discuss: "discussed",
};

function timeAgo(iso: string): string {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function fmtClock(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

function metaDuration(ev: RankedFeedEvent): number | null {
  const v = ev.metadata?.duration_sec;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function metaPattern(ev: RankedFeedEvent): string | null {
  const v = ev.metadata?.pattern;
  return typeof v === "string" && v.length > 0 ? v : null;
}

function metaVerified(ev: RankedFeedEvent): boolean | null {
  const v = ev.metadata?.verified ?? ev.metadata?.evidence;
  if (v === true || v === "leetcode" || v === "verified") return true;
  if (v === false || v === "self" || v === "self-reported") return false;
  return null;
}

/** Optional one-line note the author added in the composer. Old rows have none. */
function metaCaption(ev: RankedFeedEvent): string | null {
  const v = ev.metadata?.caption;
  return typeof v === "string" && v.trim().length > 0 ? v.trim().slice(0, 280) : null;
}

function describe(ev: RankedFeedEvent): string {
  const who = ev.actor?.username ? `@${ev.actor.username}` : "Someone";
  switch (ev.event_type) {
    case "solve":
    case "solved": {
      const t = metaDuration(ev);
      return `${who} solved ${ev.problem_title || "a problem"}${t != null ? ` in ${fmtClock(t)}` : ""}`;
    }
    case "challenge":
      return `${who} sent a challenge${ev.problem_title ? `: ${ev.problem_title}` : ""}`;
    case "complete":
    case "completed":
      return `${who} completed a challenge${ev.problem_title ? `: ${ev.problem_title}` : ""}`;
    case "teach":
      return `${who} taught ${ev.problem_title || "an approach"}`;
    case "resource":
      return `${who} shared a resource${ev.problem_title ? `: ${ev.problem_title}` : ""}`;
    case "discuss":
      return `${who} started a discussion on ${ev.problem_title || ev.problem_slug || "a problem"}`;
    default:
      return `${who} · ${TYPE_LABEL[ev.event_type] || ev.event_type}`;
  }
}

/** §51 primitives on every row. Narrow by design — no moderation platform. */
function RowMenu({
  ev,
  onDone,
}: {
  ev: RankedFeedEvent;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const run = async (action: "report" | "block" | "delete") => {
    const spec = FEED_ACTIONS.find((a) => a.id === action);
    if (!spec) return;
    if (spec.confirm && !window.confirm(spec.confirm)) return;
    setBusy(true);
    setNote(null);
    try {
      if (action === "report") {
        await reportFeedEvent(ev.id, "noise");
        track("feed_reported", { event_type: ev.event_type });
        setNote("Reported. It leaves your feeds.");
      } else if (action === "block") {
        await blockUser(ev.user_id);
        track("feed_blocked", {});
        setNote("Blocked.");
      }
      setOpen(false);
      onDone();
    } catch (err) {
      setNote(dataErrorMessage(err, "That didn't work."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="More actions"
        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-surface-raised hover:text-text-primary md:min-h-0 md:min-w-0 md:p-1.5"
      >
        <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={1.5} />
      </button>
      {open && (
        <>
          <button
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div className="popover-panel absolute right-0 top-full z-20 mt-1 min-w-[9rem] p-1.5">
            {FEED_ACTIONS.map((a) => (
              <button
                key={a.id}
                disabled={busy}
                onClick={() => void run(a.id)}
                className="block min-h-[44px] w-full rounded-md px-3 py-2 text-left text-sm font-medium text-text-secondary transition-colors hover:bg-surface-overlay hover:text-text-primary disabled:opacity-40 md:min-h-0"
              >
                {a.label}
              </button>
            ))}
          </div>
        </>
      )}
      {note && (
        <span className="absolute right-0 top-full z-20 mt-1 whitespace-nowrap text-xs text-text-tertiary">
          {note}
        </span>
      )}
    </div>
  );
}

/** Mini proof embed for solve rows: title, time, pattern, number. */
function MiniProof({ ev }: { ev: RankedFeedEvent }) {
  const t = metaDuration(ev);
  const pattern = metaPattern(ev);
  const verified = metaVerified(ev);
  return (
    <div className="rounded-lg border border-hairline bg-well p-3">
      <p className="truncate text-sm font-medium text-text-primary">
        {ev.problem_title ?? "A problem"}
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        {t != null && (
          <span className="font-mono text-sm text-text-primary tnum">{fmtClock(t)}</span>
        )}
        {ev.problem_slug && (
          <span className="font-mono text-xs text-text-tertiary tnum">
            No. {ev.problem_slug}
          </span>
        )}
        {pattern && <PatternChip label={pattern} />}
        {ev.difficulty && (
          <DifficultyBadgeNew difficulty={String(ev.difficulty)} />
        )}
        {verified === true && <VerifiedBadge />}
        {verified === false && <SelfReportedBadge />}
      </div>
    </div>
  );
}

function DiscussionCard({ d }: { d: Discussion }) {
  const [replies, setReplies] = useState<Awaited<ReturnType<typeof getDiscussionReplies>>>([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setReplies(await getDiscussionReplies(d.id).catch(() => []));
  }, [d.id]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const reply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (draft.trim().length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await createDiscussionReply(d.id, draft.trim());
      track("feed_action", { via: "reply" });
      setDraft("");
      await load();
    } catch (err) {
      setError(dataErrorMessage(err, "Couldn't reply."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="card space-y-2">
      <div className="flex items-start gap-3">
        <Avatar name={d.author?.username ?? "Someone"} src={d.author?.avatar_url} size="md" />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-text-tertiary">
            @{d.author?.username ?? "someone"} · {timeAgo(d.created_at)} ·{" "}
            {d.visibility === "global" ? "Global" : "Squad"}
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-text-primary">{d.body_md}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Link
              href={`/practice/${d.problem_slug}`}
              onClick={() => track("feed_action", { via: "open_problem_from_discussion" })}
              className="rounded-full border border-hairline bg-well px-2.5 py-1 font-mono text-xs text-text-secondary transition-colors hover:text-text-primary"
            >
              {d.problem_slug}
            </Link>
            {d.pattern_tags.map((t) => (
              <PatternChip key={t} label={t} />
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 pl-11">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex min-h-[44px] items-center text-sm font-medium text-text-secondary transition-colors hover:text-text-primary md:min-h-0"
        >
          {open ? "Hide" : `${d.reply_count ?? 0} ${d.reply_count === 1 ? "reply" : "replies"}`}
        </button>
      </div>

      {open && (
        <div className="space-y-2 border-l border-hairline pl-3">
          {replies.map((r) => (
            <div key={r.id}>
              <p className="text-xs text-text-tertiary">
                @{r.author?.username ?? "someone"} · {timeAgo(r.created_at)}
              </p>
              <p className="whitespace-pre-wrap text-sm leading-6 text-text-primary">{r.body_md}</p>
            </div>
          ))}
          <form onSubmit={reply} className="flex items-center gap-2 pt-1">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add what you tried…"
              className="h-10 min-h-[44px] flex-1 rounded-md border border-hairline bg-well px-3 text-sm text-text-primary placeholder:text-text-disabled focus:border-hairline-strong focus:outline-none md:min-h-0"
            />
            <Button
              type="submit"
              variant="secondary"
              disabled={busy || draft.trim().length === 0}
            >
              Reply
            </Button>
          </form>
          {error && <p className="text-xs text-error">{error}</p>}
        </div>
      )}
    </article>
  );
}

export default function FeedPage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<FeedScope>("squad");
  const [events, setEvents] = useState<RankedFeedEvent[]>([]);
  const [platform, setPlatform] = useState<PlatformPost[]>([]);
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [composerOpen, setComposerOpen] = useState(false);
  const [discussOpen, setDiscussOpen] = useState(false);
  const [solveCount, setSolveCount] = useState(0);

  const squadId = profile?.active_squad_id ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      if (tab === "platform") {
        setPlatform(await getPlatformPosts());
        setEvents([]);
        setDiscussions([]);
        return;
      }
      const rows = await getRankedFeed(tab, { squadId, limit: 40 });
      track("feed_view", { scope: tab, rows: rows.length });
      setEvents(rows);
      setPlatform([]);
      setDiscussions(await getDiscussions({ problemSlug: null, squadId, limit: 10 }));
    } catch (err) {
      setLoadError(dataErrorMessage(err, "Couldn't load feed. Retry."));
    } finally {
      setLoading(false);
    }
  }, [tab, squadId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [tab]);

  const noSquad = tab === "squad" && !squadId;
  const visibleEvents = events.slice(0, visibleCount);

  const weekSolves = events.filter(
    (e) => e.event_type === "solve" || e.event_type === "solved"
  ).length;
  const weekChallenges = events.filter(
    (e) => e.event_type === "challenge" || e.event_type === "complete" || e.event_type === "completed"
  ).length;
  const weekTeaches = events.filter((e) => e.event_type === "teach").length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="type-display-md text-text-primary">Feed</h1>
        <p className="mt-1 text-sm leading-6 text-text-secondary">
          What Kshatriya has been up to.
        </p>
      </div>

      <UnderlineTabs
        tabs={TAB_LABELS}
        value={SCOPE_TO_TAB[tab]}
        onChange={(v) => setTab(TAB_TO_SCOPE[v as TabLabel])}
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="mx-auto w-full max-w-reading space-y-3">
          <button
            onClick={() => {
              track("composer_opened", { surface: "feed" });
              setComposerOpen(true);
            }}
            className="card-interactive flex w-full items-center gap-3 rounded-xl border border-hairline bg-surface p-4 text-left"
          >
            <Avatar name={profile?.username ?? "You"} src={profile?.avatar_url} size="md" />
            <span className="min-w-0 flex-1 truncate text-sm text-text-tertiary">
              Share a solve, teach something, or ask for help…
            </span>
            <span className="shrink-0">
              <Button variant="secondary" type="button">
                Post
              </Button>
            </span>
          </button>

          {loadError && (
            <ErrorCard message={loadError} onRetry={() => void load()} />
          )}

          {loading ? (
            <div className="space-y-3" aria-label="Loading feed">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : tab === "platform" ? (
            <div className="space-y-3">
              {platform.length === 0 ? (
                <EmptyState
                  heading="No announcements right now"
                  body="Contests, product changes and maintenance notices land here, nothing else does."
                />
              ) : (
                platform.map((p) => (
                  <div key={p.id} className="card space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-text-secondary">{p.kind}</span>
                      {p.pinned && (
                        <span className="rounded-sm bg-surface-overlay px-2 py-0.5 text-xs font-medium text-text-primary">
                          Pinned
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-text-primary">{p.title}</p>
                    <p className="whitespace-pre-wrap text-sm leading-6 text-text-secondary">
                      {p.body_md}
                    </p>
                    {p.href && (
                      <a
                        href={p.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block min-h-[44px] text-sm font-medium text-text-primary underline decoration-hairline-strong underline-offset-[3px] hover:decoration-text-primary md:min-h-0"
                      >
                        Open
                      </a>
                    )}
                  </div>
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
                  href={tab === "following" ? "/u/prem" : "/home"}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-surface-overlay px-4 text-sm font-medium leading-5 text-text-primary transition-colors hover:bg-[#272830]"
                >
                  {tab === "following" ? "Find people" : "Go to today's battle"}
                </Link>
              }
            />
          ) : (
            <div className="space-y-3">
              {visibleEvents.map((ev) => (
                <article
                  key={ev.id}
                  className="card-interactive rounded-xl border border-hairline bg-surface p-4"
                >
                  <div className="flex items-start gap-3">
                    <Avatar
                      name={ev.actor?.username ?? "Someone"}
                      src={ev.actor?.avatar_url}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-6 text-text-primary">{describe(ev)}</p>
                      <p className="mt-0.5 text-xs text-text-tertiary">
                        {timeAgo(ev.created_at)}
                        {Number(ev.usefulness ?? 0) > 0
                          ? ` · ${actionabilityLabel(
                              Number(ev.usefulness ?? 0),
                              (Date.now() - new Date(ev.created_at).getTime()) / 3600000
                            )}`
                          : ""}
                      </p>
                      {metaCaption(ev) && (
                        <p className="mt-1 text-sm leading-6 text-text-secondary">
                          &ldquo;{metaCaption(ev)}&rdquo;
                        </p>
                      )}
                    </div>
                    <RowMenu ev={ev} onDone={() => void load()} />
                  </div>

                  {(ev.event_type === "solve" || ev.event_type === "solved") &&
                    ev.problem_title && (
                      <div className="mt-3 pl-11">
                        <MiniProof ev={ev} />
                      </div>
                    )}

                  <div className="mt-3 flex items-center gap-1 pl-11">
                    {ev.problem_slug && (
                      <Link
                        href={`/practice/${ev.problem_slug}`}
                        onClick={() => track("feed_action", { via: "open_problem" })}
                        className="flex min-h-[44px] items-center rounded-md px-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary md:min-h-0 md:h-10"
                      >
                        Open
                      </Link>
                    )}
                    {(ev.event_type === "solve" || ev.event_type === "solved") &&
                      ev.problem_slug && (
                        <Link
                          href={`/practice/${ev.problem_slug}/compare`}
                          onClick={() => track("feed_action", { via: "compare" })}
                          className="flex min-h-[44px] items-center rounded-md px-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary md:min-h-0 md:h-10"
                        >
                          Compare
                        </Link>
                      )}
                    {ev.event_type === "stuck" && (
                      <Link
                        href="/stuck"
                        onClick={() => track("feed_action", { via: "help" })}
                        className="flex min-h-[44px] items-center"
                      >
                        <Button variant="secondary" type="button">
                          Help
                        </Button>
                      </Link>
                    )}
                  </div>
                </article>
              ))}

              {visibleCount < events.length && (
                <Button variant="ghost" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
                  Show older
                </Button>
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
        </div>

        <aside className="space-y-4 lg:pt-1">
          <div className="card">
            <h2 className="text-lg font-semibold leading-[26px] text-text-primary">
              This week in Kshatriya
            </h2>
            <dl className="mt-3 space-y-2">
              {[
                { label: "Solves", value: weekSolves },
                { label: "Challenges", value: weekChallenges },
                { label: "Approaches", value: weekTeaches },
              ].map((s) => (
                <div key={s.label} className="flex items-baseline justify-between gap-3">
                  <dt className="text-sm text-text-secondary">{s.label}</dt>
                  <dd className="font-display text-[28px] font-semibold leading-[31px] text-text-primary tnum">
                    {s.value}
                  </dd>
                </div>
              ))}
            </dl>
            {squadId && (
              <Link
                href={`/squad/${squadId}/recaps`}
                className="mt-3 inline-flex min-h-[44px] items-center text-sm font-medium text-text-primary underline decoration-hairline-strong underline-offset-[3px] hover:decoration-text-primary md:min-h-0"
              >
                Last week&apos;s recap is ready
              </Link>
            )}
          </div>
        </aside>
      </div>

      {composerOpen && (
        <FeedComposer
          onClose={() => setComposerOpen(false)}
          onPosted={() => void load()}
          onDiscuss={() => {
            void getMyLoggedSolveCount().then(setSolveCount).catch(() => setSolveCount(0));
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
            void load();
          }}
        />
      )}
    </div>
  );
}
