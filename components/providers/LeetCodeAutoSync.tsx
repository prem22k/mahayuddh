"use client";

import { useEffect, useRef, useCallback } from "react";
import { useAuth } from "./AuthProvider";
import { useLeetCodeSynced } from "@/lib/leetcode/useLeetCodeSynced";

export function LeetCodeAutoSync() {
  const { profile, session } = useAuth();
  const leetcodeSynced = useLeetCodeSynced();
  const lastSyncRef = useRef<number>(0);
  const knownSolvedSlugsRef = useRef<Set<string>>(new Set());

  const runSync = useCallback(async () => {
    const handle = profile?.leetcode_username;
    if (!handle) return;

    const now = Date.now();
    // Throttle to at most once every 20 seconds
    if (now - lastSyncRef.current < 20000) return;
    lastSyncRef.current = now;

    try {
      const res = await fetch("/api/sync/leetcode", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ username: handle }),
      });

      if (!res.ok) return;
      const data = await res.json();

      // Refresh what's on screen only when the sync changed something: new
      // solves recorded from LeetCode, or totals that differ from the profile.
      // This runs on every focus, so an unconditional refetch of every cached
      // query would be a burst per user per tab switch.
      const s = data?.stats as { totalEasy?: number; totalMedium?: number; totalHard?: number } | undefined;
      const totalsChanged =
        !!s &&
        (s.totalEasy !== profile?.total_easy ||
          s.totalMedium !== profile?.total_medium ||
          s.totalHard !== profile?.total_hard);
      if ((Number(data?.inferredSolved) || 0) > 0 || totalsChanged) {
        void leetcodeSynced();
      }

      if (data?.recentSubmissions && Array.isArray(data.recentSubmissions)) {
        let newlyDetected = 0;
        const seeding = knownSolvedSlugsRef.current.size === 0;
        data.recentSubmissions.forEach((sub: { titleSlug: string; title: string }) => {
          if (sub.titleSlug) {
            const slug = sub.titleSlug.toLowerCase();
            // First run only seeds the baseline silently; later runs notify
            // (and celebrate) strictly new solves. Broadcasting every recent
            // on every tab-focus would storm open views with redundant
            // refetches.
            const isNew = !seeding && !knownSolvedSlugsRef.current.has(slug);
            knownSolvedSlugsRef.current.add(slug);
            if (!isNew) return;

            newlyDetected++;
            window.dispatchEvent(
              new CustomEvent("problem-status-changed", {
                detail: { slug, status: "solved" },
              })
            );
          }
        });

        if (newlyDetected > 0) {
          try {
            const confetti = (await import("canvas-confetti")).default;
            confetti({
              particleCount: 45,
              spread: 55,
              origin: { y: 0.85 },
              colors: ["#F5B83D", "#3DDC97", "#8B91F7", "#EDEDEF"],
            });
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // Background sync silent fail
    }
  }, [profile?.leetcode_username, profile?.total_easy, profile?.total_medium, profile?.total_hard, leetcodeSynced, session?.access_token]);

  useEffect(() => {
    if (!profile?.leetcode_username) return;

    // Run on initial mount
    const timeout = setTimeout(() => {
      runSync();
    }, 1500);

    // Run when user switches back to this tab (e.g. after solving on LeetCode!)
    const handleFocus = () => {
      runSync();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        runSync();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearTimeout(timeout);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [profile?.leetcode_username, runSync]);

  return null;
}
