"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/AuthProvider";
import { PageLoader } from "@/components/ui/PageLoader";
import { DiscussComposer } from "@/components/feed/DiscussComposer";
import { FeedComposer } from "@/components/feed/FeedComposer";
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
import { FEED_ACTIONS, SCOPE_PURPOSE, actionabilityLabel, type FeedScope } from "@/lib/feedPolicy";
import { track } from "@/lib/analytics";

/**
 * Feed (Step 21, Bible §19).
 *
 * Four scopes, Squad first because §19 makes it the default: accountability
 * against the people you chose. Following is for learning, Global is discovery,
 * Platform is announcements and is not activity at all.
 *
 * Ranking is §20 and happens in SQL. The one thing this file does with ranking
 * is show it: an event that earned its place says so, and one that has not
 * says that too. A feed that silently reorders itself looks arbitrary.
 */

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

function describe(ev: RankedFeedEvent): string {
  const who = ev.actor?.username ? `@${ev.actor.username}` : "Someone";
  switch (ev.event_type) {
    case "solve":
    case "solved":
      return `${who} solved ${ev.problem_title || "a problem"}`;
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

function Avatar({ actor }: { actor?: RankedFeedEvent["actor"] }) {
  return (
    <div className="w-7 h-7 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center font-bold text-[10px] text-white shrink-0 overflow-hidden">
      {actor?.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={actor.avatar_url} alt={actor.username} className="w-full h-full object-cover" />
      ) : (
        (actor?.username || "?").charAt(0).toUpperCase()
      )}
    </div>
  );
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
        className="p-1.5 rounded-full text-white/25 hover:text-white/60 hover:bg-white/[0.06] transition-all cursor-pointer"
      >
        <MoreHorizontal className="w-3.5 h-3.5" />
      </button>
      {open && (
        <>
          <button
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div className="absolute right-0 top-full mt-1 z-20 min-w-[9rem] rounded-2xl border border-white/[0.08] bg-[#0e0e0e] p-1.5 shadow-2xl">
            {FEED_ACTIONS.map((a) => (
              <button
                key={a.id}
                disabled={busy}
                onClick={() => void run(a.id)}
                className="block w-full text-left px-3 py-2 rounded-xl text-[11px] font-bold text-white/60 hover:text-white hover:bg-white/[0.06] transition-all disabled:opacity-40"
              >
                {a.label}
              </button>
            ))}
          </div>
        </>
      )}
      {note && <span className="absolute right-0 top-full mt-1 z-20 text-[10px] text-white/50 whitespace-nowrap">{note}</span>}
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
    <article className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-2">
      <div className="flex items-start gap-3">
        <Avatar actor={d.author ?? undefined} />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-white/35">
            @{d.author?.username ?? "someone"} · {timeAgo(d.created_at)} ·{" "}
            {d.visibility === "global" ? "Global" : "Squad"}
          </p>
          <p className="text-xs text-white/80 whitespace-pre-wrap mt-1">{d.body_md}</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Link
              href={`/practice/${d.problem_slug}`}
              onClick={() => track("feed_action", { via: "open_problem_from_discussion" })}
              className="px-2.5 py-1 rounded-full bg-white/[0.05] border border-white/[0.08] text-[10px] text-white/60 hover:text-white transition-all"
            >
              {d.problem_slug}
            </Link>
            {d.pattern_tags.map((t) => (
              <span
                key={t}
                className="px-2 py-0.5 rounded-full bg-[#ffd60a]/10 border border-[#ffd60a]/20 text-[10px] text-[#ffd60a]/80"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 pl-10">
        <button
          onClick={() => setOpen((v) => !v)}
          className="text-[10px] font-bold text-white/35 hover:text-white/70 transition-all cursor-pointer"
        >
          {open ? "Hide" : `${d.reply_count ?? 0} ${d.reply_count === 1 ? "reply" : "replies"}`}
        </button>
      </div>

      {open && (
        <div className="pl-10 space-y-2 border-l border-white/[0.06] pl-3">
          {replies.map((r) => (
            <div key={r.id}>
              <p className="text-[10px] text-white/30">
                @{r.author?.username ?? "someone"} · {timeAgo(r.created_at)}
              </p>
              <p className="text-[11px] text-white/70 whitespace-pre-wrap">{r.body_md}</p>
            </div>
          ))}
          <form onSubmit={reply} className="flex items-center gap-2 pt-1">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add what you tried…"
              className="flex-1 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-[11px] text-white placeholder:text-white/20 focus:outline-none focus:border-white/20"
            />
            <button
              type="submit"
              disabled={busy || draft.trim().length === 0}
              className="px-3 py-1.5 rounded-full bg-white/[0.08] text-[11px] font-bold text-white disabled:opacity-40 cursor-pointer"
            >
              Reply
            </button>
          </form>
          {error && <p className="text-[10px] text-[#ff453a]">{error}</p>}
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
  const [composerOpen, setComposerOpen] = useState(false);
  const [discussOpen, setDiscussOpen] = useState(false);
  // Loaded once and only when the composer is opened: it is a count, and it is
  // the gate's number (logged solves), not the LeetCode sync total.
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
      // feed_view is the denominator of the Step 21 useful-action rate. The
      // numerator is feed_action, fired when somebody acts on a row — kept as
      // a separate event so the rate cannot collapse to 1 by construction.
      track("feed_view", { scope: tab, rows: rows.length });
      setEvents(rows);
      setPlatform([]);
      // Discussions are shown alongside activity: prose is additive to the
      // auto-generated feed (§50), never a prerequisite for it having content.
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

  const noSquad = tab === "squad" && !squadId;

  return (
    <div className="space-y-6 select-none max-w-2xl">
      <div>
        <div className="text-[11px] font-semibold text-[#fa586a] tracking-[0.2em] uppercase mb-1">
          What are people learning?
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">Feed</h1>
        <p className="text-xs text-white/40 mt-1">
          Activity generated by learning — never posts for posting&apos;s sake.
        </p>
      </div>

      <div className="flex items-center gap-1 p-1 bg-white/[0.04] rounded-full border border-white/[0.06] w-fit max-w-full overflow-x-auto">
        {(["squad", "following", "global", "platform"] as FeedScope[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer capitalize whitespace-nowrap",
              tab === t ? "bg-white/[0.12] text-white shadow-sm" : "text-white/40 hover:text-white/80"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Each scope says what it is for. A feed with no stated purpose is a list. */}
      <p className="text-[11px] text-white/30 -mt-3">{SCOPE_PURPOSE[tab]}</p>

      {/* Composer: six structured tiles (§18), not a blank box. Five of them
          create the object they name — Challenge really sends a challenge,
          Ask help really raises a stuck request — and Discuss is the one tile
          that takes prose, behind the §51 gates. */}
      <button
        onClick={() => {
          track("composer_opened", { surface: "feed" });
          setComposerOpen(true);
        }}
        className="w-full p-4 rounded-3xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] text-left transition-all cursor-pointer"
      >
        <span className="text-xs font-bold text-white/80">Post something</span>
        <span className="text-[11px] text-white/30 ml-2">
          Share a solve · Teach · Challenge · Ask help · Share resource · Discuss
        </span>
      </button>

      {loadError && (
        <div role="alert" className="flex items-center justify-between gap-3 px-5 py-4 rounded-2xl bg-[#ff453a]/10 border border-[#ff453a]/30">
          <span className="text-xs text-[#ff453a] font-medium">{loadError}</span>
          <button
            onClick={() => void load()}
            className="px-4 py-1.5 rounded-full bg-[#ff453a]/15 text-[#ff453a] text-xs font-bold cursor-pointer shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <PageLoader label="Loading feed..." className="h-40" />
      ) : tab === "platform" ? (
        <div className="space-y-2">
          {platform.length === 0 ? (
            <div className="p-10 text-center rounded-3xl bg-white/[0.02] border border-white/[0.06]">
              <p className="text-xs text-white/40">
                No announcements right now. Contests, product changes and maintenance
                notices land here — nothing else does.
              </p>
            </div>
          ) : (
            platform.map((p) => (
              <div
                key={p.id}
                className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-1"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#ffd60a]">
                    {p.kind}
                  </span>
                  {p.pinned && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/30">
                      pinned
                    </span>
                  )}
                </div>
                <p className="text-sm font-bold text-white">{p.title}</p>
                <p className="text-xs text-white/55 whitespace-pre-wrap">{p.body_md}</p>
                {p.href && (
                  <a
                    href={p.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-[11px] font-bold text-[#fa586a] hover:underline"
                  >
                    Open →
                  </a>
                )}
              </div>
            ))
          )}
        </div>
      ) : noSquad ? (
        <div className="p-12 text-center space-y-3 bg-[#1c1c1e]/60 rounded-3xl border border-white/[0.06]">
          <p className="text-sm font-bold text-white">No active squad.</p>
          <p className="text-xs text-white/40 max-w-sm mx-auto">
            Join or create a squad — solves and challenges will appear here automatically.
            No prose required.
          </p>
          <Link href="/squad" className="inline-block px-4 py-2 rounded-full bg-[#fa586a] text-white text-xs font-bold">
            Find your squad
          </Link>
        </div>
      ) : events.length === 0 && discussions.length === 0 ? (
        <div className="p-12 text-center space-y-3 bg-[#1c1c1e]/60 rounded-3xl border border-white/[0.06]">
          <p className="text-sm font-bold text-white">
            {tab === "following" ? "Nobody followed yet." : "Quiet… for now."}
          </p>
          <p className="text-xs text-white/40 max-w-sm mx-auto">
            {tab === "following"
              ? "Follow people whose approaches you want to see. Their solves, teaching and discussions land here."
              : tab === "global"
                ? "Nothing public yet. Global posts need a problem, a pattern, and something for the reader to try."
                : "Solves, challenges, and completions land here on their own. Start today's battle."}
          </p>
          <Link
            href={tab === "following" ? "/patterns" : "/"}
            className="inline-block px-4 py-2 rounded-full bg-[#fa586a] text-white text-xs font-bold"
          >
            {tab === "following" ? "Find people" : "Start today's battle"}
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {/* §20 says a useful post is one that changes what another developer
              does next. The label says whether that has happened yet, so the
              ordering is legible instead of magic. */}
          {events.length > 0 && (
            <div className="text-[10px] uppercase tracking-wider text-white/25">
              Ranked by what people actually did with it
            </div>
          )}
          {events.map((ev) => (
            <div
              key={ev.id}
              className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-xs"
            >
              <Avatar actor={ev.actor} />
              <div className="flex-1 min-w-0">
                <p className="text-white/80 truncate">{describe(ev)}</p>
                <p className="text-[10px] text-white/30 font-mono">
                  {timeAgo(ev.created_at)} ·{" "}
                  {actionabilityLabel(
                    Number(ev.usefulness ?? 0),
                    (Date.now() - new Date(ev.created_at).getTime()) / 3600000
                  )}
                </p>
              </div>
              {ev.problem_slug && (
                <Link
                  href={`/practice/${ev.problem_slug}`}
                  onClick={() => track("feed_action", { via: "open_problem" })}
                  className="px-3 py-1 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white/60 text-[11px] font-semibold shrink-0 transition-all"
                >
                  Open
                </Link>
              )}
              <RowMenu ev={ev} onDone={() => void load()} />
            </div>
          ))}

          {discussions.length > 0 && (
            <>
              <div className="text-[10px] uppercase tracking-wider text-white/25 pt-2">
                Discussions
              </div>
              {discussions.map((d) => (
                <DiscussionCard key={d.id} d={d} />
              ))}
            </>
          )}
        </div>
      )}

      {/* Five tiles create their object; Discuss hands off to its own modal. */}
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

      {/* The discuss composer gets no `key` on purpose. The solve count arrives
          asynchronously, and remounting on it would wipe a draft already in
          progress. */}
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