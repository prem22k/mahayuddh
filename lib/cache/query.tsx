"use client";

/**
 * The client data cache. Every page reads server data through `useCachedQuery`.
 *
 * What a caller gets:
 * - First visit: `isLoading` until the data arrives (show the skeleton).
 * - Revisit: the last data immediately, `isLoading` false, and a quiet
 *   background refresh when the data is older than `freshForMs`. No skeleton.
 * - The same key used by several components on one screen: one request.
 * - After a write: call `invalidate("name", ...)` from `useInvalidate()` and
 *   every mounted reader of those names refetches in the background.
 *
 * Safety rules (see lib/cache/keys.ts):
 * - Keys are scoped to the signed-in user; entries owned by anyone else are
 *   deleted as soon as the user changes, and could not be read anyway.
 * - The cache lives in memory only. Nothing is written to localStorage, so a
 *   shared computer keeps nothing once the tab closes.
 * - Nothing here changes what the server returns or caches; RLS still decides
 *   every row. API responses stay `Cache-Control: no-store`.
 */

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import useSWR, { SWRConfig, useSWRConfig, type Cache } from "swr";
import { matchesNames, ownedBy, scopedKey, serializedOwnerPrefix, type QueryKey } from "./keys";

/** undefined while auth is still resolving; null when signed out. */
type Owner = string | null | undefined;
const OwnerContext = createContext<Owner>(undefined);

/** Default freshness: a revisit within this window does not refetch at all. */
const DEFAULT_FRESH_MS = 30_000;

export function DataCacheProvider({ userId, children }: { userId: Owner; children: ReactNode }) {
  // One Map for the life of the tab; SWR reads `provider` once on mount.
  const [cache] = useState(() => new Map() as Cache);

  // Drop every entry that belongs to someone other than the current owner.
  // Keys are already user-scoped, so this is memory hygiene and shared-device
  // hygiene, not the thing that prevents a leak.
  useEffect(() => {
    if (userId === undefined) return;
    const keep = serializedOwnerPrefix(userId);
    for (const key of Array.from(cache.keys())) {
      if (!key.startsWith(keep)) cache.delete(key);
    }
  }, [cache, userId]);

  return (
    <OwnerContext.Provider value={userId}>
      <SWRConfig
        value={{
          provider: () => cache,
          dedupingInterval: DEFAULT_FRESH_MS,
          // Refresh when the user comes back to the tab, at most once a minute
          // per key, so a crowd of users switching tabs is not a request storm.
          revalidateOnFocus: true,
          focusThrottleInterval: 60_000,
          revalidateOnReconnect: true,
          // A changed key (another squad, another problem) must not show the
          // previous key's rows while the new ones load.
          keepPreviousData: false,
          errorRetryCount: 2,
        }}
      >
        {children}
      </SWRConfig>
    </OwnerContext.Provider>
  );
}

export interface CachedQuery<T> {
  data: T | undefined;
  error: unknown;
  /** True only while there is nothing to show yet. Gate skeletons on this. */
  isLoading: boolean;
  /** A background refresh is running while cached data is shown. */
  isRefreshing: boolean;
  /** Refetch now (pull-to-refresh, a Retry button). */
  refresh: () => Promise<T | undefined>;
  /**
   * Replace the cached value locally (an optimistic update). It does NOT
   * refetch: a refetch fired before the write lands reads the old row and
   * puts it back (the bell re-showed a notification it had just marked read).
   * Call `refresh()` once the write has resolved, success or failure.
   */
  setData: (next: T | ((current: T | undefined) => T | undefined)) => Promise<T | undefined>;
}

/**
 * Read server data through the cache.
 *
 * @param key `["name", ...everything the data depends on]`, or null to not
 *   fetch (missing squad id, feature off). Do not include the user id; the
 *   cache scopes keys to the signed-in user itself, and waits for auth.
 * @param fetcher Loads the data. Throw on failure; the error is returned and
 *   the last good data stays visible.
 */
export function useCachedQuery<T>(
  key: QueryKey | null,
  fetcher: () => Promise<T>,
  options: {
    freshForMs?: number;
    /**
     * Poll every N ms while the tab is visible (paused when hidden). For
     * long-lived shell widgets such as the notification bell, which never
     * remount and so would otherwise only refresh on focus.
     */
    pollEveryMs?: number;
  } = {},
): CachedQuery<T> {
  const owner = useContext(OwnerContext);
  const authPending = owner === undefined;
  const swrKey = authPending ? null : scopedKey(owner ?? null, key);

  const swr = useSWR<T>(swrKey, () => fetcher(), {
    dedupingInterval: options.freshForMs ?? DEFAULT_FRESH_MS,
    refreshInterval: options.pollEveryMs ?? 0,
    refreshWhenHidden: false,
  });

  const { mutate } = swr;
  const refresh = useCallback(() => mutate(), [mutate]);
  const setData = useCallback(
    (next: T | ((current: T | undefined) => T | undefined)) =>
      mutate(next as T | ((current?: T) => T | undefined), { revalidate: false }),
    [mutate],
  );

  return {
    data: swr.data,
    error: swr.error,
    isLoading: (authPending && key !== null) || swr.isLoading,
    isRefreshing: swr.isValidating && swr.data !== undefined,
    refresh,
    setData,
  };
}

/**
 * After a write, refetch every cached query with one of these names for the
 * current user. Mounted readers update in place; unmounted ones refetch when
 * next shown.
 */
export function useInvalidate(): (...names: string[]) => Promise<unknown> {
  const { mutate } = useSWRConfig();
  const owner = useContext(OwnerContext);
  return useCallback(
    (...names: string[]) => mutate((stored) => matchesNames(stored, owner ?? null, names)),
    [mutate, owner],
  );
}

/**
 * Refetch every cached query of the current user. For changes that touch
 * almost everything at once, e.g. a LeetCode sync, which can change solve
 * statuses, sheet and pattern progress, stats, streaks and leaderboards.
 * Mounted readers update in place; the rest refetch when next shown.
 */
export function useInvalidateAll(): () => Promise<unknown> {
  const { mutate } = useSWRConfig();
  const owner = useContext(OwnerContext);
  return useCallback(() => mutate((stored) => ownedBy(stored, owner ?? null)), [mutate, owner]);
}
