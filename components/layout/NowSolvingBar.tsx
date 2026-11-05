"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Play,
  Pause,
  RotateCcw,
  X,
  Check,
  ArrowUp,
  MoreHorizontal,
  Shuffle,
  Search,
} from "lucide-react";
import { cn, formatTime } from "@/lib/utils";
import { ProblemLink } from "@/components/ui/ProblemLink";
import { DifficultyBadgeNew } from "@/components/ui/Badge";
import {
  useSolving,
  useSolvingTimer,
  BATTLE_ID_STORAGE_KEY,
} from "@/components/providers/SolvingProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { toggleProblemStatus, setProblemStatus } from "@/lib/data/sheets";
import { track } from "@/lib/analytics";
import { startBattle, heartbeatBattle, endBattle, verifyBattle, type SolvedQuestion } from "@/lib/data/battles";
import { logProblemEvent } from "@/lib/data/problemEvents";
import { logFeedEvent } from "@/lib/data/feed";
import { revengeResultLabel, RevengeResult } from "@/lib/revenge";
import { StuckLadder } from "@/components/battle/StuckLadder";
import { detectRevengeCompletion } from "@/lib/data/revenge";
import {
  QuestionPicker,
  RandomDifficultySegmented,
  useQuestionCatalog,
  pickRandomProblem,
  loadPickerFilters,
  savePickerFilters,
  loadRandomDifficulty,
  saveRandomDifficulty,
  type PickerFilters,
} from "./QuestionPicker";
import { problemUrl } from "@/components/ui/ProblemLink";
import type { ListProblem } from "@/types/database";

interface NowSolvingBarProps {
  onSearchOpen?: () => void;
}

/** Which problem the stored battle id belongs to (resume-after-refresh guard). */
const BATTLE_SLUG_KEY = "mahayuddh_battle_slug";

/** When the person left this tab during a battle opened on LeetCode (ms epoch). */
const LEFT_AT_KEY = "mahayuddh_left_at";
/** Away at least this long before the return check runs: a quick tab switch is not a solve. */
const AWAY_CHECK_MS = 45_000;

interface BattleOutcome {
  kind: "solved" | "failed";
  title: string;
  seconds: number;
  evidence?: "leetcode" | "none";
  otherSolved?: SolvedQuestion[];
}

interface VerificationNotice {
  kind: "unverified" | "others_only";
  title: string;
  username?: string;
  reachable?: boolean;
  linked?: boolean;
  needsVerify?: boolean;
  solvedOthers?: SolvedQuestion[];
}

