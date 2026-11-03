"use client";

import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { ArrowUp, Check, Eye, Flame } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import {
  DifficultyBadgeNew,
  PatternChip,
  SelfReportedBadge,
  VerifiedBadge,
} from "@/components/ui/Badge";
import { SarathiAvatar } from "@/components/ai/Sarathi";
import { cn } from "@/lib/utils";
import { useBattle } from "./battle";
import {
  clock,
  daysAgo,
  serialDate,
  shortDate,
  spoken,
  useFirstSight,
  useMotionAllowed,
  useToday,
} from "./motion";
import { ExampleTag, Serial, StagePass, btnGhost, btnSecondary } from "./Scene";
import styles from "./landing.module.css";

/* ════════════════════════════════════════════════════════════════
   Proof: Priya's verified solve. The seal stamps the first time the
   card is seen (DESIGN.md's one authored moment).
   ════════════════════════════════════════════════════════════════ */

export function ProofPiece() {
  const { status, elapsed } = useBattle();
  const today = useToday();
  // Server render, no JS and reduced motion all show the seal already set.
  // With motion, it waits off screen and stamps the first time it is seen.
  const motion = useMotionAllowed();
  const [seen, setSeen] = useState(false);
  const ref = useFirstSight<HTMLDivElement>(() => setSeen(true), 0.7);
  const stamped = !motion || seen;
  const animateStamp = motion && seen;

  return (
    <div ref={ref}>
      <StagePass
        body={
          <div>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Avatar name="Priya Nair" size="md" />
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-5 text-text-primary">Priya Nair</p>
                  <p className="text-xs leading-4 text-text-tertiary">Coin Change II · No. 518</p>
                </div>
              </div>
              <ExampleTag />
            </div>
            <p className="mt-6 font-mono text-[48px] font-medium leading-none tracking-[-0.03em] text-text-primary tnum sm:text-[64px]">
              14:22
            </p>
            <p className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 font-mono text-sm tnum">
              <span className="text-text-tertiary line-through decoration-text-tertiary/60">19:05</span>
              <span aria-hidden className="text-text-tertiary">
                →
              </span>
              <span className="text-text-primary">14:22</span>
              <span className="font-sans text-text-secondary">
                <span className="max-sm:hidden">· </span>4m 43s faster than her last try
              </span>
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <VerifiedBadge />
              <span className="text-xs leading-4 text-text-tertiary">Synced from LeetCode</span>
            </div>
          </div>
        }
        stub={
          <>
            <Serial label="Solver">@priya</Serial>
            <Serial label="Date">{today ? serialDate(today) : "Today"}</Serial>
            <Serial label="No.">518</Serial>
            <div className="flex items-center md:mt-1">
              <Seal stamped={stamped} animate={animateStamp} />
            </div>
          </>
        }
      />

      {/* The visitor's own run, if they took one, sits under Priya's. */}
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-hairline bg-surface/70 px-4 py-3 text-sm leading-5">
        {status === "submitted" ? (
          <>
            <span className="font-mono text-text-primary tnum">You · {clock(elapsed)}</span>
            <SelfReportedBadge />
            <span className="text-text-secondary">
              {elapsed < 14 * 60 + 22
                ? `${spoken(14 * 60 + 22 - elapsed)} under Priya. Connect LeetCode in the app and it gets the seal.`
                : `${spoken(elapsed - (14 * 60 + 22))} behind Priya. Tomorrow's another one.`}
            </span>
          </>
        ) : (
          <>
            <span className="text-text-secondary">Your time goes here once you try today&apos;s battle.</span>
            <a href="#battle" className={cn(btnGhost, "-my-1 h-9 px-2 text-text-primary md:h-9")}>
              <ArrowUp className="h-4 w-4" strokeWidth={1.5} aria-hidden />
              Back to the battle
            </a>
          </>
        )}
      </div>
    </div>
  );
}

function Seal({ stamped, animate }: { stamped: boolean; animate: boolean }) {
  return (
    <span className="relative inline-flex items-center gap-2.5" aria-label="Verified">
      <span
        className={cn(
          "relative flex h-12 w-12 items-center justify-center rounded-full border-[1.5px] border-verified text-verified",
          !stamped && "opacity-0",
          animate && "animate-stamp"
        )}
      >
        {animate && (
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-3 animate-bloom-fade rounded-full bg-verified blur-[12px]"
          />
        )}
        <Check className="relative h-5 w-5" strokeWidth={2} aria-hidden />
      </span>
      <span
        className={cn(
          "font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-verified transition-opacity duration-300",
          stamped ? "opacity-100" : "opacity-0"
        )}
      >
        Verified
      </span>
    </span>
  );
}

