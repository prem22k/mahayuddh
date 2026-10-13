import Link from "next/link";
import type { Metadata } from "next";
import { Pass, PassSerial } from "@/components/pass/Pass";
import { AvatarStack } from "@/components/ui/Avatar";
import { DifficultyBadgeNew, PatternChip, StreakChip, VerifiedBadge } from "@/components/ui/Badge";

/**
 * Public landing (01): persuasion in six stages.
 *
 * The hero is a giant Pass — the offer itself. Stages 2–6 follow the spec:
 * the problem, one day in a squad, fanned shareable Passes, what it isn't,
 * and the close. Server component, no client JS.
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

const DEMO_INVITE_CODE = "DEMO2026";

const primaryLg =
  "inline-flex min-h-[44px] items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-on-primary transition-colors hover:bg-primary-hover active:bg-primary-pressed";
const secondaryBtn =
  "inline-flex min-h-[44px] items-center justify-center rounded-md bg-surface-overlay px-6 text-sm font-medium text-text-primary transition-colors hover:bg-[#272830]";
const ghostBtn =
  "inline-flex min-h-[44px] items-center justify-center rounded-md px-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary";

const fanCls =
  "transition-transform duration-200 hover:rotate-0 hover:-translate-y-1";

export default function WelcomePage() {
  return (
    <main className="min-h-screen bg-canvas text-text-primary">
      <header className="mx-auto flex h-14 w-full max-w-content items-center justify-between px-4 md:px-10">
        <span className="font-display text-lg font-semibold tracking-tight">Mahayuddh</span>
        <div className="flex items-center gap-2">
          <Link href="/login" className={ghostBtn}>
            Sign in
          </Link>
          <Link href="/login?mode=signup" className={secondaryBtn}>
            Join with a code
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-content px-4 pb-16 md:px-10">
        {/* Stage 1: the admission pass */}
        <section aria-label="Start" className="pt-8 md:pt-14">
          <div className="mx-auto w-full max-w-[880px]">
            <Pass
              body={
                <div className="space-y-4">
                  <h1 className="font-display text-5xl font-semibold leading-none tracking-tight sm:text-6xl">
                    Practice DSA with your people.
                  </h1>
                  <p className="max-w-md text-base leading-7 text-text-secondary">
                    One problem a day, timed and verified. Your squad sees who solved it,
                    how fast, and how they thought about it.
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Link href="/login?mode=signup" className={`${primaryLg} h-12 px-6`}>
                      Start solo
                    </Link>
                    <Link href={`/squad/join/${DEMO_INVITE_CODE}`} className={secondaryBtn}>
                      Explore the demo squad
                    </Link>
                  </div>
                  <p className="text-xs leading-5 text-text-tertiary">
                    Free. Works without a LeetCode account.
                  </p>
                </div>
              }
              stub={
                <>
                  <PassSerial>Admit 2–7</PassSerial>
                  <PassSerial>Squad · yours</PassSerial>
                  <PassSerial>Daily · 1 problem</PassSerial>
                  <PassSerial>Proof · verified</PassSerial>
                </>
              }
            />
          </div>
        </section>

        {/* Stage 2: the problem */}
        <section aria-label="The problem" className="mx-auto max-w-reading py-16 md:py-20">
          <h2 className="font-display text-3xl font-semibold tracking-tight">
            Solo grinding stalls quietly.
          </h2>
          <div className="mt-4 space-y-1 text-base leading-7 text-text-secondary">
            <p>Streaks break and nobody notices.</p>
            <p>A 150-problem sheet feels like a wall.</p>
            <p>Global ranks tell you nothing about your friends.</p>
          </div>
        </section>

        {/* Stage 3: one day in a squad */}
        <section aria-label="One day in a squad" className="mx-auto max-w-reading">
          <h2 className="font-display text-3xl font-semibold tracking-tight">One day in a squad.</h2>
          <ol className="mt-6 space-y-5">
            {[
              {
                time: "07:40",
                title: "You open the Arena",
                body: (
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-hairline bg-surface px-4 py-3">
                    <span className="text-sm font-medium">Coin Change II</span>
                    <DifficultyBadgeNew difficulty="Medium" />
                    <PatternChip label="Dynamic programming" />
                  </div>
                ),
              },
              {
                time: "13:10",
                title: "Priya solves it in 14:22",
                body: (
                  <div className="flex flex-wrap items-center gap-2 text-sm leading-6 text-text-secondary">
                    <span className="font-mono tnum">14:22</span>
                    <VerifiedBadge />
                  </div>
                ),
              },
              {
                time: "13:12",
                title: "Rahul challenges you",
                body: (
                  <p className="text-sm leading-6 text-text-secondary">
                    Word Ladder · beat <span className="font-mono tnum">19:47</span>
                  </p>
                ),
              },
              {
                time: "21:30",
                title: "You solve it in 16:05",
                body: (
                  <div className="flex flex-wrap items-center gap-2 text-sm leading-6 text-text-secondary">
                    <span className="font-mono tnum">16:05</span>
                    <VerifiedBadge />
                  </div>
                ),
              },
              {
                time: "21:34",
                title: "You explain your approach in two sentences",
                body: (
                  <p className="rounded-xl border border-hairline bg-surface px-4 py-3 text-sm leading-6 text-text-secondary">
                    “Order of the loops is the whole problem — outer coins, inner amounts.”
                  </p>
                ),
              },
              {
                time: "21:40",
                title: "You compare with your squad",
                body: (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-hairline bg-surface px-4 py-3">
                      <p className="text-sm font-medium">You</p>
                      <p className="font-mono text-sm text-text-secondary tnum">16:05</p>
                    </div>
                    <div className="rounded-xl border border-hairline bg-surface px-4 py-3">
                      <p className="text-sm font-medium">Priya</p>
                      <p className="font-mono text-sm text-text-secondary tnum">14:22</p>
                    </div>
                  </div>
                ),
              },
            ].map((m) => (
              <li key={m.time} className="flex gap-4">
                <span className="w-12 shrink-0 pt-0.5 font-mono text-xs text-text-tertiary tnum">
                  {m.time}
                </span>
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-sm font-medium">{m.title}</p>
                  {m.body}
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Stage 4: things you'll want to screenshot */}
        <section aria-label="Shareable passes" className="py-16 md:py-20">
          <h2 className="mx-auto max-w-reading font-display text-3xl font-semibold tracking-tight">
            Proof you&apos;ll actually want to share.
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <figure className={`${fanCls} -rotate-2`}>
              <Pass
                body={
                  <div className="space-y-2.5">
                    <p className="text-sm font-medium">Coin Change II</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <DifficultyBadgeNew difficulty="Medium" />
                      <PatternChip label="Dynamic programming" />
                      <span className="font-mono text-xs text-text-tertiary tnum">No. 518</span>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <AvatarStack
                        people={[{ name: "Priya" }, { name: "Rahul" }, { name: "Sneha" }]}
                      />
                      <p className="text-xs leading-5 text-text-secondary">
                        3 of your squad solved it · fastest 14:22 by @priya
                      </p>
                    </div>
                    <span className={secondaryBtn}>Start battle</span>
                  </div>
                }
                stub={
                  <>
                    <PassSerial>No. 518</PassSerial>
                    <PassSerial>12 Oct 2026</PassSerial>
                    <PassSerial>Kshatriya</PassSerial>
                    <PassSerial>3 of 5 solved</PassSerial>
                  </>
                }
              />
              <figcaption className="mt-2 text-center text-xs text-text-tertiary">
                Today&apos;s Battle Pass · Example
              </figcaption>
            </figure>

            <figure className={`${fanCls} rotate-2`}>
              <Pass
                body={
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Coin Change II</p>
                    <p className="font-mono text-5xl font-medium tracking-tight tnum">15:06</p>
                    <p className="text-sm leading-6 text-text-secondary">
                      <span className="line-through">23:40</span>
                      {" → 15:06 · 8m 34s faster"}
                    </p>
                    <VerifiedBadge />
                  </div>
                }
                stub={
                  <>
                    <PassSerial>@prem</PassSerial>
                    <PassSerial>10 Oct 2026</PassSerial>
                    <PassSerial>No. 3</PassSerial>
                    <PassSerial>Verified</PassSerial>
                  </>
                }
              />
              <figcaption className="mt-2 text-center text-xs text-text-tertiary">
                Verified Proof card · Example
              </figcaption>
            </figure>

            <figure className={`${fanCls} rotate-1`}>
              <Pass
                body={
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <StreakChip count={14} alive />
                      <p className="font-display text-5xl font-semibold tnum">14 days</p>
                    </div>
                    <p className="text-sm leading-6 text-text-secondary">Kshatriya · since 28 Sep</p>
                  </div>
                }
                stub={
                  <>
                    <PassSerial>Kshatriya</PassSerial>
                    <PassSerial>Since 28 Sep</PassSerial>
                    <PassSerial>5 members</PassSerial>
                  </>
                }
              />
              <figcaption className="mt-2 text-center text-xs text-text-tertiary">
                Squad Streak card · Example
              </figcaption>
            </figure>

            <figure className={`${fanCls} -rotate-1`}>
              <Pass
                body={
                  <div className="space-y-2">
                    <p className="font-display text-2xl font-semibold tracking-tight">
                      Rahul challenged you
                    </p>
                    <p className="text-sm font-medium">Word Ladder</p>
                    <p className="font-mono text-5xl font-medium tracking-tight tnum">Beat 38:11</p>
                    <p className="text-sm leading-6 text-text-secondary">
                      “Took me two tries. Think hard about the visited set.”
                    </p>
                    <span className={secondaryBtn}>Accept challenge</span>
                  </div>
                }
                stub={
                  <>
                    <PassSerial>From @rahul</PassSerial>
                    <PassSerial>To @prem</PassSerial>
                    <PassSerial>Due 18 Oct</PassSerial>
                    <PassSerial>Open</PassSerial>
                  </>
                }
              />
              <figcaption className="mt-2 text-center text-xs text-text-tertiary">
                1v1 Challenge Pass · Example
              </figcaption>
            </figure>
          </div>
        </section>

        {/* Stage 5: what it isn't */}
        <section aria-label="What it isn't" className="mx-auto max-w-reading">
          <h2 className="font-display text-3xl font-semibold tracking-tight">What it isn&apos;t.</h2>
          <ul className="mt-4 space-y-1.5 text-base leading-7 text-text-secondary">
            <li>No XP, coins, or levels.</li>
            <li>No wagers.</li>
            <li>No countdowns built to rush you.</li>
            <li>No AI that hands you the code.</li>
            <li>No LeetCode account required.</li>
          </ul>
        </section>

        {/* Stage 6: the close */}
        <section aria-label="Start" className="mx-auto max-w-[640px] py-16 md:py-20">
          <Pass
            body={
              <div className="space-y-3">
                <h2 className="font-display text-3xl font-semibold tracking-tight">
                  Your first battle takes two minutes.
                </h2>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Link href="/login?mode=signup" className={`${primaryLg} h-12 px-6`}>
                    Start solo
                  </Link>
                  <Link href="/login?mode=signup" className={ghostBtn}>
                    Join with a code
                  </Link>
                </div>
              </div>
            }
            stub={
              <>
                <PassSerial>No. 001</PassSerial>
                <PassSerial>Your first battle</PassSerial>
              </>
            }
          />
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline py-6 text-xs leading-5 text-text-tertiary">
          <span className="font-display text-sm font-semibold text-text-secondary">Mahayuddh</span>
          <div className="flex items-center gap-1">
            <Link href="/primers" className="inline-flex min-h-[44px] items-center rounded-md px-2 hover:text-text-primary">
              Primers
            </Link>
            <Link href="/login" className="inline-flex min-h-[44px] items-center rounded-md px-2 hover:text-text-primary">
              Sign in
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
