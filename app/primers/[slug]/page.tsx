"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Play, ArrowLeft, Copy, Check } from "lucide-react";
import { useSolving } from "@/components/providers/SolvingProvider";
import { PageLoader } from "@/components/ui/PageLoader";
import { getPrimer } from "@/lib/data/primers";
import { getCatalogBySlugs } from "@/lib/data/problems";
import { copyPrimerToNotebook } from "@/lib/data/notebook";
import { track } from "@/lib/analytics";
import { Primer, Problem } from "@/types/database";

function prettify(slug: string): string {
  return slug.split("-").map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(" ");
}

export default function PrimerPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug || "";
  const { startSolving } = useSolving();
  const [primer, setPrimer] = useState<Primer | null>(null);
  const [starters, setStarters] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  useEffect(() => {
    getPrimer(slug)
      .then(async (p) => {
        if (!p) {
          setNotFound(true);
          return;
        }
        setPrimer(p);
        track("primer_read", { primer_slug: slug });
        const catalog = await getCatalogBySlugs(p.starter_slugs).catch(() => []);
        const bySlug = new Map(catalog.map((c) => [c.title_slug, c]));
        setStarters(
          p.starter_slugs.map(
            (s) =>
              bySlug.get(s) ?? {
                title_slug: s,
                title: prettify(s),
                difficulty: "Medium",
                question_id: s,
                paid_only: false,
                topics: [p.pattern],
                updated_at: new Date().toISOString(),
              }
          )
        );
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <PageLoader label="Loading primer..." />;
  if (notFound || !primer) {
    return (
      <div className="p-12 text-center space-y-3">
        <p className="text-sm font-bold text-white">Primer not found.</p>
        <Link href="/primers" className="inline-block px-4 py-2 rounded-full bg-[#fa586a] text-white text-xs font-bold">All primers</Link>
      </div>
    );
  }

  const first = starters[0];

  return (
    <div className="space-y-6 select-none max-w-2xl">
      <Link href="/primers" className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>All primers</span>
      </Link>

      <div>
        <div className="text-[11px] font-bold text-[#fa586a] uppercase tracking-widest">Before solving · {primer.pattern}</div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight mt-1">{primer.title}</h1>
        <p className="text-[11px] text-white/40 mt-1">5–10 minutes. Then go use it immediately.</p>
      </div>

      <section className="p-5 rounded-3xl bg-white/[0.03] border border-white/[0.08] space-y-2">
        <h2 className="text-sm font-bold text-white">Recognize it when</h2>
        <ul className="space-y-1.5">
          {primer.recognize_when.map((r, i) => (
            <li key={i} className="text-xs text-white/70 flex gap-2"><span className="text-[#fa586a] font-bold">{i + 1}.</span><span>{r}</span></li>
          ))}
        </ul>
      </section>

      {primer.mental_model && (
        <section className="p-5 rounded-3xl bg-black/40 border border-white/[0.08] space-y-2">
          <h2 className="text-sm font-bold text-white">Mental model</h2>
          <pre className="text-[11px] text-white/60 font-mono whitespace-pre-wrap">{primer.mental_model}</pre>
        </section>
      )}

      {primer.template_md && (
        <section className="p-5 rounded-3xl bg-white/[0.03] border border-white/[0.08] space-y-2">
          <h2 className="text-sm font-bold text-white">Template</h2>
          <p className="text-xs text-white/70 leading-relaxed">{primer.template_md}</p>
        </section>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {primer.complexity && (
          <section className="p-5 rounded-3xl bg-white/[0.02] border border-white/[0.06]">
            <h2 className="text-xs font-bold text-white mb-1">Complexity</h2>
            <p className="text-[11px] text-white/60 font-mono">{primer.complexity}</p>
          </section>
        )}
        {primer.mistakes.length > 0 && (
          <section className="p-5 rounded-3xl bg-white/[0.02] border border-white/[0.06]">
            <h2 className="text-xs font-bold text-white mb-1">Common mistakes</h2>
            <ul className="space-y-1">
              {primer.mistakes.map((m, i) => (
                <li key={i} className="text-[11px] text-white/60">· {m}</li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <section className="p-5 rounded-3xl bg-[#fa586a]/[0.06] border border-[#fa586a]/25 space-y-3">
        <h2 className="text-sm font-bold text-white">Starter problems</h2>
        <div className="space-y-2">
          {starters.map((s) => (
            <div key={s.title_slug} className="flex items-center justify-between gap-2">
              <Link href={`/practice/${s.title_slug}`} className="text-xs font-semibold text-white hover:text-[#fa586a] transition-colors">
                {s.title} <span className="text-white/30 font-normal">· {s.difficulty}</span>
              </Link>
            </div>
          ))}
        </div>
        {first && (
          <button
            onClick={() =>
              startSolving({ id: first.question_id || first.title_slug, title: first.title, slug: first.title_slug, difficulty: first.difficulty, category: primer.pattern })
            }
            className="w-full py-3 rounded-full bg-[#fa586a] hover:bg-[#fa586a]/90 text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>START PROBLEMS</span>
          </button>
        )}
        <button
          onClick={async () => {
            try {
              await copyPrimerToNotebook(primer.slug);
              setCopied(true);
              setCopyMsg("Copied to your notebook.");
              setTimeout(() => setCopied(false), 2000);
            } catch {
              setCopyMsg("Log in to copy this primer.");
            }
          }}
          className="w-full py-2.5 rounded-full bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] text-white/80 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-[#30d158]" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copyMsg ?? "Copy to my notebook"}</span>
        </button>
      </section>
    </div>
  );
}