/* ════════════════════════════════════════════════════════════════
   Code: how she thought about it, hidden until you choose to look.
   ════════════════════════════════════════════════════════════════ */

const SOLUTIONS = [
  {
    who: "Priya",
    name: "Priya Nair",
    time: "14:22",
    pattern: "Dynamic programming",
    approach:
      "Coins in the outer loop, amounts in the inner one. Swap the loops and you count orderings instead of combinations.",
    code: [
      "def change(amount, coins):",
      "    ways = [1] + [0] * amount",
      "    for coin in coins:",
      "        for total in range(coin, amount + 1):",
      "            ways[total] += ways[total - coin]",
      "    return ways[amount]",
    ],
  },
  {
    who: "Rahul",
    name: "Rahul Mehta",
    time: "19:47",
    pattern: "Memoization",
    approach:
      "At each coin: use it again, or move past it. Top-down and cached. Slower than Priya's, and easier to explain.",
    code: [
      "from functools import cache",
      "",
      "def change(amount, coins):",
      "    @cache",
      "    def ways(i, left):",
      "        if left == 0:",
      "            return 1",
      "        if i == len(coins) or left < 0:",
      "            return 0",
      "        return ways(i, left - coins[i]) + ways(i + 1, left)",
      "    return ways(0, amount)",
    ],
  },
] as const;

