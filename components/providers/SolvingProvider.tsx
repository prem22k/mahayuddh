"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { track } from "@/lib/analytics";

export interface ActiveProblem {
  id: string | number;
  title: string;
  slug: string;
  difficulty: "Easy" | "Medium" | "Hard" | string;
  category: string;
  /** Set when the battle was started from an accepted challenge. */
  challengeId?: string;
}

const ACTIVE_KEY = "mahayuddh_active_problem";
const SECONDS_KEY = "mahayuddh_timer_seconds";
const BATTLE_KEY = "mahayuddh_battle_id";
const STARTED_AT_KEY = "mahayuddh_battle_started_at";

interface SolvingContextType {
  activeProblem: ActiveProblem | null;
  setActiveProblem: (problem: ActiveProblem | null) => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  seconds: number;
  setSeconds: React.Dispatch<React.SetStateAction<number>>;
  startSolving: (problem: ActiveProblem) => void;
  /**
   * Wall-clock start of the running session. The dock derives elapsed time from
   * this rather than accumulating ticks, so a backgrounded tab, a throttled
   * interval, or a dropped frame can't make the timer drift.
   */
  startedAt: number | null;
}

const SolvingContext = createContext<SolvingContextType>({
  activeProblem: null,
  setActiveProblem: () => {},
  isPlaying: false,
  setIsPlaying: () => {},
  seconds: 0,
  setSeconds: () => {},
  startSolving: () => {},
  startedAt: null,
});

export function SolvingProvider({ children }: { children: React.ReactNode }) {
  const [activeProblem, setActiveProblemState] = useState<ActiveProblem | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [seconds, setSeconds] = useState(0);
  // Ref, not state: the tick reads it every second and must never go stale.
  const startedAtRef = useRef<number | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(ACTIVE_KEY);
      if (saved) setActiveProblemState(JSON.parse(saved));
      const savedSeconds = localStorage.getItem(SECONDS_KEY);
      if (savedSeconds) setSeconds(parseInt(savedSeconds, 10) || 0);
      // Restore the wall-clock start too: without it a refresh would reset the
      // timer to whatever the stale tick left behind.
      const savedStartedAt = localStorage.getItem(STARTED_AT_KEY);
      if (savedStartedAt) {
        const parsed = Number(savedStartedAt);
        if (Number.isFinite(parsed) && parsed > 0) {
          startedAtRef.current = parsed;
          setStartedAt(parsed);
        }
      }
    } catch (e) {
      console.warn("Could not restore active problem from storage", e);
    }
  }, []);

  const setActiveProblem = (problem: ActiveProblem | null) => {
    setActiveProblemState(problem);
    try {
      if (problem) {
        localStorage.setItem(ACTIVE_KEY, JSON.stringify(problem));
      } else {
        localStorage.removeItem(ACTIVE_KEY);
        localStorage.removeItem(SECONDS_KEY);
        localStorage.removeItem(BATTLE_KEY);
        localStorage.removeItem(STARTED_AT_KEY);
      }
    } catch (e) {
      console.warn("Could not save active problem to storage", e);
    }
  };

  const startSolving = (problem: ActiveProblem) => {
    setActiveProblem(problem);
    setSeconds(0);
    setIsPlaying(true);
    const now = Date.now();
    startedAtRef.current = now;
    setStartedAt(now);
    try {
      localStorage.setItem(STARTED_AT_KEY, String(now));
      localStorage.setItem(SECONDS_KEY, "0");
    } catch {
      // ignore
    }
    track("battle_started", { problem_slug: problem.slug });
  };

  // Persist elapsed seconds periodically
  useEffect(() => {
    if (activeProblem && seconds > 0 && seconds % 5 === 0) {
      try {
        localStorage.setItem(SECONDS_KEY, seconds.toString());
      } catch {
        // ignore
      }
    }
  }, [seconds, activeProblem]);

  return (
    <SolvingContext.Provider
      value={{
        activeProblem,
        setActiveProblem,
        isPlaying,
        setIsPlaying,
        seconds,
        setSeconds,
        startSolving,
        startedAt,
      }}
    >
      {children}
    </SolvingContext.Provider>
  );
}

export function useSolving() {
  const context = useContext(SolvingContext);
  if (!context) {
    throw new Error("useSolving must be used within a SolvingProvider");
  }
  return context;
}

export const BATTLE_ID_STORAGE_KEY = BATTLE_KEY;