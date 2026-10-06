import Link from "next/link";
import type { Metadata } from "next";

/**
 * Public landing (Step 3, §41 cold start).
 *
 *   "app/(marketing)/page.tsx" or "/welcome" (public): promise 'Practice DSA with
 *    your people…', show Battle Card + squad recap + challenge chain visuals
 *    (static mocks ok), CTA: Start solo / Explore demo squad."
 *
 * Why this exists as its own route rather than living on /login: every share
 * surface in the product — a battle card, a recap, a challenge, a primer, a
 * public profile — sends somebody here. §42 says a share link must show context
 * before it asks for an account, and "here is a login form" is not context. The
 * login page still exists and still converts; this page is what explains the
 * thing first.
 *
 * The three visuals are static on purpose. They are illustrations of the shape of
 * the product, built from the same vocabulary the real components use, and the
 * plan explicitly allows mocks here. Nothing on this page claims to be a real
 * person's data, and the Demo Squad link goes to seeded rows that say they are
 * seeded.
 *
 * Server component, no client JS: this is the first thing a stranger loads and it
 * has nothing to hydrate.
 */

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Mahayuddh — Practice DSA With Your People",
  description:
    "A social practice network for technical interview prep. Battle one problem, see how your squad thinks, challenge each other, and build a history you can return to.",
  openGraph: {
    title: "Mahayuddh — Practice DSA With Your People",
    description:
      "Battle one problem, see how your squad thinks, challenge each other, and build a history you can return to.",
    type: "website",
  },
};

const DEMO_INVITE_CODE = "DEMO2026";

