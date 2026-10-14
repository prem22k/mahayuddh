"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from "react";
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
const ACCUM_KEY = "mahayuddh_timer_accum";
const BATTLE_KEY = "mahayuddh_battle_id";
const STARTED_AT_KEY = "mahayuddh_battle_started_at";

/**
 * Stable battle state. Changes only on start/stop/problem switch — never
 * every second. Components that never read the timer subscribe only here,
 * so the per-second tick does not re-render them.
 */
interface SolvingStateContextType {
  activeProblem: ActiveProblem | null;
  setActiveProblem: (problem: ActiveProblem | null) => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  startSolving: (problem: ActiveProblem) => void;
  /** Clear accumulated time + wall-clock start + persisted timer keys. */
  resetSolving: () => void;
}

/**
 * Ticking timer state. Re-renders every second while a battle runs.
 * Subscribe via useSolvingTimer() only where the time is actually read
 * (the solve dock, the Arena hero). Timer math is untouched by the split:
 * the tick still lives where it always has.
 */
interface SolvingTimerContextType {
  seconds: number;
  setSeconds: React.Dispatch<React.SetStateAction<number>>;
  startedAt: number | null;
}

/** Combined shape (type only, for call sites migrating to the split hooks). */
export type SolvingContextType = SolvingStateContextType & SolvingTimerContextType;

const SolvingStateContext = createContext<SolvingStateContextType>({
  activeProblem: null,
  setActiveProblem: () => {},
  isPlaying: false,
  setIsPlaying: () => {},
  startSolving: () => {},
  resetSolving: () => {},
});

const SolvingTimerContext = createContext<SolvingTimerContextType>({
  seconds: 0,
  setSeconds: () => {},
  startedAt: null,
});

