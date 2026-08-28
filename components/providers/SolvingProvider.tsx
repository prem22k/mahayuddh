"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export interface ActiveProblem {
  id: string | number;
  title: string;
  slug: string;
  difficulty: "Easy" | "Medium" | "Hard" | string;
  category: string;
}

interface SolvingContextType {
  activeProblem: ActiveProblem | null;
  setActiveProblem: (problem: ActiveProblem | null) => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  seconds: number;
  setSeconds: React.Dispatch<React.SetStateAction<number>>;
  startSolving: (problem: ActiveProblem) => void;
}

const SolvingContext = createContext<SolvingContextType>({
  activeProblem: null,
  setActiveProblem: () => {},
  isPlaying: false,
  setIsPlaying: () => {},
  seconds: 0,
  setSeconds: () => {},
  startSolving: () => {},
});

export function SolvingProvider({ children }: { children: React.ReactNode }) {
  const [activeProblem, setActiveProblemState] = useState<ActiveProblem | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [seconds, setSeconds] = useState(0);

  // Load from localStorage on client mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("mahayuddh_active_problem");
      if (saved) {
        setActiveProblemState(JSON.parse(saved));
      }
      const savedSeconds = localStorage.getItem("mahayuddh_timer_seconds");
      if (savedSeconds) {
        setSeconds(parseInt(savedSeconds, 10) || 0);
      }
    } catch (e) {
      console.warn("Could not restore active problem from storage", e);
    }
  }, []);

  const setActiveProblem = (problem: ActiveProblem | null) => {
    setActiveProblemState(problem);
    try {
      if (problem) {
        localStorage.setItem("mahayuddh_active_problem", JSON.stringify(problem));
      } else {
        localStorage.removeItem("mahayuddh_active_problem");
        localStorage.removeItem("mahayuddh_timer_seconds");
      }
    } catch (e) {
      console.warn("Could not save active problem to storage", e);
    }
  };

  const startSolving = (problem: ActiveProblem) => {
    setActiveProblem(problem);
    setSeconds(0);
    setIsPlaying(true);
  };

  // Persist elapsed seconds periodically
  useEffect(() => {
    if (activeProblem && seconds > 0 && seconds % 5 === 0) {
      try {
        localStorage.setItem("mahayuddh_timer_seconds", seconds.toString());
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