export function NowSolvingBar({ onSearchOpen }: NowSolvingBarProps) {
  void onSearchOpen;
  const { user, profile } = useAuth();
  // The shell can mount before auth resolves. Until it has, a solve or fail
  // would skip the write (no user) yet still end the battle, so the ending
  // actions stay locked.
  const canEnd = Boolean(user);
  const {
    activeProblem,
    setActiveProblem,
    isPlaying,
    setIsPlaying,
    resetSolving,
    startSolving,
  } = useSolving();
  // Ticking subscription: only the dock reads the per-second timer, so only
  // the dock re-renders on tick. Timer math itself is untouched.
  const { seconds, startedAt } = useSolvingTimer();

  // Elapsed time is the provider's accumulated value (performance.now()
  // deltas, frozen while paused). Never derived from Date.now() here, so
  // clock jumps cannot invent solving time.
  const elapsedSec = seconds;

  const [isScratchpadOpen, setIsScratchpadOpen] = useState(false);
  const [scratchpadNote, setScratchpadNote] = useState("");
  // A solve or fail is in flight: the buttons lock so it can't be sent twice.
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  // The write was rejected: the battle stays open and the dock says so.
  const [saveError, setSaveError] = useState<string | null>(null);
  // How the last battle ended. Shown in the dock for a moment after it clears.
  const [outcome, setOutcome] = useState<BattleOutcome | null>(null);
  const [battleId, setBattleId] = useState<string | null>(null);
  const [stuckOpen, setStuckOpen] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [isHeartbeatLeader, setIsHeartbeatLeader] = useState(true);
  // Step 17: closes the "failed -> solved" loop with the real before/after.
  const [revengeResult, setRevengeResult] = useState<RevengeResult | null>(null);
  // Feeds the ladder's suggested level: how many tries have you already had?
  const [attemptCount, setAttemptCount] = useState(1);
  const [capsuleMenuOpen, setCapsuleMenuOpen] = useState(false);

  // Idle question picker filters & catalog
  // Defaults on the first render (it is server-rendered too), then the saved
  // values once mounted, so the server and client markup agree.
  const [filters, setFiltersState] = useState<PickerFilters>({ difficulty: "", category: "" });
  const setFilters = useCallback((next: PickerFilters) => {
    setFiltersState(next);
    savePickerFilters(next);
  }, []);

  // Difficulty for the random button only
  const [randomDifficulty, setRandomDifficultyState] = useState<string>("");
  useEffect(() => {
    setFiltersState(loadPickerFilters());
    setRandomDifficultyState(loadRandomDifficulty());
  }, []);
  const setRandomDifficulty = useCallback((next: string) => {
    setRandomDifficultyState(next);
    saveRandomDifficulty(next);
  }, []);

  const isIdle = !activeProblem;
  const catalog = useQuestionCatalog(isIdle, user?.id ?? null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  // LeetCode verification states
  const [verificationNotice, setVerificationNotice] = useState<VerificationNotice | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const isVerifyingRef = useRef(false);
  const [cooldownSec, setCooldownSec] = useState(0);

  // Cooldown countdown
  useEffect(() => {
    if (cooldownSec <= 0) return;
    const t = setInterval(() => {
      setCooldownSec((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [cooldownSec]);

  // Load scratchpad note whenever activeProblem changes
  useEffect(() => {
    setSessionExpired(false);
    setVerificationNotice(null);
    if (activeProblem?.slug) {
      const savedNote = localStorage.getItem(`mahayuddh_notes_${activeProblem.slug}`) || "";
      setScratchpadNote(savedNote);
      setSaveError(null);
      setOutcome(null);
      setStuckOpen(false);

      // Resume the existing server session after a refresh. Without this the
      // battleId was lost, heartbeats silently no-op'd, and the server row was
      // abandoned by the next start (Step 7: "session survives refresh").
      const storedBattleId = (() => {
        try {
          return localStorage.getItem(BATTLE_ID_STORAGE_KEY);
        } catch {
          return null;
        }
      })();
      // How many recorded attempts exist, so the ladder can suggest a level
      // instead of always opening at "nudge".
      import("@/lib/data/battles")
        .then(({ getBattlesForSlug }) => getBattlesForSlug(activeProblem.slug, 25))
        .then((rows) => setAttemptCount(Math.max(1, rows.length)))
        .catch(() => setAttemptCount(1));

      const storedSlug = (() => {
        try {
          const raw = localStorage.getItem(BATTLE_SLUG_KEY);
          return raw;
        } catch {
          return null;
        }
      })();

      if (storedBattleId && storedSlug === activeProblem.slug) {
        setBattleId(storedBattleId);
        return;
      }

      // Persist a server session (fire-and-forget; localStorage is the fallback).
      if (user) {
        startBattle(
          activeProblem.slug,
          profile?.active_squad_id ?? null,
          activeProblem.challengeId ?? null
        ).then((res) => {
          if (res.battle) {
            setBattleId(res.battle.id);
            try {
              localStorage.setItem(BATTLE_ID_STORAGE_KEY, res.battle.id);
              localStorage.setItem(BATTLE_SLUG_KEY, activeProblem.slug);
            } catch {
              // ignore
            }
          }
        }).catch(() => {});
      } else {
        setBattleId(null);
      }
    } else {
      setScratchpadNote("");
      setBattleId(null);
    }
    // user?.id: when the dock mounts before auth resolves, start the server
    // session once the user arrives instead of never.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProblem?.slug, user?.id]);

  // The per-second tick lives in the provider (performance.now()
  // accumulation); this component only re-renders from `seconds`.

  // Multi-tab leader election: only one tab heartbeats. Tabs announce over a
  // BroadcastChannel and the lowest id wins; others suppress heartbeats but
  // keep counting locally so a leader handoff never loses time.
  // A page restored from the back/forward cache gets a fresh channel (epoch).
  const [electionEpoch, setElectionEpoch] = useState(0);
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) setElectionEpoch((n) => n + 1);
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
      setIsHeartbeatLeader(true);
      return;
    }
    const tabId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const peers = new Set<string>([tabId]);
    let closed = false;
    const channel = new BroadcastChannel("mahayuddh_battle_heartbeat");
    // Posting on a closed channel throws InvalidStateError. The page keeps
    // running for a moment after pagehide (the ping interval used to fire into
    // a channel beforeunload had already closed), so every send is guarded.
    const send = (msg: { type: "hello" | "ping" | "bye"; id: string }) => {
      if (closed) return;
      try {
        channel.postMessage(msg);
      } catch {
        // closed underneath us
      }
    };
    const elect = () => {
      if (closed) return;
      const leader = Array.from(peers).sort()[0];
      setIsHeartbeatLeader(leader === tabId);
    };
    channel.onmessage = (ev: MessageEvent) => {
      const msg = ev.data as { type?: string; id?: string } | null;
      if (!msg || typeof msg.id !== "string") return;
      if (msg.type === "hello" || msg.type === "ping") {
        peers.add(msg.id);
        send({ type: "hello", id: tabId });
        elect();
      } else if (msg.type === "bye") {
        peers.delete(msg.id);
        elect();
      }
    };
    send({ type: "hello", id: tabId });
    const ping = setInterval(() => send({ type: "ping", id: tabId }), 5000);
    const t = setTimeout(elect, 600);
    const shutdown = () => {
      if (closed) return;
      send({ type: "bye", id: tabId });
      closed = true;
      clearInterval(ping);
      clearTimeout(t);
      channel.close();
    };
    window.addEventListener("pagehide", shutdown);
    return () => {
      window.removeEventListener("pagehide", shutdown);
      shutdown();
    };
  }, [electionEpoch]);

  const handleSaveNote = (text: string) => {
    setScratchpadNote(text);
    if (activeProblem?.slug) {
      localStorage.setItem(`mahayuddh_notes_${activeProblem.slug}`, text);
      // Mirror to server session (debounced by keystroke batching upstream).
      if (battleId) {
        heartbeatBattle(battleId, { scratchpad_md: text.slice(0, 20000) })
          .then((res) => {
            if (res.expired) {
              setSessionExpired(true);
              setIsPlaying(false);
            }
          })
          .catch(() => {});
      }
    }
  };

  // Heartbeat duration every 15s while solving (plan Step 7: persist every 15s).
  // Sends the accumulated value, only from the leader tab. A 410/expired
  // response stops the timer and tells the truth instead of counting silently.
  useEffect(() => {
    if (!isPlaying || !battleId || !isHeartbeatLeader || sessionExpired) return;
    let stopped = false;
    const send = () => {
      heartbeatBattle(battleId, { duration_sec: elapsedSec })
        .then((res) => {
          if (stopped) return;
          if (res.expired) {
            setSessionExpired(true);
            setIsPlaying(false);
          }
        })
        .catch(() => {});
    };
    send();
    const t = setInterval(send, 15000);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [isPlaying, battleId, isHeartbeatLeader, sessionExpired, elapsedSec, setIsPlaying]);

  // A battle that has ended (solved or failed) leaves the dock. Before this the
  // problem stayed loaded after a solve, so the dock sat on "Solved" and a
  // refresh resumed a battle that was already over.
  const clearBattle = useCallback(() => {
    try {
      localStorage.removeItem(BATTLE_SLUG_KEY);
    } catch {
      // ignore
    }
    setBattleId(null);
    setStuckOpen(false);
    setIsScratchpadOpen(false);
    setCapsuleMenuOpen(false);
    setSaveError(null);
    resetSolving();
    // Also drops the persisted active problem, timer and battle id.
    setActiveProblem(null);
  }, [resetSolving, setActiveProblem]);

  // The outcome line is a confirmation, not a state: it steps aside on its own.
  // Solved card stays for 15s; failed outcome line keeps 4s.
  useEffect(() => {
    if (!outcome) return;
    const timeoutMs = outcome.kind === "solved" ? 15000 : 4000;
    const t = setTimeout(() => setOutcome(null), timeoutMs);
    return () => clearTimeout(t);
  }, [outcome]);

  const handleComplete = useCallback(
    async (
      evidence: "leetcode" | "none" = "none",
      durationOverride?: number,
      otherSolved?: SolvedQuestion[]
    ) => {
      if (!activeProblem || !user || submittingRef.current) return;
      submittingRef.current = true;
      setSubmitting(true);
      setSaveError(null);
      // Snapshot: the dock clears below, so nothing after this reads live state.
      const problem = activeProblem;
      const duration = durationOverride !== undefined ? durationOverride : elapsedSec;
      const endedBattleId = battleId;

    try {
      // Persist first: only celebrate + notify when the write lands, so open
      // views never show a solve the database rejected.
      if (user) {
        let saved = false;
        // Revisit detection: solving an already-solved problem logs "revisited".
        let wasSolved = false;
        try {
          const { createClient } = await import("@/lib/supabase/client");
          const supabase = createClient();
          const { data: prev } = await supabase
            .from("user_problem_status")
            .select("status")
            .eq("user_id", user.id)
            .eq("problem_slug", problem.slug.toLowerCase())
            .maybeSingle();
          wasSolved = (prev as { status: string } | null)?.status === "solved";
          saved = await toggleProblemStatus(user.id, problem.slug, true);
        } catch (err) {
          console.error("Error marking problem as solved in Supabase:", err);
        }
        if (!saved) {
          // Keep the battle and the timer: nothing was recorded, so nothing ends.
          setSaveError("Solve not saved. Check your connection and try again.");
          return;
        }
        track("battle_solved", { problem_slug: problem.slug });
        if (wasSolved) track("revisit_done", { problem_slug: problem.slug, via: "dock" });
        // A server battle writes its own history row when it ends
        // (append_problem_event_on_battle_end, exactly once). Logging here as
        // well raced that trigger: the client "solved" landed first, the
        // trigger then saw a prior solve and appended a "revisited", and every
        // solve counted twice. The client logs only when no server row will.
        const logClientEvent = () =>
          logProblemEvent({
            problemSlug: problem.slug,
            kind: wasSolved ? "revisited" : "solved",
            battleId: null,
            durationSec: duration,
            source: evidence === "leetcode" ? "leetcode" : "self",
          }).catch(() => {});
        if (endedBattleId) {
          endBattle(endedBattleId, "solved", { duration_sec: duration, evidence })
            .then((res) => {
              if (res.error) logClientEvent();
            })
            .catch(logClientEvent);
        } else {
          logClientEvent();
        }
        // Squad activity: solves generate feed without requiring prose (§50).
        logFeedEvent({
          eventType: "solve",
          squadId: profile?.active_squad_id ?? null,
          problemTitle: problem.title,
          problemSlug: problem.slug,
          difficulty: problem.difficulty,
          metadata: { duration_sec: duration, source: evidence },
        }).catch(() => {});

        // Revenge (Step 17): a solve that answers a recorded failure is a
        // different event from a solve — it closes a loop the user opened.
        if (endedBattleId) {
          detectRevengeCompletion(problem.slug, endedBattleId, problem.title)
            .then((result) => {
              if (!result) return;
              track("revenge_completed", {
                problem_slug: problem.slug,
                improved: result.improved,
              });
              setRevengeResult(result);
            })
            .catch(() => {});
        }
        // Notify open sheet views so their solved status refreshes immediately.
        window.dispatchEvent(
          new CustomEvent("problem-status-changed", {
            detail: { slug: problem.slug, status: "solved" },
          })
        );
      }

      setIsPlaying(false);
      clearBattle();
      setVerificationNotice(null);
      setOutcome({
        kind: "solved",
        title: problem.title,
        seconds: duration,
        evidence,
        otherSolved,
      });

      try {
        const confetti = (await import("canvas-confetti")).default;
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.9 },
          colors: ["#F5B83D", "#3DDC97", "#8B91F7", "#EDEDEF"],
        });
      } catch {
        // ignore
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [activeProblem, setIsPlaying, user, battleId, elapsedSec, profile?.active_squad_id, clearBattle]);

  const handleFail = useCallback(async () => {
    if (!activeProblem || !user || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setSaveError(null);
    const problem = activeProblem;
    const duration = elapsedSec;
    const endedBattleId = battleId;
    try {
      // Failed ≠ unsolved: record an honest attempt, never downgrade a prior solve.
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data: existing } = await supabase
        .from("user_problem_status")
        .select("status")
        .eq("user_id", user.id)
        .eq("problem_slug", problem.slug.toLowerCase())
        .maybeSingle();
      if ((existing as { status: string } | null)?.status !== "solved") {
        const saved = await setProblemStatus(user.id, problem.slug, "attempted");
        if (!saved) {
          setSaveError("Attempt not saved. Check your connection and try again.");
          return;
        }
        window.dispatchEvent(
          new CustomEvent("problem-status-changed", {
            detail: { slug: problem.slug, status: "attempted" },
          })
        );
      }
      // Same rule as a solve: the battle-end trigger owns the history row.
      let serverRecorded = false;
      if (endedBattleId) {
        const res = await endBattle(endedBattleId, "failed", { duration_sec: duration }).catch(
          () => ({ error: "network" })
        );
        serverRecorded = !res.error;
      }
      if (!serverRecorded) {
        await logProblemEvent({
          problemSlug: problem.slug,
          kind: "failed",
          battleId: null,
          durationSec: duration,
        }).catch(() => {});
      }
      track("battle_failed", { problem_slug: problem.slug });
      // No feed event: failed battles stay private until revenge (Phase 3).
      setIsPlaying(false);
      clearBattle();
      setOutcome({ kind: "failed", title: problem.title, seconds: duration });
    } catch (err) {
      console.error("Error recording failed battle:", err);
      setSaveError("Attempt not saved. Check your connection and try again.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [activeProblem, user, battleId, elapsedSec, setIsPlaying, clearBattle]);

  const handleAbandon = useCallback(async () => {
    if (!activeProblem || submittingRef.current) return;
    if (!window.confirm("Abandon this battle? The timer stops; nothing is recorded as attempted.")) return;
    if (battleId) {
      await endBattle(battleId, "abandoned", { duration_sec: elapsedSec }).catch(() => null);
    }
    setIsPlaying(false);
    clearBattle();
  }, [activeProblem, battleId, elapsedSec, setIsPlaying, clearBattle]);

  const runVerification = useCallback(async () => {
    if (!activeProblem || isVerifyingRef.current) return;

    if (!battleId) {
      setVerificationNotice({
        kind: "unverified",
        title: activeProblem.title,
        linked: false,
      });
      return;
    }

    isVerifyingRef.current = true;
    setIsVerifying(true);

    try {
      const res = await verifyBattle(battleId);

      if (res.status === 429 && res.retry_after) {
        setCooldownSec(res.retry_after);
        return;
      }

      if (!res.linked) {
        setVerificationNotice({
          kind: "unverified",
          title: activeProblem.title,
          linked: false,
        });
        return;
      }

      if (res.verified === false) {
        setVerificationNotice({
          kind: "unverified",
          title: activeProblem.title,
          linked: true,
          needsVerify: true,
          username: res.username,
        });
        return;
      }

      if (res.reachable === false) {
        setVerificationNotice({
          kind: "unverified",
          title: activeProblem.title,
          linked: true,
          reachable: false,
          username: res.username,
        });
        return;
      }

      // C1: Target found
      if (res.target) {
        setVerificationNotice(null);
        const battleStartedAtSec = res.started_at
          ? Math.floor(new Date(res.started_at).getTime() / 1000)
          : Math.floor((startedAt ?? Date.now()) / 1000);
        const duration = Math.min(
          elapsedSec,
          Math.max(0, res.target.accepted_at - battleStartedAtSec)
        );

        const others = (res.solved || []).filter(
          (s) => s.slug.toLowerCase() !== activeProblem.slug.toLowerCase()
        );

        for (const s of others) {
          window.dispatchEvent(
            new CustomEvent("problem-status-changed", {
              detail: { slug: s.slug, status: "solved" },
            })
          );
        }

        await handleComplete("leetcode", duration, others);
        return;
      }

      // C2: Others found
      const others = res.solved || [];
      if (others.length > 0) {
        for (const s of others) {
          window.dispatchEvent(
            new CustomEvent("problem-status-changed", {
              detail: { slug: s.slug, status: "solved" },
            })
          );
        }
        setVerificationNotice({
          kind: "others_only",
          title: activeProblem.title,
          linked: true,
          reachable: true,
          username: res.username,
          solvedOthers: others,
        });
        return;
      }

      // C3: None found
      setVerificationNotice({
        kind: "unverified",
        title: activeProblem.title,
        linked: true,
        reachable: true,
        username: res.username,
      });
    } catch {
      setVerificationNotice({
        kind: "unverified",
        title: activeProblem.title,
        linked: true,
        reachable: false,
      });
    } finally {
      isVerifyingRef.current = false;
      setIsVerifying(false);
    }
  }, [activeProblem, battleId, startedAt, elapsedSec, handleComplete]);

  // Coming back from LeetCode: check once. The moment the person left lives in
  // sessionStorage, so a tab the phone unloaded in the background still gets
  // its check after it reloads. The listener is always on and reads refs, so a
  // tab switch in the same click that started the battle is never missed.
  const activeProblemRef = useRef(activeProblem);
  useEffect(() => {
    activeProblemRef.current = activeProblem;
  }, [activeProblem]);
  // When a return asked for a check (ms epoch). The check waits for auth, the
  // battle id and the leader election, but only briefly: a stale request must
  // not fire for a battle started later.
  const checkRequestedAtRef = useRef<number | null>(null);
  const [checkTick, setCheckTick] = useState(0);

  useEffect(() => {
    const readLeftAt = (): number | null => {
      try {
        const v = Number(sessionStorage.getItem(LEFT_AT_KEY));
        return Number.isFinite(v) && v > 0 ? v : null;
      } catch {
        return null;
      }
    };
    const clearLeftAt = () => {
      try {
        sessionStorage.removeItem(LEFT_AT_KEY);
      } catch {
        // ignore
      }
    };
    const onVis = () => {
      if (document.hidden) {
        if (!activeProblemRef.current?.openedOnLeetCode || readLeftAt() != null) return;
        try {
          sessionStorage.setItem(LEFT_AT_KEY, String(Date.now()));
        } catch {
          // ignore
        }
        return;
      }
      const left = readLeftAt();
      clearLeftAt();
      if (left != null && Date.now() - left >= AWAY_CHECK_MS) {
        checkRequestedAtRef.current = Date.now();
        setCheckTick((n) => n + 1);
      }
    };
    // A reload while away lands here visible, with the stored time intact.
    if (document.visibilityState === "visible") onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    const requestedAt = checkRequestedAtRef.current;
    if (requestedAt == null) return;
    if (Date.now() - requestedAt > 15_000) {
      checkRequestedAtRef.current = null;
      return;
    }
    // Still restoring (the provider restores the battle after this mounts),
    // or auth / the battle session hasn't arrived yet: wait for the next run.
    if (!activeProblem || !user || !battleId) return;
    if (!activeProblem.openedOnLeetCode || !isHeartbeatLeader) {
      checkRequestedAtRef.current = null;
      return;
    }
    checkRequestedAtRef.current = null;
    void runVerification();
  }, [checkTick, activeProblem, user, battleId, isHeartbeatLeader, runVerification]);

  const handleStartProblem = useCallback(
    (p: ListProblem) => {
      const slug = p.title_slug.toLowerCase();
      track("picker_started", {
        problem_slug: slug,
        via: "list",
        difficulty: filters.difficulty || "any",
        topic: filters.category || "any",
      });
      startSolving({
        id: p.order_index,
        title: p.title,
        slug,
        difficulty: p.difficulty,
        category: p.category,
        openedOnLeetCode: true,
      });
      setIsPickerOpen(false);
    },
    [filters, startSolving]
  );

  const handleRandomQuestion = useCallback(() => {
    const choice = pickRandomProblem(catalog.problems, catalog.statusMap, randomDifficulty);
    if (!choice) {
      setIsPickerOpen(true);
      return;
    }
    const slug = choice.title_slug.toLowerCase();
    const url = problemUrl(slug);
    window.open(url, "_blank", "noopener,noreferrer");
    track("picker_started", {
      problem_slug: slug,
      via: "lucky",
      difficulty: randomDifficulty || "any",
    });
    startSolving({
      id: choice.order_index,
      title: choice.title,
      slug,
      difficulty: choice.difficulty,
      category: choice.category,
      openedOnLeetCode: true,
    });
  }, [catalog.problems, catalog.statusMap, randomDifficulty, startSolving]);

  return (
    <>
      <QuestionPicker
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        filters={filters}
        onFilterChange={setFilters}
        catalog={catalog}
        onStart={handleStartProblem}
      />

      {/* ── REVENGE COMPLETE (Step 17). A solve that answers a recorded failure
          is a different event from a solve: it closes a loop the user opened. ── */}
      {revengeResult && (
        <div className="fixed bottom-24 left-1/2 z-160 w-104 max-w-[calc(100vw-2rem)] -translate-x-1/2 space-y-2 rounded-xl border border-verified/30 bg-surface-raised p-4 shadow-overlay">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-medium uppercase tracking-wide text-verified">
                Revenge complete
              </div>
              <div className="mt-0.5 truncate text-sm font-semibold text-text-primary">
                {revengeResult.title}
              </div>
              <div className="mt-1 font-mono text-xs text-text-secondary">
                {revengeResultLabel(revengeResult)}
              </div>
              {revengeResult.improved ? (
                <div className="mt-0.5 text-xs text-verified">
                  Beat your own failure.
                </div>
              ) : (
                <div className="mt-0.5 text-xs text-text-tertiary">
                  Solved. Durations were not both recorded, so there is no speed to claim.
                </div>
              )}
            </div>
            <button
              onClick={() => setRevengeResult(null)}
              className="shrink-0 rounded-md p-1 text-text-secondary transition-colors hover:text-text-primary"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Link
              href={`/practice/${revengeResult.problemSlug}#explain`}
              onClick={() => setRevengeResult(null)}
              className="rounded-md border border-hairline bg-surface-overlay px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:brightness-110"
            >
              Write up what changed
            </Link>
            <Link
              href="/practice"
              onClick={() => setRevengeResult(null)}
              className="rounded-md border border-hairline bg-surface-overlay px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:brightness-110"
            >
              Next battle
            </Link>
          </div>
        </div>
      )}

      {/* ── CONGRATULATION CARD (Section C1) ── */}
      {outcome?.kind === "solved" && !revengeResult && (
        <div
          role="status"
          aria-live="polite"
          className="fixed z-160 left-1/2 -translate-x-1/2 w-104 max-w-[calc(100vw-2rem)] rounded-xl border border-verified/30 bg-surface-raised p-4 shadow-overlay bottom-[calc(64px+12px+56px+env(safe-area-inset-bottom))] md:bottom-24"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium uppercase tracking-wide text-verified">
                {outcome.evidence === "leetcode" ? "Verified on LeetCode" : "Solved"}
              </div>
              {outcome.otherSolved && outcome.otherSolved.length > 0 ? (
                <>
                  <div className="mt-0.5 text-sm font-semibold text-text-primary">
                    You solved {1 + outcome.otherSolved.length} questions while you were away
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-mono text-2xl font-semibold text-text-primary tnum">
                      {formatTime(outcome.seconds)}
                    </span>
                    <span className="text-xs text-text-tertiary">on the clock</span>
                  </div>
                  <div className="mt-0.5 truncate text-xs text-text-secondary">
                    {outcome.title}
                  </div>
                  <div className="mt-3 space-y-1.5 border-t border-hairline pt-2">
                    <div className="text-xs text-text-tertiary">Also solved:</div>
                    {outcome.otherSolved.map((s) => (
                      <div key={s.slug} className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate text-text-primary">{s.title}</span>
                        {s.difficulty && <DifficultyBadgeNew difficulty={s.difficulty} size="sm" />}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="mt-0.5 truncate text-sm font-semibold text-text-primary">
                    You solved {outcome.title}
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-mono text-2xl font-semibold text-text-primary tnum">
                      {formatTime(outcome.seconds)}
                    </span>
                    <span className="text-xs text-text-tertiary">on the clock</span>
                  </div>
                </>
              )}
            </div>
            <button
              onClick={() => setOutcome(null)}
              className="shrink-0 rounded-md p-1 text-text-secondary transition-colors hover:text-text-primary"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2 pt-1">
            <button
              onClick={() => {
                setOutcome(null);
                setIsPickerOpen(true);
              }}
              className="rounded-md border border-hairline bg-surface-overlay px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-hairline-strong hover:bg-surface-raised"
            >
              Next question
            </button>
          </div>
        </div>
      )}

      {/* ── VERIFICATION NOTICE CARD (Section C2 & C3) ── */}
      {verificationNotice && activeProblem && !revengeResult && !outcome && (
        <div
          role="region"
          aria-label="Solve verification"
          className="fixed z-160 left-1/2 -translate-x-1/2 w-104 max-w-[calc(100vw-2rem)] rounded-xl border border-hairline bg-surface-raised p-4 shadow-overlay bottom-[calc(64px+12px+56px+env(safe-area-inset-bottom))] md:bottom-24"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              {verificationNotice.kind === "others_only" &&
                verificationNotice.solvedOthers &&
                verificationNotice.solvedOthers.length > 0 && (
                  <div className="mb-3 rounded-lg border border-verified/30 bg-surface-overlay p-3">
                    <div className="text-xs font-medium uppercase tracking-wide text-verified">
                      Verified on LeetCode
                    </div>
                    <div className="mt-0.5 text-sm font-semibold text-text-primary">
                      You solved {verificationNotice.solvedOthers.length} question
                      {verificationNotice.solvedOthers.length === 1 ? "" : "s"} while you were away
                    </div>
                    <div className="mt-2 space-y-1">
                      {verificationNotice.solvedOthers.map((s) => (
                        <div key={s.slug} className="flex items-center justify-between gap-2 text-xs">
                          <span className="truncate text-text-primary">{s.title}</span>
                          {s.difficulty && <DifficultyBadgeNew difficulty={s.difficulty} size="sm" />}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              <h3 className="text-sm font-semibold text-text-primary">
                Did you solve {verificationNotice.title}?
              </h3>
              <p className="mt-1 text-xs text-text-secondary leading-relaxed">
                {verificationNotice.needsVerify ? (
                  `@${verificationNotice.username || "your account"} isn't verified as yours yet, so we can't check LeetCode for you. Verify it once and future solves check themselves.`
                ) : !verificationNotice.linked ? (
                  "Your LeetCode account isn't linked, so we can't check for you. Link it and future solves verify on their own."
                ) : verificationNotice.reachable === false ? (
                  "We couldn't reach LeetCode to check. You can check again, or tell us how it went."
                ) : (
                  <>
                    We couldn&apos;t find an accepted submission from{" "}
                    {verificationNotice.username || "your account"} on LeetCode since you started.
                    Make sure you submitted while signed in as{" "}
                    {verificationNotice.username || "the account linked here"}, the account linked
                    here.
                  </>
                )}
              </p>
            </div>
            <button
              onClick={() => setVerificationNotice(null)}
              className="shrink-0 rounded-md p-1 text-text-secondary transition-colors hover:text-text-primary"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3.5 flex flex-wrap items-center gap-2 pt-1 border-t border-hairline">
            <button
              type="button"
              onClick={() => {
                setVerificationNotice(null);
                void handleComplete("none");
              }}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-on-primary hover:bg-primary-hover transition-colors"
            >
              I solved it
            </button>
            {verificationNotice.linked && !verificationNotice.needsVerify && (
              <button
                type="button"
                onClick={() => void runVerification()}
                disabled={isVerifying || cooldownSec > 0}
                className="rounded-md border border-hairline bg-surface-overlay px-3 py-1.5 text-xs font-medium text-text-primary hover:border-hairline-strong hover:bg-surface-raised transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cooldownSec > 0
                  ? `Try again in ${cooldownSec}s`
                  : isVerifying
                  ? "Checking…"
                  : "Check again"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setVerificationNotice(null)}
              className="rounded-md px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-overlay transition-colors"
            >
              Still working on it
            </button>
            <button
              type="button"
              onClick={() => {
                setVerificationNotice(null);
                setStuckOpen(true);
              }}
              className="rounded-md px-2.5 py-1.5 text-xs font-medium text-pattern hover:bg-pattern-tint transition-colors"
            >
              I&apos;m stuck
            </button>
            {!verificationNotice.linked && (
              <Link
                href="/profile#leetcode"
                className="ml-auto text-xs font-medium text-primary hover:underline"
              >
                Link LeetCode
              </Link>
            )}
            {verificationNotice.needsVerify && (
              <Link
                href="/profile#leetcode"
                className="ml-auto text-xs font-medium text-primary hover:underline"
              >
                Verify LeetCode
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ── I'm Stuck ladder (Step 18). Real request, four levels, enforced. ── */}
      {stuckOpen && activeProblem && (
        <StuckLadder
          problemSlug={activeProblem.slug}
          problemTitle={activeProblem.title}
          battleId={battleId}
          squadId={profile?.active_squad_id ?? null}
          attemptCount={attemptCount}
          hasScratchpad={scratchpadNote.trim().length > 0}
          onClose={() => setStuckOpen(false)}
        />
      )}

      {/* ── Scratchpad Popover ─────────────────────────── */}
      {isScratchpadOpen && activeProblem && (
        <div className="popover-panel fixed bottom-24 right-6 z-150 w-96 max-w-[calc(100vw-3rem)] p-4">
          <div className="flex items-center justify-between border-b border-hairline pb-2">
            <span className="pl-1 text-xs font-semibold text-text-primary">
              Notes • {activeProblem.title}
            </span>
            <button
              onClick={() => setIsScratchpadOpen(false)}
              className="rounded-md p-1 text-text-secondary transition-colors hover:text-text-primary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3">
            <textarea
              value={scratchpadNote}
              onChange={(e) => handleSaveNote(e.target.value)}
              placeholder="Write your intuition, time/space complexity, or edge cases..."
              rows={4}
              className="w-full resize-none rounded-md border border-hairline bg-well p-2.5 font-mono text-xs text-text-primary placeholder:text-text-tertiary focus:border-hairline-strong focus:outline-hidden"
            />
            <div className="mt-2 flex items-center justify-between pl-1 text-xs text-text-tertiary">
              <span>Saved on this device for this problem</span>
              <button
                onClick={() => setIsScratchpadOpen(false)}
                className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-on-primary transition-colors hover:bg-primary-hover"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Solve dock S1 (active) / idle one-liner ── */}
      {sessionExpired && activeProblem && (
        <div className="solve-dock-wrap select-none">
          <div className="card flex items-center justify-between gap-3 border border-error/30">
            <p className="text-sm leading-6 text-text-primary">
              Session expired, restart the battle to keep time honestly.
            </p>
            <button
              onClick={() => {
                setSessionExpired(false);
                clearBattle();
              }}
              className="inline-flex min-h-[44px] shrink-0 items-center rounded-md bg-primary px-4 text-sm font-medium text-on-primary transition-colors hover:bg-primary-hover"
            >
              Restart battle
            </button>
          </div>
        </div>
      )}
      <div className="solve-dock-wrap select-none">
        {activeProblem ? (
          <>
            {/* Desktop S1 dock */}
            <div className="solve-dock hidden justify-between md:flex" aria-busy={submitting}>
              <div className="flex shrink-0 items-center gap-3 pl-1">
                <span
                  className={cn(
                    "h-2.5 w-2.5 shrink-0 rounded-full",
                    isPlaying ? "animate-gold-pulse bg-primary" : "bg-text-tertiary"
                  )}
                  aria-hidden
                />
                <span className="font-mono text-xl font-medium leading-none tracking-tight text-text-primary tnum">
                  {formatTime(elapsedSec)}
                </span>
              </div>

              <div className="flex min-w-0 items-center gap-2.5 px-3">
                {saveError ? (
                  <span role="alert" className="truncate text-sm font-medium text-error">
                    {saveError}
                  </span>
                ) : (
                  <>
                    <span className="truncate text-sm font-semibold text-text-primary">
                      {activeProblem.title}
                    </span>
                    {activeProblem.difficulty && (
                      <DifficultyBadgeNew difficulty={activeProblem.difficulty} size="sm" />
                    )}
                    <span className="hidden shrink-0 font-mono text-xs text-text-tertiary tnum lg:block">
                      No. {activeProblem.id}
                    </span>
                  </>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  onClick={() => setIsScratchpadOpen(!isScratchpadOpen)}
                  className="flex h-8 items-center rounded-md px-2.5 text-[13px] font-medium text-text-secondary transition-colors hover:bg-surface-overlay hover:text-text-primary"
                  title="Open scratchpad for this problem"
                >
                  Notes
                </button>
                <button
                  onClick={() => setStuckOpen((v) => !v)}
                  className="flex h-8 items-center rounded-md px-2.5 text-[13px] font-medium text-pattern transition-colors hover:bg-pattern-tint"
                  title="Open the Stuck hint ladder"
                >
                  Stuck?
                </button>
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-overlay hover:text-text-primary"
                  aria-label={isPlaying ? "Pause battle" : "Resume battle"}
                >
                  {isPlaying ? (
                    <Pause className="h-4 w-4" strokeWidth={1.75} />
                  ) : (
                    <Play className="ml-0.5 h-4 w-4" strokeWidth={1.75} />
                  )}
                </button>
                <span
                  onClickCapture={() => {
                    if (activeProblem && !activeProblem.openedOnLeetCode) {
                      setActiveProblem({ ...activeProblem, openedOnLeetCode: true });
                    }
                  }}
                >
                  <ProblemLink
                    slug={activeProblem.slug}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary hover:bg-surface-overlay hover:text-text-primary"
                  />
                </span>
                <button
                  onClick={() => handleComplete()}
                  disabled={submitting || !canEnd}
                  className="h-9 min-w-[112px] rounded-md bg-primary px-4 text-[13px] font-medium text-on-primary transition-colors hover:bg-primary-hover active:bg-primary-pressed disabled:cursor-wait disabled:bg-surface-overlay disabled:text-text-secondary"
                >
                  {submitting ? "Saving…" : saveError ? "Retry solve" : "Submit solve"}
                </button>
                <BattleMenu
                  onFail={handleFail}
                  onAbandon={handleAbandon}
                  onReset={() => resetSolving()}
                  busy={submitting || !canEnd}
                />
              </div>
            </div>

            {/* Mobile S3 capsule: the timer stays in reach; the title opens the rest. */}
            <div className="pointer-events-auto relative w-full max-w-[360px] md:hidden">
              {capsuleMenuOpen && (
                <div className="popover-panel absolute bottom-[56px] left-0 right-0 flex flex-col p-2">
                  <button
                    onClick={() => {
                      setCapsuleMenuOpen(false);
                      setIsScratchpadOpen(true);
                    }}
                    className="flex min-h-[44px] items-center rounded-md px-3 text-left text-sm text-text-secondary hover:bg-surface-overlay hover:text-text-primary"
                  >
                    Notes
                  </button>
                  <button
                    onClick={() => {
                      setCapsuleMenuOpen(false);
                      setStuckOpen(true);
                    }}
                    className="flex min-h-[44px] items-center rounded-md px-3 text-left text-sm text-pattern hover:bg-pattern-tint"
                  >
                    Stuck?
                  </button>
                  <button
                    onClick={() => {
                      setCapsuleMenuOpen(false);
                      setIsPlaying(!isPlaying);
                    }}
                    className="flex min-h-[44px] items-center gap-2 rounded-md px-3 text-left text-sm text-text-secondary hover:bg-surface-overlay hover:text-text-primary"
                  >
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    {isPlaying ? "Pause" : "Resume"}
                  </button>
                  <button
                    onClick={() => {
                      setCapsuleMenuOpen(false);
                      handleFail();
                    }}
                    disabled={submitting || !canEnd}
                    className="flex min-h-[44px] items-center rounded-md px-3 text-left text-sm text-text-secondary hover:bg-surface-overlay hover:text-text-primary disabled:opacity-40"
                  >
                    Mark failed
                  </button>
                  <button
                    onClick={() => {
                      setCapsuleMenuOpen(false);
                      handleAbandon();
                    }}
                    disabled={submitting || !canEnd}
                    className="flex min-h-[44px] items-center rounded-md px-3 text-left text-sm text-text-secondary hover:bg-surface-overlay hover:text-text-primary disabled:opacity-40"
                  >
                    Abandon
                  </button>
                  <button
                    onClick={() => {
                      setCapsuleMenuOpen(false);
                      resetSolving();
                    }}
                    className="flex min-h-[44px] items-center gap-2 rounded-md px-3 text-left text-sm text-text-secondary hover:bg-surface-overlay hover:text-text-primary"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Reset timer
                  </button>
                </div>
              )}
              <div className="solve-capsule" aria-busy={submitting}>
                <span
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full",
                    isPlaying ? "animate-gold-pulse bg-primary" : "bg-text-tertiary"
                  )}
                  aria-hidden
                />
                <span className="shrink-0 font-mono text-[15px] font-medium text-text-primary tnum">
                  {formatTime(elapsedSec)}
                </span>
                <button
                  type="button"
                  onClick={() => setCapsuleMenuOpen((v) => !v)}
                  aria-expanded={capsuleMenuOpen}
                  aria-label={`${activeProblem.title}: battle options`}
                  className={cn(
                    "flex min-h-[44px] min-w-0 flex-1 items-center justify-center truncate px-1 text-sm",
                    saveError ? "text-error" : "text-text-secondary"
                  )}
                >
                  <span className="truncate" role={saveError ? "alert" : undefined}>
                    {saveError ? "Not saved, tap ✓ to retry" : activeProblem.title}
                  </span>
                </button>
                <button
                  onClick={() => handleComplete()}
                  disabled={submitting || !canEnd}
                  aria-label={submitting ? "Saving solve" : saveError ? "Retry solve" : "Submit solve"}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary transition-colors hover:bg-primary-hover active:bg-primary-pressed disabled:cursor-wait disabled:bg-surface-overlay disabled:text-text-secondary"
                >
                  {submitting ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
                  ) : (
                    <Check className="h-5 w-5" strokeWidth={2} />
                  )}
                </button>
              </div>
            </div>
          </>
        ) : outcome?.kind === "failed" ? (
          <>
            {/* Desktop failed outcome line */}
            <div
              role="status"
              aria-live="polite"
              className="solve-dock solve-dock-idle hidden justify-between gap-3 pl-4 pr-2 md:flex"
            >
              <span className="flex min-w-0 items-center gap-3 text-sm">
                <span className="h-2 w-2 shrink-0 rounded-full bg-text-tertiary" aria-hidden />
                <span className="shrink-0 font-medium text-text-secondary">Attempt logged</span>
                <span className="truncate text-text-primary">{outcome.title}</span>
                <span className="shrink-0 font-mono text-xs text-text-tertiary tnum">
                  {formatTime(outcome.seconds)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setOutcome(null);
                  setIsPickerOpen(true);
                }}
                className="flex h-9 shrink-0 items-center gap-2 rounded-md border border-hairline px-3 text-sm font-medium text-text-primary transition-colors hover:border-hairline-strong hover:bg-surface-overlay"
              >
                Next battle
                <ArrowUp className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            </div>
            {/* Mobile failed outcome line */}
            <div role="status" aria-live="polite" className="solve-capsule md:hidden">
              <span className="h-2 w-2 shrink-0 rounded-full bg-text-tertiary" aria-hidden />
              <span className="shrink-0 text-sm font-medium text-text-secondary">Attempt logged</span>
              <span className="min-w-0 flex-1 truncate text-sm text-text-primary">{outcome.title}</span>
              <span className="shrink-0 pr-3 font-mono text-xs text-text-tertiary tnum">
                {formatTime(outcome.seconds)}
              </span>
            </div>
          </>
        ) : (
          <div className="relative pointer-events-auto flex flex-col items-center w-full max-w-[360px] md:max-w-[760px]">
            {/* Desktop idle row */}
            <div className="solve-dock solve-dock-idle hidden justify-between items-center pl-4 pr-2 md:flex">
              <div className="flex shrink-0 items-center gap-3 pl-1">
                <button
                  type="button"
                  onClick={() => setIsPickerOpen(true)}
                  className="flex h-9 items-center gap-2 rounded-md border border-hairline px-3 text-sm font-medium text-text-primary transition-colors hover:border-hairline-strong hover:bg-surface-overlay"
                >
                  <Search className="h-3.5 w-3.5 text-text-tertiary" strokeWidth={1.75} />
                  Choose a question
                </button>
              </div>
              <div className="flex shrink-0 items-center gap-2.5">
                <RandomDifficultySegmented
                  value={randomDifficulty}
                  onChange={setRandomDifficulty}
                />
                <button
                  type="button"
                  onClick={handleRandomQuestion}
                  className="flex h-9 items-center gap-2 rounded-md border border-hairline px-3 text-sm font-medium text-text-primary transition-colors hover:border-hairline-strong hover:bg-surface-overlay"
                >
                  <Shuffle className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Random question
                </button>
              </div>
            </div>

            {/* Mobile idle capsule */}
            <div className="solve-capsule md:hidden">
              <button
                type="button"
                onClick={() => setIsPickerOpen(true)}
                className="flex min-h-[44px] min-w-0 flex-1 items-center justify-start truncate px-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                <span className="truncate">Choose a question</span>
              </button>
              <RandomDifficultySegmented
                value={randomDifficulty}
                onChange={setRandomDifficulty}
                isMobile
              />
              <button
                type="button"
                onClick={handleRandomQuestion}
                aria-label="Random question"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-hairline text-text-primary transition-colors hover:border-hairline-strong hover:bg-surface-overlay"
              >
                <Shuffle className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/** The dock's overflow: the battle endings that aren't a solve. */
function BattleMenu({
  onFail,
  onAbandon,
  onReset,
  busy,
}: {
  onFail: () => void;
  onAbandon: () => void;
  onReset: () => void;
  busy: boolean;
}) {
  // Controlled, not <details>: a native disclosure stayed open after a choice,
  // so the menu hung over the dock once the battle had already ended.
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="More battle options"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-overlay hover:text-text-primary"
      >
        <MoreHorizontal className="h-4 w-4" strokeWidth={1.75} />
      </button>
      {open && (
        <div role="menu" className="popover-panel absolute bottom-11 right-0 flex w-44 flex-col p-2">
          <button
            role="menuitem"
            onClick={choose(onFail)}
            disabled={busy}
            className="rounded-md px-3 py-2 text-left text-sm text-text-secondary hover:bg-surface-overlay hover:text-text-primary disabled:opacity-40"
          >
            Mark failed
          </button>
          <button
            role="menuitem"
            onClick={choose(onAbandon)}
            disabled={busy}
            className="rounded-md px-3 py-2 text-left text-sm text-text-secondary hover:bg-surface-overlay hover:text-text-primary disabled:opacity-40"
          >
            Abandon
          </button>
          <button
            role="menuitem"
            onClick={choose(onReset)}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-text-secondary hover:bg-surface-overlay hover:text-text-primary"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset timer
          </button>
        </div>
      )}
    </div>
  );
}
