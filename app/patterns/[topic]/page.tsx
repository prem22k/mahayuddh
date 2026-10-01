"use client";

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
import { dataErrorMessage } from "@/lib/data/errors";
import { Primer, Problem, Approach, SharedResource } from "@/types/database";

// Pattern hub (Bible §17): primer + starters + community approaches +
// mistakes + vault picks + teachers. All projections over existing tables.
export default function PatternPage() {
  const params = useParams<{ topic: string }>();
  const topic = decodeURIComponent(params.topic || "");
  const { startSolving } = useSolving();

  const [primer, setPrimer] = useState<Primer | null>(null);
  const [starters, setStarters] = useState<Problem[]>([]);
  const [approaches, setApproaches] = useState<Approach[]>([]);
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
        <Link href="/practice" className="inline-block px-4 py-2 rounded-full bg-[#fa586a] text-white text-xs font-bold">Practice</Link>
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
      <Link href="/practice" className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white transition-colors">
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
          <p className="text-xs text-white/30">No starters indexed for this pattern yet.</p>
        ) : (
          starters.map((s) => (
            <div key={s.title_slug} className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
              <Link href={`/practice/${s.title_slug}`} className="text-xs font-bold text-white hover:text-[#fa586a] transition-colors truncate">
                {s.title} <span className="text-white/30 font-normal">· {s.difficulty}</span>
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

      {approaches.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-white">Community approaches <span className="text-white/30 font-normal text-[11px]">· after solving</span></h2>
          {approaches.slice(0, 5).map((a) => (
            <Link key={a.id} href={`/practice/${a.problem_slug}`}
              className="block p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] transition-all">
              <div className="text-[11px] text-white/40 font-mono">{a.problem_slug} · @{a.author?.username || "squad"}</div>
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
          <h2 className="text-xs font-bold text-white mb-1">People who teach it <span className="text-white/30 font-normal">· by shared approaches, not followers</span></h2>
          <div className="flex items-center gap-2 flex-wrap mt-2">
            {topTeachers.map(([name, n]) => (
              <span key={name} className="px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-[11px] text-white/70 font-mono">
                @{name} × {n}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
