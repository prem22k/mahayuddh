"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { listPrimers } from "@/lib/data/primers";
import { dataErrorMessage } from "@/lib/data/errors";
import { PageLoader } from "@/components/ui/PageLoader";
import { Primer } from "@/types/database";

export function PrimerList() {
  const [primers, setPrimers] = useState<Primer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    listPrimers()
      .then(setPrimers)
      .catch((err) => setLoadError(dataErrorMessage(err, "Couldn't load primers.")))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader label="Loading primers..." className="h-40" />;
  if (loadError) {
    return (
      <div role="alert" className="p-6 text-center space-y-2 rounded-2xl bg-[#ff453a]/10 border border-[#ff453a]/30">
        <p className="text-xs text-[#ff453a]">{loadError}</p>
        <button onClick={() => window.location.reload()} className="px-4 py-1.5 rounded-full bg-[#ff453a]/15 text-[#ff453a] text-xs font-bold cursor-pointer">Retry</button>
      </div>
    );
  }
  if (primers.length === 0) {
    return (
      <div className="p-12 text-center space-y-2 rounded-3xl bg-[#1c1c1e]/60 border border-white/[0.06]">
        <p className="text-sm font-bold text-white">No primers yet.</p>
        <p className="text-xs text-white/40">Start with a roadmap battle instead — primers grow from real squad needs.</p>
        <Link href="/practice" className="inline-block px-4 py-2 rounded-full bg-[#fa586a] text-white text-xs font-bold">Practice</Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {primers.map((p) => (
        <Link key={p.slug} href={`/primers/${p.slug}`}
          className="p-5 rounded-3xl bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.08] hover:border-white/[0.15] transition-all">
          <div className="text-[10px] font-bold text-[#fa586a] uppercase tracking-widest">{p.pattern}</div>
          <div className="text-sm font-bold text-white mt-1">{p.title}</div>
          <div className="text-[11px] text-white/40 mt-1">{p.starter_slugs.length} starter problems · {p.mistakes.length} common mistakes</div>
        </Link>
      ))}
    </div>
  );
}
