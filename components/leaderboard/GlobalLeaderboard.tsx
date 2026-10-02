"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  LEADERBOARD_SEGMENTS,
  getGlobalLeaderboard,
  isLifetimeView,
  type LeaderboardRow,
  type LeaderboardSegment,
} from "@/lib/data/leaderboard";
import { dataErrorMessage } from "@/lib/data/errors";
import { PageLoader } from "@/components/ui/PageLoader";

/**
 * Global leaderboard segments (§34).
 *
 * §34's complaint is that "a beginner should not feel: 'Why compete with
 * someone who has solved 2,000 problems?'" The fix is not to hide the lifetime
 * board — it is to stop making it the default and to offer segments where a
 * week of real work moves you up.
 *
 * So: the landing segment is chosen by the database from the viewer's own
 * history, "Most solved" is opt-in and labelled, and every row states what it
 * was ranked by. A number with no stated basis is how people end up feeling
 * arbitrarily badged.
 */
export function GlobalLeaderboard() {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [segment, setSegment] = useState<LeaderboardSegment>("rising");
  const [pattern, setPattern] = useState("");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const PAGE = 25;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getGlobalLeaderboard({
        segment,
        pattern: segment === "pattern" && pattern.trim() ? pattern.trim() : null,
        limit: PAGE,
        offset: page * PAGE,
      });
      setRows(res.rows);
      // The server may override the segment for a first-time viewer; reflect
      // what was actually returned rather than what was requested.
      setSegment(res.segment);
    } catch (err) {
      setError(dataErrorMessage(err, "Couldn't load the leaderboard."));
    } finally {
      setLoading(false);
    }
  }, [segment, pattern, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const meta = LEADERBOARD_SEGMENTS.find((s) => s.id === segment);

  return (
    <div className="space-y-4 select-none">
      <div className="flex items-center gap-2 flex-wrap">
        {LEADERBOARD_SEGMENTS.map((s) => (
          <button
            key={s.id}
            onClick={() => {
              setSegment(s.id);
              setPage(0);
            }}
            title={s.ranks}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
              segment === s.id
                ? "bg-white/[0.12] text-white"
                : "bg-white/[0.04] text-white/40 hover:text-white/70"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {segment === "pattern" && (
        <div className="flex items-center gap-2">
          <input
            value={pattern}
            onChange={(e) => {
              setPattern(e.target.value);
              setPage(0);
            }}
            placeholder="Pattern, e.g. Graphs"
            className="px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-white/20"
          />
          <button
            onClick={() => void load()}
            className="px-3 py-1.5 rounded-full bg-white/[0.06] text-[11px] font-bold text-white/70 hover:text-white cursor-pointer"
          >
            Apply
          </button>
        </div>
      )}

      {/* The ranking basis is stated, always. */}
      {meta && (
        <p className="text-[11px] text-white/30">
          {meta.ranks}.
          {isLifetimeView(segment) &&
            " Lifetime totals — this one is honest about being a long-run tally, which is why it is not the default view."}
        </p>
      )}

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-[#ff453a]/10 border border-[#ff453a]/30">
          <span className="text-xs text-[#ff453a]">{error}</span>
          <button
            onClick={() => void load()}
            className="px-3 py-1 rounded-full bg-[#ff453a]/15 text-[#ff453a] text-[11px] font-bold cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <PageLoader label="Loading..." className="h-32" />
      ) : rows.length === 0 ? (
        <div className="p-10 text-center rounded-3xl bg-white/[0.02] border border-white/[0.06]">
          <p className="text-xs text-white/40">
            {segment === "pattern"
              ? "Nobody has logged a solve on that pattern yet. Try a broader pattern name."
              : "Nobody has anything recorded in this view yet. It fills up as people log activity — nothing here is back-filled."}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r, i) => (
            <div
              key={r.user_id}
              className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.02] border border-white/[0.06]"
            >
              <span className="w-6 text-right font-mono text-xs text-white/25">
                {page * PAGE + i + 1}
              </span>
              <div className="w-8 h-8 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center font-bold text-[11px] text-white shrink-0 overflow-hidden">
                {r.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.avatar_url} alt={r.username} className="w-full h-full object-cover" />
                ) : (
                  r.username.charAt(0).toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0">
                <Link
                  href={`/u/${r.username}`}
                  className="text-xs font-bold text-white hover:text-[#fa586a] transition-colors"
                >
                  @{r.username}
                </Link>
                <p className="text-[10px] text-white/30">{r.segment_label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {rows.length >= PAGE && (
        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1.5 rounded-full bg-white/[0.05] text-[11px] font-bold text-white/60 hover:text-white disabled:opacity-40 cursor-pointer"
          >
            ← Previous
          </button>
          <span className="text-[10px] text-white/25">Page {page + 1}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 rounded-full bg-white/[0.05] text-[11px] font-bold text-white/60 hover:text-white cursor-pointer"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}