export default function WelcomePage() {
  return (
    <main className="min-h-screen bg-[#000] text-white relative overflow-hidden">
      {/* Aurora backdrop. Same liquid-glow vocabulary as the login page: the hero
          needs something interesting behind the glass, or the glass reads flat. */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[720px] h-[480px] bg-[#fa586a]/12 rounded-full blur-[140px]" />
        <div className="absolute top-40 -left-40 w-[420px] h-[420px] bg-[#5856d6]/10 rounded-full blur-[120px]" />
        <div className="absolute top-64 -right-40 w-[420px] h-[420px] bg-[#ff9f0a]/[0.07] rounded-full blur-[120px]" />
      </div>
      <div className="mx-auto max-w-5xl px-5 py-12 sm:py-16 relative">
        {/* ── Promise + product ──────────────────────────────────────────────
            The old hero was copy alone on flat black — nothing to screenshot.
            The card is the same battle-card vocabulary as the app itself, with
            example data (like the illustrations below), and it is a real link
            to the demo squad rather than a dead mockup. */}
        <header className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div className="text-center lg:text-left space-y-4">
            <p className="text-[11px] text-white/55 tracking-[0.22em] uppercase font-medium">
              Developer Squad Arena
            </p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight">
              Practice DSA with <span className="text-[#fa586a]">your people.</span>
            </h1>
            <p className="text-sm text-white/55 max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Most DSA apps help you practise alone. This one keeps track of who you
              practise <em>with</em> — so the thinking is shared, not just the answer.
            </p>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 pt-3">
              <Link
                href="/login?mode=signup"
                className="rounded-full btn-accent px-6 py-2.5 min-h-11 text-sm font-bold text-white transition-colors inline-flex items-center"
              >
                Start solo
              </Link>
              <Link
                href={`/squad/join/${DEMO_INVITE_CODE}`}
                className="rounded-full border border-white/15 px-6 py-2.5 min-h-11 text-sm font-bold text-white/80 hover:border-white/35 hover:text-white transition-colors inline-flex items-center"
              >
                Explore the demo squad
              </Link>
            </div>
            <p className="text-[11px] text-white/55 pt-1">
              No LeetCode account required. Connect one later if you want the evidence
              badge.
            </p>
          </div>

          {/* Floating battle card. Example data, honestly labelled. */}
          <figure aria-label="Illustration of a daily battle card with example data">
            <Link
              href={`/squad/join/${DEMO_INVITE_CODE}`}
              className="group relative block rounded-3xl p-6 overflow-hidden bg-[#1c1c1e]/70 backdrop-blur-2xl border border-white/[0.1] shadow-[0_24px_80px_rgba(0,0,0,0.6)] transition-transform hover:scale-[1.01]"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#fa586a]/15 via-transparent to-[#5856d6]/15 pointer-events-none" />
              <div className="relative flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#fa586a]">
                  Today&apos;s battle
                </span>
                <span className="px-2 py-0.5 rounded-full bg-black/40 border border-white/10 text-[10px] font-mono font-bold text-white/80">
                  #46
                </span>
              </div>
              <div className="relative mt-4 flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full border border-[#ff9f0a]/40 text-[#ff9f0a] text-[10px] font-bold uppercase tracking-wider">
                  Medium
                </span>
                <span className="text-[11px] text-white/55">Graphs</span>
              </div>
              <p className="relative mt-2 text-2xl font-extrabold text-white tracking-tight">
                Course Schedule
              </p>
              <p className="relative mt-1 text-[11px] text-white/55">
                Why this problem: unsolved in your sheets.
              </p>
              <div className="relative mt-5 flex items-center justify-between border-t border-white/[0.08] pt-4">
                <div className="flex items-center">
                  {["P", "R", "A"].map((ch, i) => (
                    <span
                      key={i}
                      className="w-7 h-7 rounded-full bg-white/[0.06] border border-white/15 flex items-center justify-center font-bold text-[10px] text-white -ml-1.5 first:ml-0"
                    >
                      {ch}
                    </span>
                  ))}
                  <span className="ml-2 text-[10px] text-white/55">3 battling now</span>
                </div>
                <span className="px-4 py-2 rounded-full bg-white text-black text-xs font-bold group-hover:bg-white/90">
                  Start battle
                </span>
              </div>
            </Link>
            <figcaption className="mt-2 text-center text-[10px] text-white/50 font-mono">
              illustration with example data — the real card lives in your Arena
            </figcaption>
          </figure>
        </header>

        {/* ── The loop, in the order it actually happens ─────────────────────── */}
        <section aria-labelledby="loop-h" className="mt-14">
          <h2 id="loop-h" className="text-center text-sm font-bold text-white/70">
            One loop, eight steps
          </h2>
          <p className="text-center text-[11px] text-white/50 mt-1.5">
            Learn → Battle → Prove → Explain → Challenge → Compare → Improve → Return
          </p>

          <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { n: "01", t: "Read a primer", d: "Five minutes on the pattern before you need it." },
              { n: "02", t: "Battle one problem", d: "A timer you can be honest about, and a scratchpad nobody sees." },
              { n: "03", t: "Prove it", d: "Solved, failed, or abandoned — recorded as what actually happened." },
              { n: "04", t: "Explain it", d: "Write what worked. Your approach, in your words." },
              { n: "05", t: "Challenge someone", d: "They get the problem, not your solution." },
              { n: "06", t: "Compare", d: "See how a squad-mate approached it. Differences, not a winner." },
              { n: "07", t: "Improve", d: "Revisit the ones you missed, with the gap named." },
              { n: "08", t: "Return", d: "A real history, not a streak you can fake." },
            ].map((s) => (
              <li
                key={s.n}
                className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4"
              >
                <p className="font-mono text-[10px] text-[#fa586a]">{s.n}</p>
                <p className="text-sm font-bold mt-1.5">{s.t}</p>
                <p className="text-[11px] text-white/55 mt-1 leading-relaxed">{s.d}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Three artefacts, illustrated ─────────────────────────────────── */}
        <section aria-labelledby="art-h" className="mt-14">
          <h2 id="art-h" className="text-center text-sm font-bold text-white/70">
            A solve is an object, not a checkbox
          </h2>
          <p className="text-center text-[11px] text-white/50 mt-1.5">
            Illustrations of the product&apos;s own components, with example data.
          </p>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {/* Battle Card — Step 16 */}
            <figure className="rounded-2xl border border-white/[0.07] bg-[#1c1c1e]/60 p-4">
              <figcaption className="text-[10px] text-white/50 font-mono mb-3">
                battle card
              </figcaption>
              <p className="text-sm font-extrabold">Two Sum</p>
              <p className="text-[11px] text-white/60 mt-0.5">
                Easy · Arrays / Hashing
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-y-2 text-[11px]">
                <dt className="text-white/50">Solved</dt>
                <dd className="font-mono text-white/80">10:40</dd>
                <dt className="text-white/50">Previous best</dt>
                <dd className="font-mono text-white/50 line-through">23:40</dd>
                <dt className="text-white/50">Attempts</dt>
                <dd className="font-mono text-white/80">2</dd>
                <dt className="text-white/50">Revisits</dt>
                <dd className="font-mono text-white/80">1</dd>
                <dt className="text-white/50">Challenged</dt>
                <dd className="font-mono text-white/80">3</dd>
                <dt className="text-white/50">Friends beat it</dt>
                <dd className="font-mono text-white/80">2</dd>
              </dl>
              <p className="mt-3 text-[10px] text-white/25 border-t border-white/[0.06] pt-2">
                self-reported · never claims you understood it
              </p>
            </figure>

            {/* Squad recap — Step 20 */}
            <figure className="rounded-2xl border border-white/[0.07] bg-[#1c1c1e]/60 p-4">
              <figcaption className="text-[10px] text-white/50 font-mono mb-3">
                squad recap
              </figcaption>
              <p className="text-[10px] text-white/50 tracking-wider uppercase">
                week of 2026-09-26
              </p>
              <p className="text-sm font-bold mt-1.5">Demo Squad</p>
              <p className="text-[11px] text-white/50 mt-1.5 leading-relaxed">
                Six solves, one challenge completed, and Two Sum went from 23:40 to
                10:40.
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-y-2 text-[11px]">
                <dt className="text-white/50">Solves</dt>
                <dd className="font-mono text-white/80">6</dd>
                <dt className="text-white/50">Challenges</dt>
                <dd className="font-mono text-white/80">1</dd>
                <dt className="text-white/50">Answered</dt>
                <dd className="font-mono text-white/80">1</dd>
                <dt className="text-white/50">Approaches</dt>
                <dd className="font-mono text-white/80">2</dd>
              </dl>
              <p className="mt-3 text-[10px] text-white/25 border-t border-white/[0.06] pt-2">
                every number counted from the squad&apos;s own rows
              </p>
            </figure>

            {/* Challenge chain — Step 10 / Step 17 */}
            <figure className="rounded-2xl border border-white/[0.07] bg-[#1c1c1e]/60 p-4">
              <figcaption className="text-[10px] text-white/50 font-mono mb-3">
                challenge chain
              </figcaption>
              <p className="text-sm font-extrabold">Word Ladder</p>
              <p className="text-[11px] text-white/60 mt-0.5">Medium · passed along</p>
              <ol className="mt-3 space-y-1.5 text-[11px]">
                {[
                  { who: "Prem", state: "solved 52:00" },
                  { who: "Rahul", state: "solved 38:11" },
                  { who: "Arjun", state: "passed it on" },
                  { who: "Sandeep", state: "active" },
                ].map((c, i, arr) => (
                  <li key={c.who} className="flex items-center gap-2">
                    <span className="font-mono text-white/25">{i + 1}</span>
                    <span className="font-bold text-white/80">{c.who}</span>
                    <span className="text-white/50">→</span>
                    <span
                      className={
                        i === arr.length - 1
                          ? "text-[#30d158]"
                          : "text-white/55"
                      }
                    >
                      {c.state}
                    </span>
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-[10px] text-white/25 border-t border-white/[0.06] pt-2">
                async — no live room, no realtime
              </p>
            </figure>
          </div>
        </section>

        {/* ── What this is not ─────────────────────────────────────────────── */}
        <section aria-labelledby="not-h" className="mt-14">
          <h2 id="not-h" className="text-center text-sm font-bold text-white/70">
            What it is not
          </h2>
          <ul className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[
              "No global leaderboard as the main event",
              "No XP, badges, or casino animation",
              "No private chat and no realtime rooms",
              "No AI that hands you the solution",
              "No score that stands in for skill",
              "No requirement to connect LeetCode",
            ].map((x) => (
              <li
                key={x}
                className="flex items-start gap-2 rounded-xl border border-white/[0.06] bg-white/[0.015] px-3.5 py-2.5"
              >
                <span className="text-[#fa586a]/60 text-[11px] leading-none pt-0.5">
                  ×
                </span>
                <span className="text-[11px] text-white/50 leading-relaxed">{x}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Close ─────────────────────────────────────────────────────────── */}
        <section className="mt-14 text-center space-y-4">
          <p className="text-sm text-white/60">
            First battle in under two minutes. Solo works — a squad makes it better.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/login?mode=signup"
              className="rounded-full btn-accent px-6 py-2.5 text-sm font-bold text-white transition-colors"
            >
              Start solo
            </Link>
            <Link
              href={`/squad/join/${DEMO_INVITE_CODE}`}
              className="rounded-full border border-white/15 px-6 py-2.5 text-sm font-bold text-white/80 hover:border-white/35 hover:text-white transition-all"
            >
              Explore the demo squad
            </Link>
          </div>
          <p className="text-[10px] text-white/20 pt-2">
            The demo squad is seeded example data, labelled as such. Joining it adds
            you as a sixth member.
          </p>
        </section>
      </div>
    </main>
  );
}