export function SolvingProvider({ children }: { children: React.ReactNode }) {
  const [activeProblem, setActiveProblemState] = useState<ActiveProblem | null>(null);
  const [isPlaying, setIsPlayingState] = useState(false);
  const [seconds, setSecondsState] = useState(0);
  // Accumulated elapsed seconds (float). The single source of truth for the
  // timer; advanced only by performance.now() deltas while playing, so clock
  // jumps, sleep, and throttled intervals cannot invent time.
  const accumRef = useRef<number>(0);
  // performance.now() at the last tick/resume; null while paused.
  const lastPerfRef = useRef<number | null>(null);
  const isPlayingRef = useRef(false);
  // Ref, not state: the tick reads it every second and must never go stale.
  const startedAtRef = useRef<number | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const persistTimer = useCallback((accum: number, start: number | null, secs: number) => {
    try {
      localStorage.setItem(ACCUM_KEY, String(accum));
      localStorage.setItem(SECONDS_KEY, String(secs));
      if (start != null) localStorage.setItem(STARTED_AT_KEY, String(start));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(ACTIVE_KEY);
      if (saved) setActiveProblemState(JSON.parse(saved));
      const savedAccum = localStorage.getItem(ACCUM_KEY);
      const savedSeconds = localStorage.getItem(SECONDS_KEY);
      const accum = savedAccum != null ? Number(savedAccum) : NaN;
      if (Number.isFinite(accum) && accum >= 0) {
        accumRef.current = accum;
        setSecondsState(Math.floor(accum));
      } else if (savedSeconds) {
        const s = parseInt(savedSeconds, 10) || 0;
        accumRef.current = s;
        setSecondsState(s);
      }
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

  // Pause freezes accumulation (stores the frozen value); resume shifts the
  // performance.now() baseline so paused time never counts.
  const setIsPlaying = useCallback(
    (playing: boolean) => {
      if (playing === isPlayingRef.current) {
        setIsPlayingState(playing);
        return;
      }
      if (playing) {
        lastPerfRef.current = performance.now();
        isPlayingRef.current = true;
        setIsPlayingState(true);
      } else {
        if (lastPerfRef.current != null) {
          const now = performance.now();
          accumRef.current += Math.max(0, (now - lastPerfRef.current) / 1000);
          lastPerfRef.current = null;
        }
        isPlayingRef.current = false;
        setIsPlayingState(false);
        const frozen = accumRef.current;
        setSecondsState(Math.floor(frozen));
        persistTimer(frozen, startedAtRef.current, Math.floor(frozen));
      }
    },
    [persistTimer]
  );

  // Keep the ref in sync if state changes from any other path.
  useEffect(() => {
    isPlayingRef.current = isPlaying;
    if (isPlaying && lastPerfRef.current == null) {
      lastPerfRef.current = performance.now();
    }
    if (!isPlaying && lastPerfRef.current != null) {
      const now = performance.now();
      accumRef.current += Math.max(0, (now - lastPerfRef.current) / 1000);
      lastPerfRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  // Auto-pause when the tab hides: background time is not solving time.
  useEffect(() => {
    const onVis = () => {
      if (document.hidden && isPlayingRef.current) {
        if (lastPerfRef.current != null) {
          const now = performance.now();
          accumRef.current += Math.max(0, (now - lastPerfRef.current) / 1000);
          lastPerfRef.current = null;
        }
        isPlayingRef.current = false;
        setIsPlayingState(false);
        const frozen = accumRef.current;
        setSecondsState(Math.floor(frozen));
        persistTimer(frozen, startedAtRef.current, Math.floor(frozen));
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [persistTimer]);

  const setActiveProblem = useCallback((problem: ActiveProblem | null) => {
    setActiveProblemState(problem);
    try {
      if (problem) {
        localStorage.setItem(ACTIVE_KEY, JSON.stringify(problem));
      } else {
        localStorage.removeItem(ACTIVE_KEY);
        localStorage.removeItem(SECONDS_KEY);
        localStorage.removeItem(ACCUM_KEY);
        localStorage.removeItem(BATTLE_KEY);
        localStorage.removeItem(STARTED_AT_KEY);
      }
    } catch (e) {
      console.warn("Could not save active problem to storage", e);
    }
  }, []);

  const startSolving = useCallback(
    (problem: ActiveProblem) => {
      setActiveProblem(problem);
      accumRef.current = 0;
      lastPerfRef.current = performance.now();
      isPlayingRef.current = true;
      setSecondsState(0);
      setIsPlayingState(true);
      const now = Date.now();
      startedAtRef.current = now;
      setStartedAt(now);
      persistTimer(0, now, 0);
      track("battle_started", { problem_slug: problem.slug });
      // Wave D funnel: the FIRST battle start, ever, on this device. Guarded
      // by a localStorage flag so a second battle never recounts. Timer math
      // above is untouched — this is a counter only.
      try {
        if (typeof localStorage !== "undefined" && !localStorage.getItem("mahayuddh.first_battle_started")) {
          localStorage.setItem("mahayuddh.first_battle_started", "1");
          track("first_battle_started", { problem_slug: problem.slug });
        }
      } catch {
        // Storage unavailable: the funnel misses one event, the battle still starts.
      }
    },
    [setActiveProblem, persistTimer]
  );

  // Reset clears accumulated time, the wall-clock start, and persisted keys.
  const resetSolving = useCallback(() => {
    accumRef.current = 0;
    lastPerfRef.current = isPlayingRef.current ? performance.now() : null;
    startedAtRef.current = null;
    setStartedAt(null);
    setSecondsState(0);
    try {
      localStorage.removeItem(SECONDS_KEY);
      localStorage.removeItem(ACCUM_KEY);
      localStorage.removeItem(STARTED_AT_KEY);
    } catch {
      // ignore
    }
  }, []);

  // A reset through setSeconds(0) clears accumulation too, so a stale
  // performance.now() baseline cannot resurrect old time.
  const setSeconds: React.Dispatch<React.SetStateAction<number>> = useCallback(
    (action) => {
      setSecondsState((prev) => {
        const next = typeof action === "function" ? (action as (p: number) => number)(prev) : action;
        if (next === 0) {
          accumRef.current = 0;
          lastPerfRef.current = isPlayingRef.current ? performance.now() : null;
          startedAtRef.current = null;
          setStartedAt(null);
          try {
            localStorage.removeItem(SECONDS_KEY);
            localStorage.removeItem(ACCUM_KEY);
            localStorage.removeItem(STARTED_AT_KEY);
          } catch {
            // ignore
          }
        } else {
          accumRef.current = next;
        }
        return next;
      });
    },
    []
  );

  // Accumulation tick: advance only by performance.now() deltas while playing.
  useEffect(() => {
    if (!isPlaying) return;
    if (lastPerfRef.current == null) lastPerfRef.current = performance.now();
    const t = setInterval(() => {
      if (!isPlayingRef.current || lastPerfRef.current == null) return;
      const now = performance.now();
      const delta = Math.max(0, (now - lastPerfRef.current) / 1000);
      // Cap one tick at 5s; the visibility handler already pauses on hide.
      accumRef.current += Math.min(delta, 5);
      lastPerfRef.current = now;
      const floored = Math.floor(accumRef.current);
      setSecondsState((prev) => (prev === floored ? prev : floored));
    }, 500);
    return () => clearInterval(t);
  }, [isPlaying]);

  // Persist elapsed seconds periodically
  useEffect(() => {
    if (activeProblem && seconds > 0 && seconds % 5 === 0) {
      persistTimer(accumRef.current, startedAtRef.current, seconds);
    }
  }, [seconds, activeProblem, persistTimer]);

  // Stable value: identity changes only when battle state changes, never on tick.
  const stateValue = useMemo<SolvingStateContextType>(
    () => ({ activeProblem, setActiveProblem, isPlaying, setIsPlaying, startSolving, resetSolving }),
    [activeProblem, setActiveProblem, isPlaying, setIsPlaying, startSolving, resetSolving]
  );

  // Ticking value: identity changes every second — subscribers opt in explicitly.
  const timerValue = useMemo<SolvingTimerContextType>(
    () => ({ seconds, setSeconds, startedAt }),
    [seconds, setSeconds, startedAt]
  );

  return (
    <SolvingStateContext.Provider value={stateValue}>
      <SolvingTimerContext.Provider value={timerValue}>
        {children}
      </SolvingTimerContext.Provider>
    </SolvingStateContext.Provider>
  );
}

/**
 * Stable battle state (activeProblem, isPlaying, startSolving). Does NOT
 * re-render every second. Default for all call sites.
 */
export function useSolving() {
  const context = useContext(SolvingStateContext);
  if (!context) {
    throw new Error("useSolving must be used within a SolvingProvider");
  }
  return context;
}

/**
 * Ticking timer (seconds, setSeconds, startedAt). Re-renders every second
 * while a battle runs — use only where the time is actually displayed.
 */
export function useSolvingTimer() {
  const context = useContext(SolvingTimerContext);
  if (!context) {
    throw new Error("useSolvingTimer must be used within a SolvingProvider");
  }
  return context;
}

export const BATTLE_ID_STORAGE_KEY = BATTLE_KEY;
