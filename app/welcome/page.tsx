import type { ReactNode } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Check } from "lucide-react";
import { Pass } from "@/components/pass/Pass";
import { Avatar } from "@/components/ui/Avatar";
import { DifficultyBadgeNew, PatternChip, VerifiedBadge } from "@/components/ui/Badge";
import { Monogram, Wordmark } from "@/components/landing/Brand";
import { ExamplePass } from "@/components/landing/ExamplePass";
import { cn } from "@/lib/utils";

/**
 * Public landing (01): persuasion in six stages, laid out from the Stitch
 * "Landing Page" frames.
 *
 * The hero is a giant Pass — the offer itself. Stages 2–6 follow the spec:
 * the problem, one day in a squad, fanned shareable Passes, what it isn't,
 * and the close. Server component, no client JS.
 *
 * Everything below the hero that looks like product UI is an illustration:
 * the timeline is a narrated example day and every pass is tagged EXAMPLE.
 * The page makes no claims about users, counts or results.
 */

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Mahayuddh — Practice DSA With Your People",
  description:
    "One problem a day, timed and verified. Your squad sees who solved it, how fast, and how they thought about it.",
  openGraph: {
    title: "Mahayuddh — Practice DSA With Your People",
    description:
      "One problem a day, timed and verified. Your squad sees who solved it, how fast, and how they thought about it.",
    type: "website",
  },
};

const primaryBtn =
  "inline-flex items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-on-primary transition-colors hover:bg-primary-hover active:bg-primary-pressed";
const secondaryBtn =
  "inline-flex items-center justify-center rounded-md border border-hairline-strong bg-surface-overlay px-5 text-sm font-medium text-text-primary transition-colors hover:bg-[#272830]";

const sectionInner = "mx-auto w-full max-w-content px-4 md:px-8";
const h2Cls =
  "font-display text-2xl font-semibold leading-tight tracking-tight text-text-primary sm:text-3xl md:text-4xl";
const cardCls = "max-w-[620px] rounded-lg border border-hairline bg-surface p-3 md:p-5";

/** Barcode bar widths/heights for the hero stub. Decorative only. */
const BARCODE: [number, string][] = [
  [2, "h-full"], [3, "h-4/5"], [1, "h-full"], [4, "h-3/5"], [2, "h-full"], [1, "h-4/5"],
  [3, "h-full"], [2, "h-2/3"], [4, "h-full"], [1, "h-3/4"], [2, "h-full"], [3, "h-4/5"],
];

const HERO_STUB: { label: string; value: string; verified?: boolean }[] = [
  { label: "Squad size", value: "Admit 2–7" },
  { label: "Origin squad", value: "Squad · yours" },
  { label: "Cadence", value: "Daily · 1 problem" },
  { label: "Proof level", value: "Proof · verified", verified: true },
];

function Moment({
  time,
  title,
  shortTitle,
  dot = "default",
  children,
}: {
  time: string;
  title: string;
  /** Phone label when `title` would wrap at 390px. */
  shortTitle?: string;
  dot?: "default" | "verified";
  children: ReactNode;
}) {
  return (
    <li className="group relative">
      <span
        aria-hidden
        className={cn(
          "absolute -left-[31px] top-1 h-3.5 w-3.5 rounded-full border transition-colors md:-left-[39px]",
          dot === "verified"
            ? "border-verified bg-verified"
            : "border-hairline-strong bg-surface-raised group-hover:border-primary group-hover:bg-primary"
        )}
      />
      <p
        className={cn(
          "mb-2 font-mono text-[11px] leading-4 tnum md:text-xs",
          dot === "verified" ? "font-medium text-verified md:font-normal md:text-text-tertiary" : "text-text-tertiary"
        )}
      >
        {time} ·{" "}
        {shortTitle ? (
          <>
            <span className="md:hidden">{shortTitle}</span>
            <span className="hidden md:inline">{title}</span>
          </>
        ) : (
          title
        )}
      </p>
      {children}
    </li>
  );
}

