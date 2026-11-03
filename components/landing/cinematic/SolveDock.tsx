"use client";

import { ArrowDown, Check, Pause, Play } from "lucide-react";
import { DifficultyBadgeNew } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { useBattle } from "./battle";
import { clock } from "./motion";
import styles from "./landing.module.css";

/**
 * The product's solve dock (desktop) and solve capsule (phones), carrying the
 * demo battle's clock while the hero Pass is off screen. After a submit it
 * confirms the time for a few seconds, then leaves.
 */
export function SolveDock() {
  const { status, elapsed, heroInView, closeInView, justSubmitted, pause, resume, submit } = useBattle();
  const live = status === "running" || status === "paused";
  const confirming = status === "submitted" && justSubmitted;
  // One gold action per view: the dock never shares the screen with the hero
  // Pass or the closing "Start a squad".
  if (heroInView || closeInView || (!live && !confirming)) return null;

  const running = status === "running";

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(12px+env(safe-area-inset-bottom))] z-50 flex justify-center px-3 md:bottom-4">
      {confirming ? (
        <div
          className={cn(
            styles.dock,
            "pointer-events-auto flex h-12 max-w-full items-center gap-3 rounded-full border border-hairline-strong bg-surface-raised pl-4 pr-1.5 text-sm shadow-lifted md:h-14 md:rounded-xl md:pl-5 md:pr-2"
          )}
        >
          <Check className="h-4 w-4 shrink-0 text-text-secondary" strokeWidth={1.5} aria-hidden />
          <span className="truncate text-text-primary">
            Logged <span className="font-mono tnum">{clock(elapsed)}</span>
            <span className="hidden text-text-secondary sm:inline"> · self-reported</span>
          </span>
          <a
            href="#proof"
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 font-medium text-text-primary transition-colors hover:bg-surface-overlay md:rounded-md"
          >
            See it
            <ArrowDown className="h-4 w-4" strokeWidth={1.5} aria-hidden />
          </a>
        </div>
      ) : (
        <div
          className={cn(
            styles.dock,
            "pointer-events-auto flex h-12 w-full max-w-[420px] items-center gap-3 rounded-full border border-hairline-strong bg-surface-raised pl-4 pr-1.5 shadow-lifted",
            "md:h-14 md:max-w-[720px] md:rounded-xl md:pl-5 md:pr-2"
          )}
        >
          <span className="flex shrink-0 items-center gap-2">
            <span
              aria-hidden
              className={cn(
                "h-2 w-2 rounded-full",
                running ? "bg-primary motion-safe:animate-gold-pulse" : "bg-text-tertiary"
              )}
            />
            <span className="font-mono text-base font-medium text-text-primary tnum md:text-xl md:leading-7">
              {clock(elapsed)}
            </span>
          </span>

          <a
            href="#battle"
            className="flex min-w-0 flex-1 items-center gap-2 truncate text-sm font-medium text-text-primary md:justify-center"
          >
            <span className="truncate">Coin Change II</span>
            <DifficultyBadgeNew difficulty="Medium" size="sm" className="hidden md:inline-flex" />
            {!running && <span className="hidden text-text-tertiary md:inline">· paused</span>}
          </a>

          <button
            type="button"
            onClick={running ? pause : resume}
            aria-label={running ? "Pause timer" : "Resume timer"}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface-overlay hover:text-text-primary md:rounded-md"
          >
            {running ? (
              <Pause className="h-4 w-4" strokeWidth={1.5} aria-hidden />
            ) : (
              <Play className="h-4 w-4" strokeWidth={1.5} aria-hidden />
            )}
          </button>

          {/* Phones: a round check. Desktop: the full primary action. */}
          <button
            type="button"
            onClick={submit}
            aria-label="Submit solve"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary transition-colors hover:bg-primary-hover active:bg-primary-pressed md:hidden"
          >
            <Check className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
          <button
            type="button"
            onClick={submit}
            className="hidden h-10 shrink-0 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-on-primary transition-colors hover:bg-primary-hover active:bg-primary-pressed md:inline-flex"
          >
            Submit solve
          </button>
        </div>
      )}
    </div>
  );
}
