"use client";

import { useCallback } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useInvalidateAll } from "@/lib/cache/query";

/**
 * Call after any successful LeetCode sync (connect, "Sync now", the history
 * import, the background auto-sync). A sync can change the profile (handle,
 * totals, streak) and the solve statuses that every progress number is built
 * from, so it reloads the profile and refetches every cached query: the
 * sidebar's sheet percentages, the Arena, sheets, patterns, leaderboards.
 */
export function useLeetCodeSynced(): () => Promise<void> {
  const { refreshProfile } = useAuth();
  const invalidateAll = useInvalidateAll();
  return useCallback(async () => {
    await refreshProfile();
    await invalidateAll();
  }, [refreshProfile, invalidateAll]);
}
