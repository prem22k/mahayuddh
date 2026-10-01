"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Sparkles, Check, Link2 } from "lucide-react";
import { PageLoader } from "@/components/ui/PageLoader";
import { getRecaps, generateRecap, currentWeek } from "@/lib/data/recap";
import { getSquadDetail } from "@/lib/data/squads";
import { dataErrorMessage } from "@/lib/data/errors";
import { copyText } from "@/lib/clipboard";
import { track } from "@/lib/analytics";
import { recapShareText } from "@/lib/recap";
import type { SquadRecap } from "@/types/database";

/**
 * Weekly recaps (Step 20, Bible §31/§32).
 *
 * A recap is a frozen projection of one week. The page always says which week
 * it covers, so a shared recap can never be misread as "this is happening
 * now". An empty week gets honest copy and a next action, not zeroes.
 */
export default function SquadRecapsPage() {
  const params = useParams<{ id: string }>();
  const squadId = params.id ?? "";

  const [recaps, setRecaps] = useState<SquadRecap[]>([]);
  const [squadName, setSquadName] = useState("Squad");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [rows, detail] = await Promise.all([getRecaps(squadId), getSquadDetail(squadId)]);
      setRecaps(rows);
      setSquadName(detail.squad.name);
    } catch (err) {
      setLoadError(dataErrorMessage(err, "Couldn't load recaps. Retry."));
    } finally {
      setLoading(false);
    }
  }, [squadId]);

  useEffect(() => {
    load();
  }, [load]);

  const generate = async () => {
    setGenerating(true);
    setNotice(null);
    try {
      const body = await generateRecap(squadId, squadName);
      setNotice(
        body.solves === 0
          ? "Generated. It is a quiet week — the recap says so rather than padding."
          : `Generated: ${body.solves} solves.`
      );
      await load();
    } catch (err) {
      setNotice(dataErrorMessage(err, "Couldn't generate a recap. Try again."));
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <PageLoader label="Loading recaps..." />;

  if (loadError) {
    return (
      <div role="alert" className="p-12 text-center space-y-3">
        <p className="text-xs text-[#ff453a]">{loadError}</p>
        <button onClick={load} className="px-4 py-2 rounded-full bg-[#fa586a] text-white text-xs font-bold cursor-pointer">
          Retry
        </button>
      </div>
    );
  }

  const thisWeek = currentWeek().weekStart;

  return (
    <div className="space-y-6 select-none max-w-3xl">
      <Link href={`/squad`} className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>{squadName}</span>
      </Link>

      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold text-[#bf5af2] tracking-[0.2em] uppercase">
            The week, frozen
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight mt-1">
            Recaps
          </h1>
          <p className="text-xs text-white/40 mt-2 max-w-xl leading-relaxed">
            Generated from what was actually logged. Every recap names the week it covers, so a
            shared one is never mistaken for today.
          </p>
        </div>
        <button
          onClick={generate}
          disabled={generating}
          className="px-4 py-2 rounded-full bg-[#fa586a] hover:bg-[#fa586a]/90 text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5" />
          {generating ? "Generating…" : "Generate this week"}
        </button>
      </header>

      {notice && (
        <p role="status" className="px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/60 text-xs">
          {notice}
        </p>
      )}

      {recaps.length === 0 ? (
        <div className="p-12 text-center space-y-3 rounded-3xl bg-white/[0.02] border border-white/[0.06]">
          <p className="text-sm font-bold text-white">No recaps yet.</p>
          <p className="text-xs text-white/40 max-w-sm mx-auto">
            A recap summarises one week of what your squad logged. Generate one above — even a
            quiet week is worth writing down.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {recaps.map((r) => {
            const body = r.body_json;
            const isThis = r.week_start === thisWeek;
            return (
              <article key={r.id} className="p-6 rounded-3xl bg-gradient-to-br from-white/[0.04] to-transparent border border-white/[0.06] space-y-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-white/35">
                      Week of {body.window?.weekStart ?? r.week_start}
                      {isThis ? " · current week" : ""}
                    </div>
                    <p className="text-sm font-bold text-white mt-1">{body.headline}</p>
                  </div>
                  <button
                    onClick={async () => {
                      const url = `${window.location.origin}/squad/${squadId}/recaps`;
                      if (!(await copyText(recapShareText({ squadName, body, url })))) return;
                      track("share_clicked", { artifact: "recap", week_start: r.week_start });
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-white text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                    title="Copy a share-ready message for WhatsApp or Discord"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-[#30d158]" /> : <Link2 className="w-3.5 h-3.5" />}
                    {copied ? "Copied" : "Share text"}
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { label: "Solves", value: body.solves },
                    { label: "Challenges", value: body.challengesSent },
                    { label: "Answered", value: body.challengesCompleted },
                    { label: "Approaches", value: body.approachesWritten },
                    { label: "Stuck asks", value: body.stuckRequests },
                  ].map((m) => (
                    <div key={m.label} className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-center">
                      <div className="text-xl font-black text-white font-mono">{m.value}</div>
                      <div className="text-[10px] text-white/35 mt-0.5">{m.label}</div>
                    </div>
                  ))}
                </div>

                {body.entries?.length > 0 && (
                  <dl className="space-y-2">
                    {body.entries.map((e: { label: string; detail: string }) => (
                      <div key={e.label} className="grid grid-cols-[110px_1fr] gap-3">
                        <dt className="text-[10px] font-bold uppercase tracking-wider text-white/35 pt-0.5">
                          {e.label}
                        </dt>
                        <dd className="text-xs text-white/70 leading-relaxed">{e.detail}</dd>
                      </div>
                    ))}
                  </dl>
                )}

                {/* Honest about what did not happen — padding a recap would be a
                    lie, and a zero on a chart hides the reason. */}
                {body.empty?.length > 0 && (
                  <div className="pt-2 border-t border-white/[0.06]">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-white/30 mb-1">
                      Did not happen
                    </div>
                    <ul className="space-y-0.5">
                      {body.empty.map((line: string) => (
                        <li key={line} className="text-[11px] text-white/30">
                          · {line}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {body.entries?.length === 0 && body.empty?.length === 0 && (
                  <p className="text-xs text-white/35">Nothing was logged in this window.</p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
