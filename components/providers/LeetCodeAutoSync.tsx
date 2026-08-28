"use client";

import { useEffect, useRef, useCallback } from "react";
import { useAuth } from "./AuthProvider";
import confetti from "canvas-confetti";

export function LeetCodeAutoSync() {
  const { profile, refreshProfile } = useAuth();
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: handle }),
      });

      if (!res.ok) return;
      const data = await res.json();

      if (data?.recentSubmissions && Array.isArray(data.recentSubmissions)) {
        let newlyDetected = 0;
        data.recentSubmissions.forEach((sub: { titleSlug: string; title: string }) => {
          if (sub.titleSlug) {
            const slug = sub.titleSlug.toLowerCase();
            // Dispatch event for any recent submission so open sheet views stay fresh
            window.dispatchEvent(
              new CustomEvent("problem-status-changed", {
                detail: { slug, status: "solved" },
              })
            );

            if (knownSolvedSlugsRef.current.size > 0 && !knownSolvedSlugsRef.current.has(slug)) {
              newlyDetected++;
            }
            knownSolvedSlugsRef.current.add(slug);
          }
        });

        if (newlyDetected > 0) {
          confetti({
            particleCount: 45,
            spread: 55,
            origin: { y: 0.85 },
            colors: ["#30d158", "#fa586a", "#ffffff"],
          });
          refreshProfile();
        }
      }
    } catch {
      // Background sync silent fail
    }
  }, [profile?.leetcode_username, refreshProfile]);

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
