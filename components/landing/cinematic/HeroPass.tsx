"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { Check, ExternalLink, Pause, Play, RotateCcw } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { DifficultyBadgeNew, PatternChip, SelfReportedBadge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { useBattle } from "./battle";
import { clock, serialDate, useToday } from "./motion";
import { ExampleTag, Serial, StagePass, btnGhost, btnSecondary } from "./Scene";
import styles from "./landing.module.css";

const SOLVERS = [{ name: "Priya Nair" }, { name: "Rahul Mehta" }, { name: "Meera Iyer" }];

/**
 * Today's Battle Pass, working: "Try it" starts a real timer. While it runs
 * and this Pass is off screen, the solve dock carries the clock.
 */
export function HeroPass() {
  const { status, elapsed, start, pause, resume, submit, reset, setHeroInView } = useBattle();
  const today = useToday();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setHeroInView(!!e?.isIntersecting), {
      threshold: 0.25,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [setHeroInView]);

  const running = status === "running";
  // Same squad, same day as the streak card: four of five, then you.
  const solvedCount = status === "submitted" ? 5 : 4;

  return (
    <div ref={ref} id="battle" className="relative scroll-mt-28">
      <StagePass
        className={styles.heroPassEnter}
        style={{ "--stub-h": "120px" } as CSSProperties}
        body={
          <div className="flex h-full flex-col">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-text-tertiary tnum">No. 518</span>
                <DifficultyBadgeNew difficulty="Medium" />
                <PatternChip label="Dynamic programming" />
              </div>
              <ExampleTag />
            </div>

            <h2 className="mt-4 font-display text-[28px] font-semibold leading-[1.1] tracking-[-0.02em] text-text-primary sm:text-[32px] lg:text-[44px]">
              Coin Change II
            </h2>

            <p className="mt-3 flex items-center gap-2.5 text-sm leading-5 text-text-secondary">
              <span className="inline-flex shrink-0 items-center">
                {SOLVERS.map((p, i) => (
                  <Avatar
                    key={p.name}
                    name={p.name}
                    size="sm"
                    className={cn("ring-2 ring-surface", i > 0 && "ml-1")}
                  />
                ))}
              </span>
              <span>
                Priya, Rahul and 2 more solved this · fastest{" "}
                <span className="font-mono text-text-primary tnum">14:22</span>
              </span>
            </p>

            <div className="mt-6 border-t border-hairline pt-5 sm:mt-8">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                <span
                  className={cn(
                    "inline-flex min-w-[6.5ch] items-center gap-2 font-mono text-[28px] font-medium leading-none tracking-[-0.02em] tnum sm:text-[32px]",
                    status === "idle" ? "text-text-tertiary" : "text-text-primary"
                  )}
                  aria-label={`Timer ${clock(elapsed)}`}
                  role="timer"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      running ? "bg-primary motion-safe:animate-gold-pulse" : "bg-hairline-strong",
                      status === "submitted" && "bg-text-secondary"
                    )}
                  />
                  {clock(elapsed)}
                </span>

                <div className="flex flex-wrap items-center gap-2">
                  {status === "idle" && (
                    <button type="button" onClick={start} className={btnSecondary}>
                      <Play className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                      Try it
                    </button>
                  )}
                  {status === "running" && (
                    <>
                      <button type="button" onClick={pause} className={btnSecondary}>
                        <Pause className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                        Pause
                      </button>
                      <button type="button" onClick={submit} className={btnSecondary}>
                        <Check className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                        Submit solve
                      </button>
                    </>
                  )}
                  {status === "paused" && (
                    <>
                      <button type="button" onClick={resume} className={btnSecondary}>
                        <Play className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                        Resume
                      </button>
                      <button type="button" onClick={submit} className={btnSecondary}>
                        <Check className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                        Submit solve
                      </button>
                    </>
                  )}
                  {status === "submitted" && (
                    <>
                      <SelfReportedBadge />
                      <button type="button" onClick={reset} className={btnGhost}>
                        <RotateCcw className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                        Try again
                      </button>
                    </>
                  )}
                </div>

                <a
                  href="https://leetcode.com/problems/coin-change-ii/"
                  target="_blank"
                  rel="noreferrer"
                  className={cn(btnGhost, "hidden lg:ml-auto lg:inline-flex")}
                >
                  Open on LeetCode
                  <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                </a>
              </div>
              <p className="mt-3 text-xs leading-4 text-text-tertiary">
                {status === "submitted"
                  ? "In the app, your squad sees this time and syncing LeetCode verifies it."
                  : "A real timer. Nothing is saved."}
              </p>
            </div>
          </div>
        }
        stub={
          <>
            <Serial label="No.">518</Serial>
            <Serial label="Date">{today ? serialDate(today) : "Today"}</Serial>
            <Serial label="Squad">Kshatriya</Serial>
            <Serial label="Today" tone={status === "submitted" ? "default" : "muted"}>
              {solvedCount} of 5 solved
            </Serial>
          </>
        }
      >
        <span aria-hidden className={styles.sheen} />
      </StagePass>
    </div>
  );
}