export default function WelcomePage() {
  return (
    <div className="min-h-screen bg-canvas text-text-primary">
      <header className="sticky top-0 z-40 w-full border-b border-hairline bg-canvas/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-content items-center justify-between px-4 md:px-8">
          <Wordmark textClassName="text-base md:text-lg" />
          <nav aria-label="Account" className="flex items-center gap-1 md:gap-3">
            <Link href="/login" className="group inline-flex min-h-[44px] items-center">
              <span className="inline-flex h-8 items-center rounded-md px-2.5 text-xs font-medium text-text-secondary transition-colors group-hover:bg-surface-raised group-hover:text-text-primary md:h-9 md:px-3.5 md:text-sm">
                Sign in
              </span>
            </Link>
            <Link href="/login?mode=signup" className="group inline-flex min-h-[44px] items-center">
              <span className="inline-flex h-8 items-center rounded-md border border-hairline-strong bg-surface-overlay px-3 text-xs font-medium text-text-primary transition-colors group-hover:bg-[#272830] md:h-9 md:px-3.5 md:text-sm">
                <span className="md:hidden">Join code</span>
                <span className="hidden md:inline">Join with a code</span>
              </span>
            </Link>
          </nav>
        </div>
      </header>

      {/* Stage 1: the admission pass */}
      <section
        aria-label="Start"
        className="flex w-full items-center justify-center px-4 pt-4 md:min-h-[calc(100vh-3.5rem)] md:px-8 md:py-16"
      >
        <div className="mx-auto w-full max-w-[1040px]">
          <Pass
            className="shadow-overlay md:shadow-none [&>.pass-body]:p-5 md:[&>.pass-body]:p-12 lg:[&>.pass-body]:p-14"
            stubClassName="justify-between gap-3 p-4 md:gap-8 md:p-10"
            body={
              <div className="flex h-full flex-col justify-between">
                <div>
                  <span className="mb-4 inline-flex items-center gap-1.5 font-mono text-[11px] font-medium uppercase tracking-wider text-primary md:mb-6 md:rounded-full md:border md:border-primary/20 md:bg-primary-tint md:px-2.5 md:py-1 md:text-xs md:tracking-wide">
                    <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-primary motion-safe:animate-gold-pulse" />
                    Pass #001 · Daily battle
                  </span>
                  <h1 className="max-w-[620px] font-display text-[32px] font-semibold leading-[1.08] tracking-tight text-text-primary sm:text-4xl md:text-5xl lg:text-[54px] lg:leading-[1.05]">
                    Practice DSA with your people.
                  </h1>
                  <p className="mt-4 max-w-[580px] text-sm leading-relaxed text-text-secondary sm:mt-6 sm:text-lg">
                    One problem a day, timed and verified. Your squad sees who solved it, how
                    fast, and how they thought about it.
                  </p>
                </div>
                <div className="mt-5 md:mt-12 md:pt-4">
                  <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3.5">
                    <Link href="/login?mode=signup" className={cn(primaryBtn, "h-11 sm:h-12")}>
                      Start solo
                    </Link>
                    {/* No demo squad is seeded in deployed databases, so the old
                        /squad/join/DEMO2026 link dead-ended at a 404. Until a
                        seeded demo exists, this points at the example passes
                        below — content that exists on this page. */}
                    <Link href="#examples" className={cn(secondaryBtn, "h-11 sm:h-12")}>
                      Explore example passes
                    </Link>
                  </div>
                  <p className="mt-3.5 text-center text-[11px] leading-4 text-text-tertiary sm:text-left sm:text-xs">
                    Free. Works without a LeetCode account.
                  </p>
                </div>
              </div>
            }
            stub={
              <>
                <div>
                  <p className="hidden border-b border-hairline pb-3 font-mono text-[11px] uppercase tracking-widest text-text-tertiary md:block">
                    Stub // Ticket auth
                  </p>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 font-mono md:mt-6 md:grid-cols-1 md:gap-y-4">
                    {HERO_STUB.map((f) => (
                      <div key={f.label} className="min-w-0">
                        <dt className="text-[9px] uppercase leading-4 tracking-widest text-text-tertiary md:text-[10px] md:tracking-wider">
                          {f.label}
                        </dt>
                        <dd
                          className={cn(
                            "mt-0.5 flex items-center gap-1 text-[11px] font-medium uppercase leading-4 md:gap-1.5 md:text-sm md:font-semibold",
                            f.verified ? "text-verified" : "text-text-secondary md:text-text-primary"
                          )}
                        >
                          {f.verified && <Check className="h-3 w-3 md:h-3.5 md:w-3.5" strokeWidth={2} aria-hidden />}
                          {f.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <div
                  aria-hidden
                  className="flex items-center justify-between gap-3 border-t border-hairline pt-2 md:block md:border-t-0 md:pt-0"
                >
                  <div className="flex h-4 w-28 items-end justify-between opacity-40 md:h-7 md:w-full">
                    {BARCODE.map(([w, h], i) => (
                      <span key={i} className={cn("bg-text-secondary", h)} style={{ width: w }} />
                    ))}
                  </div>
                  <p className="font-mono text-[9px] uppercase tracking-wider text-text-tertiary md:mt-2 md:text-[10px]">
                    #MAHA-2026-PASS-01
                  </p>
                </div>
              </>
            }
          />
        </div>
      </section>

      {/* Stage 2: the problem */}
      <section aria-label="The problem" className="w-full pt-14 md:border-t md:border-hairline md:py-32">
        <div className={sectionInner}>
          <div className="max-w-[760px]">
            <h2 className={cn(h2Cls, "mb-4 md:mb-10")}>Solo grinding stalls quietly.</h2>
            <div className="flex flex-col gap-3 border-l-2 border-hairline-strong py-0.5 pl-3.5 md:gap-6 md:border-l-0 md:py-0 md:pl-0">
              {[
                "Streaks break and nobody notices.",
                "A 150-problem sheet feels like a wall.",
                "Global ranks tell you nothing about your friends.",
              ].map((line) => (
                <p
                  key={line}
                  className="text-sm leading-snug text-text-secondary transition-colors md:border-l-2 md:border-hairline-strong md:py-1 md:pl-6 md:text-[26px] md:hover:border-primary md:hover:text-text-primary"
                >
                  {line}
                </p>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stage 3: one day in a squad */}
      <section
        aria-label="One day in a squad"
        className="w-full pt-14 md:border-t md:border-hairline md:bg-well/40 md:py-32"
      >
        <div className={sectionInner}>
          <div className="mb-5 max-w-[680px] md:mb-16">
            <h2 className={h2Cls}>One day in a squad.</h2>
            <p className="mt-1 text-[13px] leading-5 text-text-tertiary md:mt-3 md:text-base md:leading-6 md:text-text-secondary">
              How five friends keep an unbroken streak without meetings, calls, or silent
              drop-offs.
            </p>
          </div>

          <ol className="relative max-w-[840px] space-y-6 border-l border-hairline pl-6 md:space-y-12 md:pl-8">
            <Moment time="07:40" title="You open the Arena">
              <div className={cn(cardCls, "flex items-center justify-between gap-3")}>
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-1.5 md:mb-1.5 md:gap-2">
                    <span className="font-mono text-[11px] text-text-tertiary tnum md:text-xs">No. 518</span>
                    <DifficultyBadgeNew difficulty="Medium" size="sm" />
                    <PatternChip label="DP" className="h-5 px-2 text-[11px] md:hidden" />
                    <PatternChip label="Dynamic programming" className="hidden h-5 px-2 text-[11px] md:inline-flex" />
                  </div>
                  <p className="text-[13px] font-medium text-text-primary md:font-display md:text-lg md:font-semibold">
                    Coin Change II
                  </p>
                </div>
                <span className="inline-flex h-6 shrink-0 items-center rounded-xs border border-hairline bg-well px-1.5 font-mono text-[10px] uppercase text-text-tertiary md:h-8 md:rounded-md md:bg-surface-raised md:px-3 md:font-sans md:text-xs md:font-medium md:normal-case md:text-text-secondary">
                  Daily pick
                </span>
              </div>
            </Moment>

            <Moment time="13:10" title="Priya solves it in 14:22">
              <div className={cn(cardCls, "flex items-center justify-between gap-3")}>
                <div className="flex min-w-0 items-center gap-2 md:gap-3">
                  <Avatar name="Priya Nair" size="sm" className="font-mono md:hidden" />
                  <Avatar name="Priya Nair" size="md" className="hidden font-mono md:inline-flex" />
                  <div className="flex min-w-0 flex-col md:flex-row md:items-baseline md:gap-2">
                    <span className="truncate text-xs font-medium text-text-primary md:text-sm">Priya Nair</span>
                    <span className="truncate font-mono text-[10px] text-text-tertiary md:font-sans md:text-xs">
                      @priya · LC sync
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 md:gap-2.5">
                  <span className="font-mono text-xs font-medium text-text-primary tnum md:text-sm">14:22</span>
                  <VerifiedBadge />
                </div>
              </div>
            </Moment>

            <Moment time="13:12" title="Rahul challenges you">
              <div className={cn(cardCls, "flex items-center justify-between gap-3")}>
                <div className="min-w-0">
                  <p className="font-mono text-[10px] uppercase text-text-tertiary md:text-xs">1v1 squad duel</p>
                  <p className="mt-0.5 text-xs font-medium text-text-primary md:text-sm">
                    Beat Rahul&apos;s benchmark:{" "}
                    <span className="font-mono font-semibold text-primary tnum">19:47</span>
                  </p>
                </div>
                <span className="shrink-0 font-mono text-[11px] text-text-tertiary md:rounded-xs md:border md:border-hairline md:bg-surface-raised md:px-2.5 md:py-1 md:text-xs">
                  Coin Change II
                </span>
              </div>
            </Moment>

            <Moment time="21:30" title="You solve it in 16:05" dot="verified">
              <div className={cn(cardCls, "flex items-center justify-between gap-3")}>
                <div className="min-w-0">
                  <p className="font-mono text-[10px] uppercase text-text-tertiary md:text-xs">Your attempt</p>
                  <p className="mt-0.5 flex items-baseline gap-2">
                    <span className="font-mono text-base font-semibold text-text-primary tnum md:text-lg md:font-medium">
                      16:05
                    </span>
                    <span className="text-[11px] text-text-secondary md:text-xs md:text-text-tertiary">
                      Clean single pass
                    </span>
                  </p>
                </div>
                <VerifiedBadge className="shrink-0" />
              </div>
            </Moment>

            <Moment time="21:34" title="You explain your approach in two sentences" shortTitle="You explain your approach">
              <div className={cn(cardCls, "flex flex-col gap-2 md:gap-0")}>
                <p className="font-mono text-[10px] uppercase text-pattern md:mb-1 md:text-xs md:text-text-tertiary">
                  Core idea · your approach
                </p>
                <p className="rounded-xs border border-hairline bg-well p-2 text-xs italic leading-relaxed text-text-secondary md:border-0 md:bg-transparent md:p-0 md:text-sm md:text-text-primary">
                  “Outer loop goes through coins, inner loop amounts from coin to amount.
                  Reversing the loops counts permutations instead of unique combinations.”
                </p>
                <p className="font-mono text-[10px] text-text-tertiary md:mt-3 md:text-xs">
                  1D DP · O(amount × coins)
                </p>
              </div>
            </Moment>

            <Moment time="21:40" title="You compare with your squad">
              <div className="grid max-w-[620px] grid-cols-2 gap-2 md:gap-4 md:rounded-lg md:border md:border-hairline md:bg-surface md:p-5">
                {[
                  { name: "Priya", time: "14:22", note: "1D array, bottom-up knapsack. Space optimized to O(amount)." },
                  { name: "Rahul", time: "19:47", note: "2D matrix memoization. Converted to 1D after a TLE check." },
                ].map((s) => (
                  <div
                    key={s.name}
                    className="flex min-w-0 flex-col gap-1 rounded-md border border-hairline bg-surface p-2.5 md:bg-well md:p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-medium text-text-primary md:text-xs">{s.name}</span>
                      <span className="font-mono text-[10px] text-text-secondary tnum md:text-xs">{s.time}</span>
                    </div>
                    <p className="line-clamp-2 text-[10px] leading-4 text-text-tertiary md:line-clamp-none md:text-xs md:text-text-secondary">
                      {s.note}
                    </p>
                  </div>
                ))}
              </div>
            </Moment>
          </ol>
        </div>
      </section>

      {/* Stage 4: things you'll want to screenshot */}
      <section
        id="examples"
        aria-label="Shareable passes"
        className="w-full scroll-mt-20 overflow-hidden pt-14 md:border-t md:border-hairline md:py-32"
      >
        <div className={sectionInner}>
          <div className="mb-4 max-w-[680px] md:mb-16">
            <h2 className={h2Cls}>Proof you&apos;ll actually want to share.</h2>
            <p className="mt-1 text-[13px] leading-5 text-text-tertiary md:mt-3 md:text-base md:leading-6 md:text-text-secondary">
              Built like physical event passes with perforated stubs and serial stamps. No
              gamified badges or confetti.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 pt-1 md:grid-cols-2 md:gap-8 md:pt-4 lg:gap-10">
            <ExamplePass
              label="Today's Battle Pass"
              stub={["Squad Kshatriya", "3 of 5 solved"]}
              caption="The focal point of the daily Arena. Turns into verified proof the moment you solve."
              className="md:-rotate-1"
            >
              <div className="md:space-y-4">
                <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
                  <span className="font-mono text-[11px] text-text-tertiary tnum md:text-xs">No. 518</span>
                  <DifficultyBadgeNew difficulty="Medium" size="sm" />
                  <PatternChip label="Dynamic programming" className="h-5 rounded-xs px-1.5 text-[10px] md:text-xs" />
                </div>
                <p className="mt-1 font-display text-lg font-semibold text-text-primary md:mt-0 md:text-2xl">
                  Coin Change II
                </p>
                <p className="mt-1 text-[11px] leading-4 text-text-tertiary md:mt-0 md:text-xs md:text-text-secondary">
                  Priya, Rahul and Sneha solved this · fastest{" "}
                  <span className="font-mono tnum">14:22</span> by @priya
                </p>
              </div>
            </ExamplePass>

            <ExamplePass
              label="Verified Proof Card"
              tone="verified"
              stub={["Solver: @prem", "No. 3"]}
              caption="Clean, shareable proof of deliberate improvement."
              className="md:rotate-[1.2deg]"
            >
              <div className="md:space-y-3">
                <p className="text-xs text-text-secondary">Longest Substring Without Repeating Characters</p>
                <p className="mt-1 flex flex-wrap items-baseline gap-2 md:mt-0 md:gap-3">
                  <span className="font-mono text-[28px] font-semibold leading-none tracking-tight text-text-primary tnum sm:text-5xl">
                    15:06
                  </span>
                  <span className="font-mono text-xs text-text-tertiary line-through tnum">23:40</span>
                  <span className="font-mono text-[11px] font-medium text-verified tnum md:text-xs">
                    8m 34s faster
                  </span>
                </p>
                <div className="pt-2">
                  <VerifiedBadge />
                </div>
              </div>
            </ExamplePass>

            <ExamplePass
              label="Squad Streak Card"
              stub={["Run started 28 Sep", "5 members"]}
              caption="Requires every member to solve daily. Never a sum of disconnected personal grinds."
              className="md:rotate-[0.8deg]"
            >
              <div className="md:space-y-4">
                <p className="flex items-baseline gap-2">
                  <span className="font-display text-[32px] font-semibold leading-none tracking-tight text-text-primary tnum sm:text-5xl">
                    14
                  </span>
                  <span className="text-sm font-medium text-text-secondary md:font-display md:text-lg">
                    day streak
                  </span>
                </p>
                <p className="mt-1.5 text-[11px] leading-4 text-text-tertiary md:mt-0 md:text-xs md:text-text-secondary">
                  Squad Kshatriya · all 5 members solved every day since 28 Sep
                </p>
                <div className="mt-2.5 flex items-center gap-1.5 md:mt-0 md:gap-2 md:pt-1">
                  {Array.from({ length: 7 }, (_, i) => (
                    <span key={i} aria-hidden className="h-2.5 w-2.5 rounded-full bg-verified" />
                  ))}
                  <span className="ml-1.5 font-mono text-[10px] text-text-secondary md:ml-2 md:text-xs md:text-text-tertiary">
                    Last 7 days
                  </span>
                </div>
              </div>
            </ExamplePass>

            <ExamplePass
              label="1v1 Challenge Pass"
              stub={["From: @rahul", "Status: open"]}
              caption="Friendly peer ticket. Solve it, then try to beat the benchmark."
              className="md:rotate-[-1.5deg]"
            >
              <div className="md:space-y-3">
                <p className="text-[11px] text-text-tertiary md:text-xs md:font-medium md:text-text-secondary">
                  Rahul challenged you
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm font-semibold text-text-primary md:mt-0 md:font-display md:text-xl">
                  Word Ladder
                  <DifficultyBadgeNew difficulty="Hard" size="sm" className="font-sans" />
                </p>
                <p className="mt-2 flex items-baseline justify-between gap-2 rounded-xs border border-hairline bg-well p-2 md:mt-0 md:justify-start md:border-0 md:bg-transparent md:p-0">
                  <span className="font-mono text-[10px] uppercase text-text-tertiary md:text-xs">
                    Target objective
                  </span>
                  <span className="font-mono text-base font-semibold uppercase text-primary tnum md:text-2xl">
                    Beat 38:11
                  </span>
                </p>
                <p className="mt-2 text-[11px] italic leading-4 text-text-tertiary md:mt-0 md:rounded-xs md:border md:border-hairline md:bg-well md:p-2.5 md:text-xs">
                  “Took me two tries. Think hard about the visited set.”
                </p>
              </div>
            </ExamplePass>
          </div>
        </div>
      </section>

      {/* Stage 5: what it isn't */}
      <section
        aria-label="What it isn't"
        className="w-full pt-14 md:border-t md:border-hairline md:bg-well/30 md:py-32"
      >
        <div className={sectionInner}>
          <div className="max-w-[760px]">
            <h2 className={cn(h2Cls, "mb-4 md:mb-12")}>What it isn&apos;t.</h2>
            <ul className="flex flex-col gap-3 border-l-2 border-hairline-strong py-0.5 pl-3.5 md:gap-5 md:border-l-0 md:py-0 md:pl-0">
              {[
                "No XP, coins, or levels.",
                "No wagers.",
                "No countdowns built to rush you.",
                "No AI that hands you the code.",
                "No LeetCode account required.",
              ].map((line) => (
                <li
                  key={line}
                  className="flex items-center gap-1.5 text-sm leading-snug text-text-secondary md:gap-3.5 md:border-b md:border-hairline md:pb-4 md:text-lg"
                >
                  <span aria-hidden className="md:font-mono md:text-sm md:text-text-tertiary">
                    —
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Stage 6: the close */}
      <section aria-label="Start" className="w-full py-14 md:border-t md:border-hairline md:py-32">
        <div className={cn(sectionInner, "flex justify-center")}>
          <div className="w-full max-w-[760px]">
            <Pass
              className="shadow-lifted md:shadow-none [&>.pass-body]:p-5 md:[&>.pass-body]:p-10"
              stubClassName="justify-between p-3 md:p-8"
              body={
                <div className="flex h-full flex-col justify-between">
                  <div>
                    <span className="mb-3.5 inline-flex items-center font-mono text-[10px] font-medium uppercase tracking-wider text-primary md:mb-4 md:rounded-xs md:border md:border-primary/20 md:bg-primary-tint md:px-2 md:py-0.5 md:text-[11px] md:tracking-normal">
                      Ready to enter
                    </span>
                    <h2 className="font-display text-[22px] font-semibold leading-tight tracking-tight text-text-primary sm:text-3xl">
                      Your first battle takes two minutes.
                    </h2>
                    <p className="mt-3 text-[13px] leading-relaxed text-text-secondary md:text-sm">
                      Start solo today, or bring your friends to lock in a squad streak from day one.
                    </p>
                  </div>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 md:mt-8">
                    <Link href="/login?mode=signup" className={cn(primaryBtn, "h-11 px-5 md:h-10")}>
                      Start solo
                    </Link>
                    <Link
                      href="/login?mode=signup"
                      className="inline-flex h-11 items-center justify-center rounded-md border border-hairline px-4 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary md:h-10 md:border-transparent"
                    >
                      Join with a code
                    </Link>
                  </div>
                </div>
              }
              stub={
                <>
                  <div className="flex items-center justify-between font-mono text-[10px] uppercase text-text-tertiary md:hidden">
                    <span>Entry: No. 001</span>
                    <span className="font-medium tracking-wider text-primary">Your first battle</span>
                  </div>
                  <dl className="hidden space-y-4 font-mono md:block">
                    <div>
                      <dt className="text-[10px] uppercase tracking-wider text-text-tertiary">Entry</dt>
                      <dd className="mt-0.5 text-sm font-semibold uppercase text-text-primary tnum">No. 001</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase tracking-wider text-text-tertiary">Status</dt>
                      <dd className="mt-0.5 text-xs font-semibold uppercase text-primary">Your first battle</dd>
                    </div>
                  </dl>
                  <p aria-hidden className="hidden pt-6 font-mono text-[10px] tracking-wider text-text-tertiary md:block">
                    AUTH // PASS-ENTRY
                  </p>
                </>
              }
            />
          </div>
        </div>
      </section>

      <footer className="w-full md:border-t md:border-hairline md:py-12">
        <div className={cn(sectionInner, "pb-12 md:pb-0")}>
          <div className="flex flex-col gap-2 border-t border-hairline pt-5 md:flex-row md:items-center md:justify-between md:gap-6 md:border-t-0 md:pt-0">
            <div className="flex items-center justify-between gap-3 md:justify-start">
              <span className="flex items-center gap-2 md:gap-3">
                <Monogram size="sm" />
                <span className="font-display text-sm font-medium tracking-tight text-text-secondary">
                  Mahayuddh
                </span>
                <span className="ml-2 hidden text-xs text-text-tertiary md:inline">
                  Algorithmic mastery with your people.
                </span>
              </span>
              <FooterLinks className="md:hidden" />
            </div>
            <p className="text-xs text-text-tertiary md:hidden">Algorithmic mastery with your people.</p>
            <FooterLinks className="hidden md:flex" />
          </div>
        </div>
      </footer>
    </div>
  );
}

function FooterLinks({ className }: { className?: string }) {
  const cls =
    "inline-flex min-h-[44px] items-center px-1.5 text-xs text-text-secondary transition-colors hover:text-text-primary md:px-0";
  return (
    <nav aria-label="Footer" className={cn("flex items-center gap-2 md:gap-6", className)}>
      <Link href="/primers" className={cls}>
        Primers
      </Link>
      <Link href="/login" className={cls}>
        Sign in
      </Link>
    </nav>
  );
}
