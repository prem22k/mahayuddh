"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Shield, Target, TrendingDown, ArrowRight, Users } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { getSquadDetail, getSquadSolveCounts } from "@/lib/data/squads";
import { getIncomingSuggestionCount } from "@/lib/data/suggestions";
import { getRecentFeed } from "@/lib/data/feed";
import { dataErrorMessage } from "@/lib/data/errors";
import { FeedEvent } from "@/types/database";

/**
 * YOUR SQUAD + CHALLENGES + FEED (plan Step 4 Home composition, Bible §53).
 *
 * Deliberately a thin projection: squad goal, incoming challenges, and the
 * squad-scoped feed. Every tile is a link to a real next action — no dead ends.
 */
export function HomeSquadPanels() {
  const { user, profile } = useAuth();
  const squadId = profile?.active_squad_id ?? null;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [goal, setGoal] = useState<{ title: string; done: number; target: number } | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [incoming, setIncoming] = useState(0);
  const [feed, setFeed] = useState<FeedEvent[]>([]);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const incomingPromise = getIncomingSuggestionCount(user.id);
      const feedPromise = squadId
        ? getRecentFeed({ squadId, limit: 4 })
        : Promise.resolve([] as FeedEvent[]);

      if (squadId) {
        const { squad, members, goals } = await getSquadDetail(squadId);
        setMemberCount(members.length);
        const active = goals[0];
        if (active) {
          const counts = await getSquadSolveCounts(members.map((m) => m.user_id));
          setGoal({
            title: active.title,
            done: Object.values(counts).reduce((a, b) => a + b, 0),
            target: active.target_count,
          });
        } else {
          setGoal(null);
        }
        void squad;
      } else {
        setMemberCount(0);
        setGoal(null);
      }

      setIncoming(await incomingPromise);
      setFeed(await feedPromise);
    } catch (err) {
      setLoadError(dataErrorMessage(err, "Couldn't load your squad. Retry."));
    } finally {
      setLoading(false);
    }
  }, [user, squadId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!user || loading) return null;

  if (loadError) {
    return (
      <section className="space-y-4">
        <div
          role="alert"
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-5 py-4 rounded-2xl bg-error/10 border border-error/30"
        >
          <span className="text-xs text-error font-medium">{loadError}</span>
          <button
            onClick={load}
            className="px-4 py-1.5 rounded-full bg-error/15 hover:bg-error/25 border border-error/30 text-error text-xs font-bold cursor-pointer"
          >
            Retry
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* ── YOUR SQUAD ── */}
      <div className="lg:col-span-1 rounded-xl p-6 bg-surface border border-hairline space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-text-primary tracking-tight">Your Squad</h2>
          <Users className="w-4 h-4 text-text-tertiary" />
        </div>

        {squadId ? (
          <>
            <div className="flex items-center gap-2 text-xs text-text-tertiary">
              <Shield className="w-3.5 h-3.5 text-verified" />
              <span>
                {memberCount} {memberCount === 1 ? "member" : "members"} · shared accountability
              </span>
            </div>

            {goal ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[11px] font-semibold text-text-secondary">
                  <Target className="w-3.5 h-3.5 text-primary" />
                  <span className="truncate">{goal.title}</span>
                </div>
                <div className="h-2 rounded-full bg-surface-overlay overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{
                      width: `${Math.min(100, Math.round((goal.done / Math.max(goal.target, 1)) * 100))}%`,
                    }}
                  />
                </div>
                <p className="text-[11px] text-text-secondary font-mono">
                  {goal.done} / {goal.target} solved
                </p>
              </div>
            ) : (
              <p className="text-xs text-text-secondary">
                No active squad goal yet. Set one so the Daily Battle can match its pattern.
              </p>
            )}

            <Link
              href="/squad"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-verified hover:underline"
            >
              Open squad <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </>
        ) : (
          /* Solo empty state teaches the next action (Bible Principle 9). */
          <div className="space-y-3">
            <p className="text-xs text-text-secondary">
              You&apos;re solving solo. A squad turns solves into challenges — the thing that makes
              you come back.
            </p>
            <Link
              href="/squad"
              className="inline-block px-4 py-2 rounded-full bg-surface-overlay hover:bg-surface-raised border border-hairline text-text-primary text-xs font-bold transition-all"
            >
              Create one and invite 2–7 friends
            </Link>
          </div>
        )}
      </div>

      {/* ── CHALLENGES (pending actions on you) ── */}
      <div className="lg:col-span-1 rounded-xl p-6 bg-surface border border-hairline space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-text-primary tracking-tight">Challenges</h2>
          <span className="px-2 py-0.5 rounded-full bg-surface-overlay border border-hairline text-[10px] font-mono font-bold text-text-secondary">
            {incoming > 0 ? `${incoming} WAITING` : "CLEAR"}
          </span>
        </div>

        {incoming > 0 ? (
          <>
            <p className="text-xs text-text-tertiary">
              {incoming} {incoming === 1 ? "squad mate is" : "squad mates are"} waiting on your solve.
            </p>
            <Link
              href="/challenges"
              className="inline-block px-4 py-2 rounded-full bg-primary text-on-primary hover:bg-primary-hover text-xs font-bold transition-all"
            >
              Accept and solve
            </Link>
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-text-secondary">
              Nothing waiting on you. Solve a battle and challenge a friend — theirs will land here.
            </p>
            <Link
              href="/challenges"
              className="inline-block px-4 py-2 rounded-full bg-surface-overlay hover:bg-surface-raised border border-hairline text-text-primary text-xs font-bold transition-all"
            >
              Start a challenge
            </Link>
          </div>
        )}
      </div>

      {/* ── FEED (recent high-signal squad activity) ── */}
      <div className="lg:col-span-1 rounded-xl p-6 bg-surface border border-hairline space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-text-primary tracking-tight">Feed</h2>
          <TrendingDown className="w-4 h-4 text-text-tertiary rotate-180" />
        </div>

        {feed.length === 0 ? (
          <div className="space-y-3">
            <p className="text-xs text-text-secondary">
              {squadId
                ? "Quiet so far. Every solve you log shows up here for the squad."
                : "Join or create a squad to see what your people are solving."}
            </p>
            <Link
              href={squadId ? "/feed" : "/squad"}
              className="inline-block px-4 py-2 rounded-full bg-surface-overlay hover:bg-surface-raised border border-hairline text-text-primary text-xs font-bold transition-all"
            >
              {squadId ? "Start today's battle" : "Create a squad"}
            </Link>
          </div>
        ) : (
          <>
            <ul className="space-y-2">
              {feed.map((e) => (
                <li key={e.id} className="text-[11px] text-text-tertiary leading-relaxed">
                  <span className="text-text-secondary font-semibold">
                    {e.actor_profile?.username ? `@${e.actor_profile.username}` : "Someone"}
                  </span>{" "}
                  {e.event_type === "solve" && (e.metadata as { problem_slug?: string })?.problem_slug
                    ? `solved ${(e.metadata as { problem_slug?: string }).problem_slug}`
                    : e.event_type.replace("_", " ")}
                  {e.created_at ? (
                    <span className="text-text-disabled"> · {new Date(e.created_at).toLocaleDateString()}</span>
                  ) : null}
                </li>
              ))}
            </ul>
            <Link
              href="/feed"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary"
            >
              Open feed <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </>
        )}
      </div>
    </section>
  );
}

export default HomeSquadPanels;