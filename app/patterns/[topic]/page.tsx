"use client";

import { decodePathSegment } from "@/lib/pathSegment";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Play, ArrowLeft } from "lucide-react";
import { useSolving } from "@/components/providers/SolvingProvider";
import { PageLoader } from "@/components/ui/PageLoader";
import { getPrimersForPatterns } from "@/lib/data/primers";
import { getCatalogByTopic } from "@/lib/data/problems";
import { getApproachesForSlugs } from "@/lib/data/approaches";
import { getSharedResources } from "@/lib/data/vault";
import { getStuckRequestsForPattern } from "@/lib/data/stuck";
import { TeacherList } from "@/components/profile/TeacherList";
import { dataErrorMessage } from "@/lib/data/errors";
import { Primer, Problem, Approach, SharedResource, StuckRequest } from "@/types/database";

// Pattern hub (Bible §17): primer + starters + community approaches +
// mistakes + vault picks + teachers. All projections over existing tables.
export default function PatternPage() {
  const params = useParams<{ topic: string }>();
  const topic = decodePathSegment(params.topic);
  const { startSolving } = useSolving();

  const [primer, setPrimer] = useState<Primer | null>(null);
  const [starters, setStarters] = useState<Problem[]>([]);
  const [approaches, setApproaches] = useState<Approach[]>([]);
  const [asks, setAsks] = useState<StuckRequest[]>([]);
  const [vaultPicks, setVaultPicks] = useState<SharedResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!topic) return;
    Promise.all([
      getPrimersForPatterns([topic]).catch(() => []),
      getCatalogByTopic(topic, 30).catch(() => []),
      getSharedResources().catch(() => []),
    ])
      .then(async ([primers, catalog, vault]) => {
        const p = primers[0] ?? null;
        setPrimer(p);
        const starterSlugs = p?.starter_slugs?.length ? p.starter_slugs : catalog.slice(0, 3).map((c) => c.title_slug);
        const bySlug = new Map(catalog.map((c) => [c.title_slug, c]));
        setStarters(
          starterSlugs.slice(0, 6).map(
            (s) =>
              bySlug.get(s) ?? {
                title_slug: s,
                title: s.split("-").map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(" "),
                difficulty: "Medium",
                question_id: s,
                paid_only: false,
                topics: [topic],
                updated_at: new Date().toISOString(),
              }
          )
        );
        const pool = Array.from(new Set([...starterSlugs, ...catalog.slice(0, 30).map((c) => c.title_slug)]));
        setApproaches(await getApproachesForSlugs(pool, 10).catch(() => []));
        const t = topic.toLowerCase();

        // §17's seventh hub section: open "I'm stuck" asks on this pattern's
        // problems. Fetched with everything else and never allowed to fail the
        // page — a missing section is not worth losing the five that work.
        // `pool` is already a de-duplicated array of slugs.
        getStuckRequestsForPattern(pool.slice(0, 40))
          .then(setAsks)
          .catch(() => setAsks([]));

        setVaultPicks(
          vault.filter(
            (r) => r.title.toLowerCase().includes(t) || r.content.toLowerCase().includes(t)
          ).slice(0, 3)
        );
      })
      .catch((err) => setLoadError(dataErrorMessage(err, "Couldn't load this pattern hub.")))
      .finally(() => setLoading(false));
  }, [topic]);

  if (loading) return <PageLoader label="Loading pattern..." />;
  if (loadError) {
    return (
      <div role="alert" className="p-12 text-center space-y-3">
        <p className="text-xs text-[#ff453a]">{loadError}</p>
        <Link href="/practice" className="inline-block px-4 py-2 rounded-full btn-accent text-white text-xs font-bold">Practice</Link>
      </div>
    );
  }

  const mistakes = Array.from(
    new Set(approaches.map((a) => a.mistakes).filter(Boolean) as string[])
  ).slice(0, 5);
  const teachers = new Map<string, number>();
  for (const a of approaches) {
    const name = a.author?.username || "squad";
    teachers.set(name, (teachers.get(name) ?? 0) + 1);
  }
  const topTeachers = Array.from(teachers.entries()).sort((x, y) => y[1] - x[1]).slice(0, 5);

  return (
    <div className="space-y-6 select-none max-w-2xl">
      <Link href="/practice" className="flex items-center gap-1.5 text-xs text-white/55 hover:text-white transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Practice</span>
      </Link>

      <div>
        <div className="text-[11px] font-bold text-[#fa586a] uppercase tracking-widest">Pattern hub</div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight mt-1">{topic}</h1>
      </div>

      {primer && (
        <Link href={`/primers/${primer.slug}`}
          className="block p-5 rounded-3xl bg-[#0a84ff]/[0.06] hover:bg-[#0a84ff]/[0.1] border border-[#0a84ff]/25 transition-all">
          <div className="text-[10px] font-bold text-[#0a84ff] uppercase tracking-widest">Primer · before solving</div>
          <div className="text-sm font-bold text-white mt-1">{primer.title} →</div>
        </Link>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-white">Starter problems</h2>
        {starters.length === 0 ? (
          <p className="text-xs text-white/50">No starters indexed for this pattern yet.</p>
        ) : (
          starters.map((s) => (
            <div key={s.title_slug} className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
              <Link href={`/practice/${s.title_slug}`} className="text-xs font-bold text-white hover:text-[#fa586a] transition-colors truncate">
                {s.title} <span className="text-white/50 font-normal">· {s.difficulty}</span>
              </Link>
              <button
                onClick={() => startSolving({ id: s.question_id || s.title_slug, title: s.title, slug: s.title_slug, difficulty: s.difficulty, category: topic })}
                className="p-1.5 rounded-full bg-white text-black hover:bg-white/90 transition-all cursor-pointer shrink-0" title={`Battle ${s.title}`}>
                <Play className="w-3 h-3 fill-current" />
              </button>
            </div>
          ))
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-white">
          People who teach it <span className="text-white/50 font-normal text-[11px]">· §22</span>
        </h2>
        <TeacherList pattern={topic} />
      </section>

      {approaches.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-white">Community approaches <span className="text-white/50 font-normal text-[11px]">· after solving</span></h2>
          {approaches.slice(0, 5).map((a) => (
            <Link key={a.id} href={`/practice/${a.problem_slug}`}
              className="block p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] transition-all">
              <div className="text-[11px] text-white/55 font-mono">{a.problem_slug} · @{a.author?.username || "squad"}</div>
              <p className="text-xs text-white/70 mt-1 line-clamp-2">{a.core_idea}</p>
            </Link>
          ))}
        </section>
      )}

      {(mistakes.length > 0 || vaultPicks.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {mistakes.length > 0 && (
            <section className="p-5 rounded-3xl bg-white/[0.02] border border-white/[0.06]">
              <h2 className="text-xs font-bold text-white mb-1">Common mistakes</h2>
              <ul className="space-y-1">
                {mistakes.map((m, i) => (
                  <li key={i} className="text-[11px] text-white/60">· {m}</li>
                ))}
              </ul>
            </section>
          )}
          {vaultPicks.length > 0 && (
            <section className="p-5 rounded-3xl bg-white/[0.02] border border-white/[0.06]">
              <h2 className="text-xs font-bold text-white mb-1">From the vault</h2>
              <ul className="space-y-1">
                {vaultPicks.map((r) => (
                  <li key={r.id}>
                    <Link href="/notebook" className="text-[11px] text-white/60 hover:text-white transition-colors">{r.title}</Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {topTeachers.length > 0 && (
        <section className="p-5 rounded-3xl bg-white/[0.02] border border-white/[0.06]">
          <h2 className="text-xs font-bold text-white mb-1">People who teach it <span className="text-white/50 font-normal">· by shared approaches, not followers</span></h2>
          <div className="flex items-center gap-2 flex-wrap mt-2">
            {topTeachers.map(([name, n]) => (
              <span key={name} className="px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-[11px] text-white/70 font-mono">
                @{name} × {n}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* ── Stuck asks on this pattern (§17) ──
          The section that joins the hub to the ladder. A primer says how a pattern
          works; this says where your squad is actually losing time on it, which is
          a different reason to read it.

          Shows the asker, the problem and the level they asked for — and NOT their
          scratchpad. They chose a level; honouring that means the hub does not
          publish what they wrote. */}
      <section className="mt-8">
        <h2 className="text-xs font-bold text-white mb-1">
          Where your squad is stuck{" "}
          <span className="text-white/50 font-normal text-[11px]">
            · open asks, at the level they asked for
          </span>
        </h2>
        {asks.length === 0 ? (
          <p className="text-[11px] text-white/35">
            Nobody is stuck on this pattern right now. That is not a reason to skip it.
          </p>
        ) : (
          <ul className="space-y-2">
            {asks.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/stuck#${a.id}`}
                  className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:border-[#fa586a]/30 transition-colors"
                >
                  <span className="font-mono text-[11px] text-white/50">
                    @{a.author?.username ?? "someone"}
                  </span>
                  <span className="text-[11px] text-white/70">
                    on {a.problem_slug.replace(/-/g, " ")}
                  </span>
                  <span className="px-2 py-0.5 rounded-full border border-white/[0.08] text-[10px] text-white/50 uppercase tracking-wide">
                    wants {a.level}
                  </span>
                  <span className="text-[10px] text-white/25 ml-auto">
                    help at that level, not above it
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
