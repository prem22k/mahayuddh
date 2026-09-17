"use client";

import { useEffect, useRef, useCallback } from "react";
import { useAuth } from "./AuthProvider";
import confetti from "canvas-confetti";

export function LeetCodeAutoSync() {
  const { profile, refreshProfile, session } = useAuth();
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
          confetti({
            particleCount: 45,
            spread: 55,
            origin: { y: 0.85 },
            colors: ["#30d158", "#fa586a", "#ffffff"],
          });
          void refreshProfile();
        }
      }
    } catch {
      // Background sync silent fail
    }
  }, [profile?.leetcode_username, refreshProfile, session?.access_token]);

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
