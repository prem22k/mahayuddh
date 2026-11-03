"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { clock } from "./motion";

/**
 * The landing's one piece of shared state: a demo battle on today's problem.
 *
 * Pressing "Try it" on the hero Pass starts a real timer. It follows the
 * visitor down the page as the solve dock, and a submitted run fills the
 * visitor's dot on the squad streak. Nothing is stored or sent anywhere.
 */

export type BattleStatus = "idle" | "running" | "paused" | "submitted";

type Battle = {
  status: BattleStatus;
  /** whole seconds on the clock */
  elapsed: number;
  heroInView: boolean;
  /** the closing call to action is on screen: the dock steps aside for it */
  closeInView: boolean;
  /** true for a few seconds after a submit, while the dock confirms it */
  justSubmitted: boolean;
  /** the visitor pressed "Log today's solve" on the streak card */
  streakLogged: boolean;
  announcement: string;
  start: () => void;
  pause: () => void;
  resume: () => void;
  submit: () => void;
  reset: () => void;
  logStreak: () => void;
  setHeroInView: (v: boolean) => void;
  setCloseInView: (v: boolean) => void;
};

const BattleContext = createContext<Battle | null>(null);

export function useBattle() {
  const ctx = useContext(BattleContext);
  if (!ctx) throw new Error("useBattle must be used inside <BattleProvider>");
  return ctx;
}

export function BattleProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<BattleStatus>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [heroInView, setHeroInView] = useState(true);
  const [closeInView, setCloseInView] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [streakLogged, setStreakLogged] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  // Banked milliseconds from earlier running stretches, plus when the current
  // stretch began. Wall-clock based, so a throttled background tab stays honest.
  const bankedMs = useRef(0);
  const startedAt = useRef(0);

  useEffect(() => {
    if (status !== "running") return;
    const id = window.setInterval(() => {
      setElapsed(Math.floor((bankedMs.current + Date.now() - startedAt.current) / 1000));
    }, 250);
    return () => window.clearInterval(id);
  }, [status]);

  useEffect(() => {
    if (!justSubmitted) return;
    const id = window.setTimeout(() => setJustSubmitted(false), 5200);
    return () => window.clearTimeout(id);
  }, [justSubmitted]);

  const start = useCallback(() => {
    bankedMs.current = 0;
    startedAt.current = Date.now();
    setElapsed(0);
    setStatus("running");
    setAnnouncement("Battle started. The timer is running.");
  }, []);

  const pause = useCallback(() => {
    bankedMs.current += Date.now() - startedAt.current;
    setElapsed(Math.floor(bankedMs.current / 1000));
    setStatus("paused");
    setAnnouncement("Timer paused.");
  }, []);

  const resume = useCallback(() => {
    startedAt.current = Date.now();
    setStatus("running");
    setAnnouncement("Timer running.");
  }, []);

  const statusRef = useRef<BattleStatus>("idle");
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const submit = useCallback(() => {
    if (statusRef.current === "running") bankedMs.current += Date.now() - startedAt.current;
    const secs = Math.max(1, Math.floor(bankedMs.current / 1000));
    setElapsed(secs);
    setStatus("submitted");
    setJustSubmitted(true);
    setAnnouncement(`Solved in ${clock(secs)}. Logged as self-reported.`);
  }, []);

  const reset = useCallback(() => {
    bankedMs.current = 0;
    setElapsed(0);
    setStatus("idle");
    setJustSubmitted(false);
    setAnnouncement("Timer reset.");
  }, []);

  const logStreak = useCallback(() => {
    setStreakLogged(true);
    setAnnouncement("Today's solve logged. All five solved today; the streak holds.");
  }, []);

  const value = useMemo<Battle>(
    () => ({
      status,
      elapsed,
      heroInView,
      closeInView,
      justSubmitted,
      streakLogged,
      announcement,
      start,
      pause,
      resume,
      submit,
      reset,
      logStreak,
      setHeroInView,
      setCloseInView,
    }),
    [status, elapsed, heroInView, closeInView, justSubmitted, streakLogged, announcement, start, pause, resume, submit, reset, logStreak]
  );

  return <BattleContext.Provider value={value}>{children}</BattleContext.Provider>;
}
