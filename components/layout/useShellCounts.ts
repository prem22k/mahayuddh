"use client";

import { useEffect } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCachedQuery } from "@/lib/cache/query";
import { getIncomingSuggestionCount } from "@/lib/data/suggestions";
import { getMySquads, getSquadMemberIds } from "@/lib/data/squads";
import { getPinnedSheetProgress, PINNED_SHEETS, type SheetProgress } from "@/lib/data/sheetProgress";

export interface ShellCounts {
  /** Challenges addressed to you and still pending. 0 when unknown. */
  incomingChallenges: number;
  squadName: string | null;
  squadMemberCount: number | null;
  sheets: { slug: string; title: string; progress: SheetProgress | null }[];
}

const NO_PROGRESS: Record<string, SheetProgress | null> = {};

/**
 * Real numbers for the shell chrome (sidebar, drawer). Every field degrades to
 * "absent" rather than a placeholder: the shell is on every screen, and a
 * made-up count there would be the most-seen lie in the product.
 *
 * Reads through the client cache with the same keys and fetchers the pages
 * use, so the sidebar and the drawer share one request per value, and a page
 * that invalidates "incoming-suggestion-count" or "my-squads" updates the
 * shell too. Sheet progress refreshes when any problem's status changes.
 */
export function useShellCounts(): ShellCounts {
  const { user, profile } = useAuth();
  const userId = user?.id ?? null;
  const activeSquadId = profile?.active_squad_id ?? null;

  const incoming = useCachedQuery(userId ? ["incoming-suggestion-count"] : null, () =>
    getIncomingSuggestionCount(userId as string)
  );
  const progress = useCachedQuery(
    userId ? ["pinned-sheet-progress"] : null,
    () => getPinnedSheetProgress(userId as string),
    { freshForMs: 5 * 60_000 }
  );
  const mySquads = useCachedQuery(
    userId && activeSquadId ? ["my-squads"] : null,
    () => getMySquads(userId as string, activeSquadId)
  );
  const memberIds = useCachedQuery(activeSquadId ? ["squad-member-ids", activeSquadId] : null, () =>
    getSquadMemberIds(activeSquadId as string)
  );

  const refreshProgress = progress.refresh;
  useEffect(() => {
    const onStatus = () => void refreshProgress();
    window.addEventListener("problem-status-changed", onStatus);
    return () => window.removeEventListener("problem-status-changed", onStatus);
  }, [refreshProgress]);

  const progressBySlug = progress.data ?? NO_PROGRESS;
  return {
    incomingChallenges: incoming.data ?? 0,
    squadName: activeSquadId
      ? (mySquads.data?.squads.find((s) => s.id === activeSquadId)?.name ?? null)
      : null,
    squadMemberCount: activeSquadId ? (memberIds.data?.length ?? null) : null,
    sheets: PINNED_SHEETS.map((s) => ({ ...s, progress: progressBySlug[s.slug] ?? null })),
  };
}
