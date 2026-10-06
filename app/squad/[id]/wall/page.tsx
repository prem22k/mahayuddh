"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageLoader } from "@/components/ui/PageLoader";
import { getWall } from "@/lib/data/wall";
import { dataErrorMessage } from "@/lib/data/errors";
import { relativeDays } from "@/lib/format";
import type { SquadMilestone } from "@/types/database";

/**
 * Squad wall (Step 20, Bible §32).
 *
 * A vertical milestone timeline, not a trophy case. Entries are written by
 * database triggers on the events that earn them, so the wall cannot be edited
 * into looking better than it was.
 */
export default function SquadWallPage() {
  const params = useParams<{ id: string }>();
  const squadId = params.id ?? "";

  const [items, setItems] = useState<SquadMilestone[]>([]);
  const [squadName, setSquadName] = useState("Squad");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { milestones, name } = await getWall(squadId);
      setItems(milestones);
      setSquadName(name);
    } catch (err) {
      setLoadError(dataErrorMessage(err, "Couldn't load the wall. Retry."));
    } finally {
      setLoading(false);
    }
  }, [squadId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <PageLoader label="Loading the wall..." />;

  if (loadError) {
    return (
      <div role="alert" className="p-12 text-center space-y-3">
        <p className="text-xs text-[#ff453a]">{loadError}</p>
        <button onClick={load} className="px-4 py-2 rounded-full btn-accent text-white text-xs font-bold cursor-pointer">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 select-none max-w-2xl">
      <Link href="/squad" className="flex items-center gap-1.5 text-xs text-white/55 hover:text-white transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>{squadName}</span>
      </Link>

      <header>
        <div className="text-[11px] font-bold text-[#30d158] tracking-[0.2em] uppercase">
          What actually happened
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight mt-1">
          Wall
        </h1>
        <p className="text-xs text-white/55 mt-2 max-w-xl leading-relaxed">
          Milestones are written by the database when the event happens, so nothing here can be
          back-dated into looking better than it was.
        </p>
      </header>

      {items.length === 0 ? (
        <div className="p-12 text-center space-y-3 rounded-3xl bg-white/[0.02] border border-white/[0.06]">
          <p className="text-sm font-bold text-white">Nothing on the wall yet.</p>
          <p className="text-xs text-white/55 max-w-sm mx-auto">
            The first entry appears when somebody joins, solves, or challenges a squad mate.
          </p>
          <Link href="/practice" className="inline-block px-4 py-2 rounded-full bg-white/[0.06] border border-white/[0.1] text-white text-xs font-bold">
            Start a battle
          </Link>
        </div>
      ) : (
        <ol className="relative border-l border-white/[0.08] pl-6 space-y-6">
          {items.map((m) => (
            <li key={m.id} className="relative">
              <span
                aria-hidden
                className="absolute -left-[31px] top-1 w-3 h-3 rounded-full bg-white/20 border-2 border-[#0a0a0a]"
              />
              <div className="text-sm font-bold text-white">{m.title}</div>
              {m.detail && <p className="text-xs text-white/50 mt-0.5 leading-relaxed">{m.detail}</p>}
              <div className="text-[10px] text-white/25 font-mono mt-1">
                {relativeDays(daysBetweenFor(m.occurred_at))}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function daysBetweenFor(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 86_400_000));
}
