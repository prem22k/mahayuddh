"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
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

/**
 * Real numbers for the shell chrome (sidebar, drawer). Every field degrades to
 * "absent" rather than a placeholder: the shell is on every screen, and a
 * made-up count there would be the most-seen lie in the product.
 */
export function useShellCounts(): ShellCounts {
  const { user, profile } = useAuth();
  const [incomingChallenges, setIncoming] = useState(0);
  const [squadName, setSquadName] = useState<string | null>(null);
  const [squadMemberCount, setMemberCount] = useState<number | null>(null);
  const [progress, setProgress] = useState<Record<string, SheetProgress | null>>({});
  const activeSquadId = profile?.active_squad_id ?? null;

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getIncomingSuggestionCount(user.id)
      .then((n) => !cancelled && setIncoming(n))
      .catch(() => {});
    getPinnedSheetProgress(user.id)
      .then((p) => !cancelled && setProgress(p))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user || !activeSquadId) {
      setSquadName(null);
      setMemberCount(null);
      return;
    }
    let cancelled = false;
    getMySquads(user.id, activeSquadId)
      .then(({ squads }) => {
        if (cancelled) return;
        setSquadName(squads.find((s) => s.id === activeSquadId)?.name ?? null);
      })
      .catch(() => {});
    getSquadMemberIds(activeSquadId)
      .then((ids) => !cancelled && setMemberCount(ids.length))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user?.id, activeSquadId]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    incomingChallenges,
    squadName,
    squadMemberCount,
    sheets: PINNED_SHEETS.map((s) => ({ ...s, progress: progress[s.slug] ?? null })),
  };
}
