"use client";

import Link from "next/link";
import { useEffect, useRef, useSyncExternalStore } from "react";
import type { CSSProperties } from "react";
import { ArrowRight } from "lucide-react";
import { Monogram, Wordmark } from "@/components/landing/Brand";
import { cn } from "@/lib/utils";
import { BattleProvider, useBattle } from "./battle";
import { HeroPass } from "./HeroPass";
import { ChallengePiece, CodePiece, ProofPiece, SarathiPiece, StreakPiece } from "./pieces";
import { Aside, Beat, Stage, Statement, btnGhost, btnGold, btnSecondary } from "./Scene";
import { useScrollProgress } from "./motion";
import { SolveDock } from "./SolveDock";
import styles from "./landing.module.css";

/**
 * Public landing: short, very large sentences, each followed by a working
 * piece of Mahayuddh. The hero's "Try it" starts a real battle timer that
 * follows the visitor down the page as the solve dock.
 *
 * Everyone on this page (Priya, Rahul, Meera, Arjun, Squad Kshatriya) is an
 * example and every piece says so. The page makes no claims about users,
 * counts or results.
 */

const SIGNUP = "/login?mode=signup&next=%2Fsquad";

export function Landing() {
  return (
    <BattleProvider>
      <div className={cn(styles.page, "min-h-screen bg-canvas text-text-primary")}>
        <LandingNav />
        <main>
          <Hero />

          <Beat id="proof" label="Proof">
            <Statement parts={["Priya solved it in ", { mono: "14:22" }, "."]} className="max-w-[13ch]" />
            <div className="mt-10 grid gap-12 md:mt-14 lg:grid-cols-12 lg:gap-x-10">
              <div className="lg:col-span-4 lg:pt-6">
                <Aside>
                  Every solve is timed. Solves synced from LeetCode are verified, and the rest
                  say self-reported, so nobody has to take anyone&apos;s word for it.
                </Aside>
              </div>
              <Stage enter="turnRight" className="lg:col-span-8">
                <ProofPiece />
              </Stage>
            </div>
          </Beat>

          <Beat id="code" label="Approaches">
            <div className="max-w-[760px]">
              <Statement size="lg" parts={["See how she thought about it."]} className="max-w-[12ch]" />
              <Aside className="mt-6 md:mt-8">
                Code from your squad stays hidden until you&apos;ve tried the problem yourself,
                or choose to look.
              </Aside>
            </div>
            <Stage enter="dolly" className="mt-12 md:mt-16">
              <CodePiece />
            </Stage>
          </Beat>

          <Beat id="sarathi" label="Sarathi">
            <div className="grid gap-12 lg:grid-cols-12 lg:items-center lg:gap-x-12">
              <div className="lg:order-2 lg:col-span-6">
                <Statement
                  size="lg"
                  parts={["Stuck? You get a question, not the code."]}
                  className="max-w-[13ch]"
                />
                <Aside className="mt-6 md:mt-8">
                  Sarathi, your guide, nudges in steps you choose. It never writes the solution
                  for you.
                </Aside>
              </div>
              <Stage enter="turnLeft" className="lg:order-1 lg:col-span-6">
                <SarathiPiece />
              </Stage>
            </div>
          </Beat>

          <Beat id="challenge" label="Challenges">
            <Statement
              parts={["Rahul thinks you can't beat ", { mono: "38:11" }, "."]}
              className="max-w-[14ch]"
            />
            <div className="mt-10 grid gap-10 md:mt-14 lg:grid-cols-12 lg:items-end lg:gap-x-10">
              <Stage enter="turnLeft" className="lg:col-span-7">
                <ChallengePiece />
              </Stage>
              <Aside className="lg:col-span-4 lg:col-start-9 lg:pb-8">
                A challenge is one problem, one time to beat, one friend. Beat it and they hear
                about it.
              </Aside>
            </div>
          </Beat>

          <Beat id="streak" label="Squad streak">
            <div className="mx-auto max-w-[900px] text-left md:text-center">
              <Statement parts={["Fourteen days. Nobody has missed one."]} className="md:mx-auto md:max-w-[16ch]" />
              <Aside className="mt-6 md:mx-auto md:mt-8">
                A squad streak only counts the days everyone solved. Not a sum of five solo
                streaks: one streak, kept together.
              </Aside>
            </div>
            <Stage enter="rise" className="mx-auto mt-12 max-w-[820px] md:mt-16">
              <StreakPiece />
            </Stage>
          </Beat>

          <Beat label="What it isn't" className="py-[clamp(4rem,9vw,7rem)]">
            <Statement parts={["No XP. No coins. No levels."]} className="max-w-[12ch]" />
            <Aside className="mt-6 md:mt-8">
              No countdowns built to rush you. No LeetCode account needed to start. Just your
              people and one problem a day.
            </Aside>
          </Beat>

          <Close />
        </main>
        <LandingFooter />
        <SolveDock />
        <Announcer />
      </div>
    </BattleProvider>
  );
}

/* ── Nav ─────────────────────────────────────────────────────── */

function subscribeScroll(cb: () => void) {
  window.addEventListener("scroll", cb, { passive: true });
  return () => window.removeEventListener("scroll", cb);
}

