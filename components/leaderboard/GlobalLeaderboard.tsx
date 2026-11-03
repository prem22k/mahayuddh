"use client";

import { profileHref } from "@/lib/profiles/username";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  LEADERBOARD_SEGMENTS,
  getGlobalLeaderboard,
  isLifetimeView,
  type LeaderboardRow,
  type LeaderboardSegment,
} from "@/lib/data/leaderboard";
import { dataErrorMessage } from "@/lib/data/errors";
import { BoardRowsSkeleton } from "@/components/skeletons/LeaderboardSkeleton";
import { FilterChips } from "@/components/ui/ProblemRow";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { boardListCls, boardRankCls, boardRowCls } from "@/components/leaderboard/rowStyles";
import { useCachedQuery } from "@/lib/cache/query";

const SEGMENT_LABELS = LEADERBOARD_SEGMENTS.map((sg) => sg.label);
const NO_LEADERBOARD_ROWS: LeaderboardRow[] = [];

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
  const [segment, setSegment] = useState<LeaderboardSegment>("rising");
  const [patternInput, setPatternInput] = useState("");
  const [appliedPattern, setAppliedPattern] = useState("");
  const [page, setPage] = useState(0);

  const PAGE = 25;
  const trimmedPattern = segment === "pattern" && appliedPattern.trim() ? appliedPattern.trim() : null;

  const boardQuery = useCachedQuery(
    ["global-leaderboard", segment, trimmedPattern, PAGE, page],
    () =>
      getGlobalLeaderboard({
        segment,
        pattern: trimmedPattern,
        limit: PAGE,
        offset: page * PAGE,
      })
  );

  const rows = boardQuery.data?.rows ?? NO_LEADERBOARD_ROWS;
  const loading = boardQuery.isLoading;
  const error =
    boardQuery.error && boardQuery.data === undefined
      ? dataErrorMessage(boardQuery.error, "Couldn't load the leaderboard.")
      : null;

  // The server may override the segment for a first-time viewer; reflect
  // what was actually returned rather than what was requested.
  useEffect(() => {
    if (boardQuery.data?.segment && boardQuery.data.segment !== segment) {
      setSegment(boardQuery.data.segment);
    }
  }, [boardQuery.data?.segment, segment]);

  const meta = LEADERBOARD_SEGMENTS.find((s) => s.id === segment);

  return (
    <div className="space-y-4 select-none">
      <FilterChips
        options={SEGMENT_LABELS}
        value={meta?.label ?? ""}
        onChange={(label) => {
          const next = LEADERBOARD_SEGMENTS.find((sg) => sg.label === label);
          if (!next) return;
          setSegment(next.id);
          setPage(0);
        }}
        scroll
        label="Leaderboard segment"
      />

      {segment === "pattern" && (
        <div className="flex items-center gap-2">
          <input
            value={patternInput}
            onChange={(e) => {
              setPatternInput(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setAppliedPattern(patternInput);
                setPage(0);
              }
            }}
            aria-label="Pattern to rank by, for example Graphs"
            placeholder="Pattern, e.g. Graphs"
            className="h-10 min-h-[44px] min-w-0 flex-1 rounded-md border border-hairline bg-well px-3 text-sm text-text-primary placeholder:text-text-disabled focus:border-hairline-strong focus:outline-hidden md:min-h-0 md:max-w-xs"
          />
          <Button
            variant="secondary"
            onClick={() => {
              setAppliedPattern(patternInput);
              setPage(0);
            }}
            className="min-h-[44px] md:min-h-0"
          >
            Apply
          </Button>
        </div>
      )}

      {/* The ranking basis is stated, always. */}
      {meta && (
        <p className="text-xs leading-5 text-text-tertiary">
          {meta.ranks}.
          {isLifetimeView(segment) &&
            " Lifetime totals — this one is honest about being a long-run tally, which is why it is not the default view."}
        </p>
      )}

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-error/30 bg-error-tint px-4 py-3">
          <span className="text-sm text-error">{error}</span>
          <Button variant="secondary" onClick={() => void boardQuery.refresh()}>
            Retry
          </Button>
        </div>
      )}

      {loading ? (
        <BoardRowsSkeleton />
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-hairline bg-surface p-10 text-center">
          <p className="text-sm leading-6 text-text-secondary">
            {segment === "pattern"
              ? "Nobody has logged a solve on that pattern yet. Try a broader pattern name."
              : "Nobody has anything recorded in this view yet. It fills up as people log activity — nothing here is back-filled."}
          </p>
        </div>
      ) : (
        <ol className={boardListCls}>
          {rows.map((r, i) => {
            const rank = page * PAGE + i + 1;
            return (
              <li key={r.user_id} aria-label={`${r.username}, rank ${rank}`} className={boardRowCls()}>
                <span className={boardRankCls(rank)}>{rank}</span>
                <Avatar name={r.username} src={r.avatar_url} size="md" />
                <div className="flex min-w-0 flex-1 flex-col md:flex-row md:items-center md:justify-between md:gap-4">
                  <Link
                    href={profileHref(r.username)}
                    className="truncate text-sm font-semibold text-text-primary transition-colors hover:text-primary"
                  >
                    @{r.username}
                  </Link>
                  <p className="truncate font-mono text-xs leading-4 text-text-tertiary md:shrink-0 md:tracking-[0.06em]">
                    {r.segment_label}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {rows.length >= PAGE && (
        <div className="flex items-center justify-between gap-2 pt-1">
          <Button
            variant="ghost"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="min-h-[44px] border border-hairline md:min-h-0"
          >
            ← Previous
          </Button>
          <span className="font-mono text-xs text-text-tertiary tnum">Page {page + 1}</span>
          <Button
            variant="ghost"
            onClick={() => setPage((p) => p + 1)}
            className="min-h-[44px] border border-hairline md:min-h-0"
          >
            Next →
          </Button>
        </div>
      )}
    </div>
  );
}