const PY_TOKEN =
  /(#.*$)|("[^"]*"|'[^']*')|(@\w+)|\b(def|for|in|return|if|or|and|not|from|import|else|elif|while)\b|\b(range|len|cache)\b|\b(\d+)\b|([A-Za-z_]\w*)(?=\()/g;

function highlight(line: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of line.matchAll(PY_TOKEN)) {
    const at = m.index ?? 0;
    if (at > last) out.push(line.slice(last, at));
    const [tok, comment, str, deco, kw, builtin, num, fn] = m;
    const cls = comment
      ? "text-text-tertiary"
      : str
        ? "text-text-primary"
        : deco || kw
          ? "text-pattern"
          : builtin || fn
            ? "text-text-primary"
            : num
              ? "text-text-primary"
              : "";
    out.push(
      <span key={k++} className={cls}>
        {tok}
      </span>
    );
    last = at + tok.length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

export function CodePiece() {
  const { status } = useBattle();
  const [tab, setTab] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const sol = SOLUTIONS[tab];

  return (
    <div className={cn(styles.litCard, "overflow-hidden rounded-xl border border-hairline")}>
      <div className="flex items-center justify-between gap-3 border-b border-hairline px-3 sm:px-4">
        <div role="tablist" aria-label="Solutions" className="flex">
          {SOLUTIONS.map((s, i) => (
            <button
              key={s.who}
              type="button"
              role="tab"
              id={`sol-tab-${i}`}
              aria-selected={tab === i}
              aria-controls="sol-panel"
              onClick={() => setTab(i)}
              className={cn(
                "relative inline-flex h-12 items-center gap-2 px-2 text-sm font-medium transition-colors duration-150 sm:px-3",
                tab === i ? "text-text-primary" : "text-text-secondary hover:text-text-primary"
              )}
            >
              <Avatar name={s.name} size="sm" />
              {s.who}
              <span className="font-mono text-xs text-text-tertiary tnum">{s.time}</span>
              {tab === i && <span aria-hidden className="absolute inset-x-2 bottom-0 h-0.5 bg-text-primary sm:inset-x-3" />}
            </button>
          ))}
        </div>
        <ExampleTag />
      </div>

      <div
        role="tabpanel"
        id="sol-panel"
        aria-labelledby={`sol-tab-${tab}`}
        className="relative bg-well"
      >
        <pre
          aria-hidden={!revealed}
          className={cn(
            styles.reveal,
            "overflow-x-auto px-4 py-5 font-mono text-sm leading-[22px] text-text-secondary sm:px-6",
            !revealed && styles.spoiler
          )}
        >
          <code>
            {sol.code.map((line, i) => (
              <span key={`${tab}-${i}`} className="flex">
                <span aria-hidden className="mr-5 w-5 shrink-0 select-none text-right text-text-disabled tnum">
                  {i + 1}
                </span>
                <span className="whitespace-pre">{line ? highlight(line) : " "}</span>
              </span>
            ))}
          </code>
        </pre>

        {!revealed && (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="flex max-w-sm flex-col items-center gap-3 rounded-lg border border-hairline-strong bg-surface-raised px-5 py-4 text-center shadow-overlay">
              <p className="font-mono text-xs text-text-secondary tnum">
                Python · {sol.code.filter(Boolean).length} lines · solved in {sol.time}
              </p>
              <p className="text-sm leading-5 text-text-primary">
                {status === "submitted"
                  ? "You've solved it, so nothing gets spoiled."
                  : "You haven't attempted this yet."}
              </p>
              <button type="button" onClick={() => setRevealed(true)} className={btnSecondary}>
                <Eye className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                Reveal code
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-hairline px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="max-w-[60ch] text-sm leading-6 text-text-secondary">{sol.approach}</p>
        <div className="flex shrink-0 items-center gap-2">
          <PatternChip label={sol.pattern} />
          <VerifiedBadge />
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   Sarathi: two nudges, then the rest is yours.
   ════════════════════════════════════════════════════════════════ */

const NUDGES = [
  "If you add the coins in a different order, does the count change? What would you have to fix so it can't?",
  "Fill the table one coin at a time. After using only the 1-coin, what does ways[5] hold?",
];

export function SarathiPiece() {
  const [shown, setShown] = useState(0);
  const done = shown >= NUDGES.length;

  return (
    <div className={cn(styles.litCard, "rounded-xl border border-hairline p-5 sm:p-6")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <SarathiAvatar />
          <div>
            <p className="text-sm font-semibold leading-5 text-text-primary">Sarathi</p>
            <p className="font-mono text-xs leading-4 text-text-tertiary tnum">Coin Change II · 21:40 in</p>
          </div>
        </div>
        <ExampleTag />
      </div>

      <div className="mt-5 flex flex-col gap-3" aria-live="polite">
        <div className="self-end rounded-lg rounded-br-xs bg-surface-overlay px-3.5 py-2 text-sm leading-5 text-text-primary">
          I&apos;m stuck. My answer for amount 5 comes out as 9.
        </div>
        {NUDGES.slice(0, shown).map((n, i) => (
          <div key={i} className={cn(styles.fadeUp, "rounded-lg border border-pattern/30 bg-pattern-tint px-3.5 py-3")}>
            <p className="font-mono text-[11px] font-medium uppercase leading-4 tracking-[0.06em] text-pattern">
              Nudge {i + 1} of {NUDGES.length}
            </p>
            <p className="mt-1.5 text-sm leading-6 text-text-primary">{n}</p>
          </div>
        ))}
        {done && (
          <p className={cn(styles.fadeUp, "text-sm leading-5 text-text-secondary")}>
            That&apos;s both nudges. The rest is yours.
          </p>
        )}
      </div>

      {!done && (
        <div className="mt-5">
          <button type="button" onClick={() => setShown((n) => n + 1)} className={btnSecondary}>
            {shown === 0 ? "Ask for a nudge" : "One more nudge"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   Challenge: Rahul's 38:11 on Word Ladder.
   ════════════════════════════════════════════════════════════════ */

export function ChallengePiece() {
  const today = useToday();
  const [accepted, setAccepted] = useState(false);

  return (
    <StagePass
      body={
        <div>
          <div className="flex items-start justify-between gap-3">
            <p className="flex items-center gap-2.5 font-display text-2xl font-semibold leading-tight tracking-[-0.015em] text-text-primary">
              <Avatar name="Rahul Mehta" size="md" className="font-sans" />
              Rahul challenged you
            </p>
            <ExampleTag className="mt-1" />
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="text-base font-medium text-text-primary">Word Ladder</span>
            <DifficultyBadgeNew difficulty="Hard" />
            <PatternChip label="Breadth-first search" />
          </div>
          <p className="mt-6 text-xs font-medium leading-4 text-text-tertiary">Time to beat</p>
          <p className="mt-1.5 font-mono text-[48px] font-medium leading-none tracking-[-0.03em] text-text-primary tnum sm:text-[56px]">
            38:11
          </p>
          <p className="mt-4 max-w-[40ch] text-sm leading-6 text-text-secondary">
            &ldquo;Took me two tries. Think hard about the visited set.&rdquo;
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {accepted ? (
              <p className={cn(styles.fadeUp, "flex items-center gap-2 text-sm leading-5 text-text-primary")}>
                <Check className="h-4 w-4 text-text-secondary" strokeWidth={1.5} aria-hidden />
                Accepted. In the app it waits in your Arena, with 38:11 beside the timer.
              </p>
            ) : (
              <>
                <button type="button" onClick={() => setAccepted(true)} className={btnSecondary}>
                  Accept challenge
                </button>
                <span className="text-xs text-text-tertiary">No points, no wagers. Just the time.</span>
              </>
            )}
          </div>
        </div>
      }
      stub={
        <>
          <Serial label="From">@rahul</Serial>
          <Serial label="To">You</Serial>
          <Serial label="Date">{today ? serialDate(today) : "Today"}</Serial>
          <Serial label="Status" tone={accepted ? "default" : "muted"}>
            {accepted ? "Accepted" : "Open"}
          </Serial>
        </>
      }
    />
  );
}

/* ════════════════════════════════════════════════════════════════
   Streak: fourteen days, everyone, every day. Your dot is today's gap.
   ════════════════════════════════════════════════════════════════ */

const MEMBERS = ["Priya Nair", "Rahul Mehta", "Meera Iyer", "Arjun Rao"];
const WEEKDAY = ["S", "M", "T", "W", "T", "F", "S"];

export function StreakPiece() {
  const { status, streakLogged, logStreak } = useBattle();
  const today = useToday();
  const youDone = streakLogged || status === "submitted";
  const days = youDone ? 15 : 14;

  const rows: { name: string; you?: boolean }[] = [...MEMBERS.map((name) => ({ name })), { name: "You", you: true }];

  return (
    <StagePass
      style={{ "--stub-h": "120px" } as CSSProperties}
      body={
        <div>
          <div className="flex items-start justify-between gap-3">
            <p className="flex items-end gap-3">
              <Flame
                className="mb-1.5 h-9 w-9 text-primary sm:h-10 sm:w-10"
                strokeWidth={1.5}
                fill={youDone ? "currentColor" : "none"}
                aria-hidden
              />
              <span className="font-display text-[56px] font-semibold leading-none tracking-[-0.03em] text-text-primary tnum sm:text-[64px]">
                <span key={days} className={styles.roll}>
                  {days}
                </span>
              </span>
              <span className="mb-1.5 font-display text-2xl font-semibold leading-none tracking-[-0.015em] text-text-secondary">
                days
              </span>
            </p>
            <ExampleTag className="mt-1" />
          </div>
          <p className="mt-3 text-sm leading-6 text-text-secondary">
            Squad Kshatriya ·{" "}
            {youDone ? "all five solved today. The streak holds." : "four of five have solved today."}
          </p>

          <div className="mt-6 overflow-x-auto">
            <table className="w-auto min-w-[300px] border-separate border-spacing-y-1.5 text-sm">
              <caption className="sr-only">Who solved each of the last seven days</caption>
              <thead>
                <tr>
                  <th scope="col" className="sr-only">
                    Member
                  </th>
                  {Array.from({ length: 7 }, (_, i) => {
                    const d = today ? daysAgo(today, 6 - i) : null;
                    return (
                      <th
                        key={i}
                        scope="col"
                        className={cn(
                          "w-7 pb-1 text-center font-mono text-[10px] font-medium leading-4 text-text-tertiary",
                          i === 6 && "text-text-primary"
                        )}
                      >
                        {d ? WEEKDAY[d.getDay()] : "·"}
                        {i === 6 && <span className="sr-only"> (today)</span>}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.name}>
                    <th scope="row" className="w-28 pr-4 text-left font-normal sm:w-36">
                      <span className="flex items-center gap-2">
                        {r.you ? (
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-hairline-strong text-[10px] text-text-tertiary">
                            You
                          </span>
                        ) : (
                          <Avatar name={r.name} size="sm" />
                        )}
                        <span className={cn("truncate text-sm", r.you ? "text-text-primary" : "text-text-secondary")}>
                          {r.you ? "You" : r.name.split(" ")[0]}
                        </span>
                      </span>
                    </th>
                    {Array.from({ length: 7 }, (_, i) => {
                      const isToday = i === 6;
                      const filled = !r.you || !isToday ? true : youDone;
                      return (
                        <td key={i} className="text-center">
                          <span
                            aria-label={filled ? "solved" : "not yet"}
                            className={cn(
                              "inline-block h-2.5 w-2.5 rounded-full align-middle",
                              filled ? "bg-verified" : "border border-primary bg-transparent",
                              r.you && isToday && youDone && styles.pop
                            )}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            {youDone ? (
              <p className="text-sm leading-5 text-text-secondary">
                {status === "submitted" ? "Your run from the battle above counted." : "Logged. Same time tomorrow."}
              </p>
            ) : (
              <>
                <button type="button" onClick={logStreak} className={btnSecondary}>
                  Log today&apos;s solve
                </button>
                <span className="text-xs text-text-tertiary">You&apos;re the last one today.</span>
              </>
            )}
          </div>
        </div>
      }
      stub={
        <>
          <Serial label="Squad">Kshatriya</Serial>
          <Serial label="Since">{today ? shortDate(daysAgo(today, 14)) : "2 weeks"}</Serial>
          <Serial label="Members">5</Serial>
          <Serial label="Today" tone={youDone ? "verified" : "muted"}>
            {youDone ? "5 of 5" : "4 of 5"}
          </Serial>
        </>
      }
    />
  );
}