function LandingNav() {
  const scrolled = useSyncExternalStore(
    subscribeScroll,
    () => window.scrollY > 12,
    () => false
  );
  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 border-b transition-[background-color,border-color] duration-200 ease-out",
        scrolled ? "border-hairline bg-canvas" : "border-transparent bg-transparent"
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between px-4 md:px-10">
        <Wordmark textClassName="text-base md:text-lg" />
        <nav aria-label="Account" className="flex items-center gap-1 md:gap-2">
          <Link href="/login" className={cn(btnGhost, "max-[380px]:hidden")}>
            Sign in
          </Link>
          <Link href={SIGNUP} className={cn(btnSecondary, "h-10 px-3.5")}>
            Start a squad
          </Link>
        </nav>
      </div>
    </header>
  );
}

/* ── Opening shot ────────────────────────────────────────────── */

function Hero() {
  // --q runs 0 → 1 over the first ~70% of a viewport of scrolling.
  const ref = useScrollProgress<HTMLElement>(0, -0.7, "--q");
  return (
    <section
      ref={ref}
      aria-label="Practice DSA with your people"
      className="relative pb-[clamp(3rem,8vw,6rem)] pt-28 md:pt-36"
    >
      <div className="mx-auto w-full max-w-[1200px] px-4 md:px-10">
        <h1 className={cn(styles.heroDrift, "font-display text-[clamp(2.75rem,0.6rem+6.6vw,6rem)] font-semibold leading-[0.95] tracking-[-0.038em] text-text-primary")}>
          <span className={styles.line}>
            <span className={styles.lineInner} style={{ "--d": "60ms" } as CSSProperties}>
              Practice DSA
            </span>
          </span>
          <span className={styles.line}>
            <span
              className={cn(styles.lineInner, "lg:pl-[25%]")}
              style={{ "--d": "170ms" } as CSSProperties}
            >
              with your people.
            </span>
          </span>
        </h1>

        <div className="mt-8 grid gap-12 md:mt-12 lg:mt-14 lg:grid-cols-12 lg:gap-x-10">
          <div className="lg:col-span-4">
            <p
              className={cn(styles.fadeUp, "max-w-[30rem] text-[17px] leading-7 text-text-secondary md:text-lg md:leading-[30px]")}
              style={{ "--d": "380ms" } as CSSProperties}
            >
              One problem a day, timed and verified. Your squad sees who solved it, how fast,
              and how they thought about it.
            </p>
            <div
              className={cn(styles.fadeUp, "mt-8 flex flex-col gap-2 sm:flex-row sm:items-center lg:flex-col lg:items-start xl:flex-row xl:items-center")}
              style={{ "--d": "480ms" } as CSSProperties}
            >
              <Link href={SIGNUP} className={btnGold}>
                Start a squad
                <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              </Link>
              <Link href={SIGNUP} className={cn(btnGhost, "h-12 px-4 text-[15px] text-text-primary md:h-12")}>
                Join with a code
              </Link>
            </div>
            <p
              className={cn(styles.fadeUp, "mt-4 text-xs leading-4 text-text-tertiary")}
              style={{ "--d": "560ms" } as CSSProperties}
            >
              Free. Works without a LeetCode account.
            </p>
          </div>

          <div className="relative lg:col-span-8 lg:mt-[20vh]">
            <div aria-hidden className={styles.heroLight} />
            <div className={cn(styles.heroDolly, "relative z-10")}>
              <HeroPass />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Close ───────────────────────────────────────────────────── */

function Close() {
  const { setCloseInView } = useBattle();
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setCloseInView(!!e?.isIntersecting), {
      threshold: 0.2,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [setCloseInView]);
  return (
    <section ref={ref} aria-label="Start a squad" className="relative py-[clamp(6rem,15vw,12rem)]">
      <Stage floor={false} enter="dolly" className="mx-auto w-full max-w-[1200px] px-4 text-center md:px-10">
        <Statement size="hero" parts={["Bring your people."]} className="mx-auto max-w-[10ch]" />
        <Aside className="mx-auto mt-6 md:mt-8">
          Start a squad, send the code to your friends, and the next problem lands for all of
          you at midnight.
        </Aside>
        <div className="mt-10 flex flex-col items-center justify-center gap-2 sm:flex-row">
          <Link href={SIGNUP} className={cn(btnGold, "w-full sm:w-auto")}>
            Start a squad
            <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </Link>
          <Link href={SIGNUP} className={cn(btnGhost, "h-12 px-4 text-[15px] text-text-primary md:h-12")}>
            Join with a code
          </Link>
        </div>
        <p className="mt-4 text-xs leading-4 text-text-tertiary">Free. Works without a LeetCode account.</p>
      </Stage>
    </section>
  );
}

/* ── Footer ──────────────────────────────────────────────────── */

function LandingFooter() {
  const link =
    "inline-flex min-h-[44px] items-center text-xs text-text-secondary transition-colors hover:text-text-primary";
  return (
    <footer className="border-t border-hairline">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-3 px-4 pb-24 pt-8 md:flex-row md:items-center md:justify-between md:px-10 md:pb-10">
        <p className="flex items-center gap-2.5">
          <Monogram size="sm" />
          <span className="font-display text-sm font-semibold tracking-tight text-text-secondary">Mahayuddh</span>
          <span className="hidden text-xs text-text-tertiary sm:inline">· Practice DSA with your people.</span>
        </p>
        <nav aria-label="Footer" className="flex items-center gap-5 md:gap-6">
          <Link href="/primers" className={link}>
            Primers
          </Link>
          <Link href="/privacy" className={link}>
            Privacy
          </Link>
          <Link href="/terms" className={link}>
            Terms
          </Link>
          <Link href="/login" className={link}>
            Sign in
          </Link>
        </nav>
      </div>
    </footer>
  );
}

function Announcer() {
  const { announcement } = useBattle();
  return (
    <p className="sr-only" aria-live="polite">
      {announcement}
    </p>
  );
}
