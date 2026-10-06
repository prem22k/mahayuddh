"use client";

import React, { useState } from "react";
import { Sparkles } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { LEVEL_LABEL, STUCK_LEVELS } from "@/lib/stuckLadder";
import { track } from "@/lib/analytics";
import type { StuckLevel } from "@/types/database";

/**
 * Stuck assistant (Step 25, Bible §45).
 *
 * The level selector is the contract, and it is not optional: §45's first bad
 * use is "instant full solutions as the primary action", so the safest thing
 * this component can do is make the user choose the level before there is any
 * answer to choose.
 *
 * When AI is off, disabled, rate-limited or unconfigured, this says which of
 * those it is. It never falls back to something that looks like an answer.
 */
export function StuckAssistant({
  squadId,
  problemSlug,
  requestedLevel,
  scratchpad,
}: {
  squadId: string | null;
  problemSlug: string;
  /** The level the asker set on the stuck request. The assistant may not exceed it. */
  requestedLevel: StuckLevel;
  scratchpad?: string | null;
}) {
  const [level, setLevel] = useState<StuckLevel>(requestedLevel);
  const [request, setRequest] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [answeredLevel, setAnsweredLevel] = useState<StuckLevel | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [pulledDown, setPulledDown] = useState(false);
  const [busy, setBusy] = useState(false);

  // The selector can only go DOWN from the level that was asked for. Offering
  // 'full' to somebody who asked for a nudge is the exact drift §45 names.
  const allowedLevels = STUCK_LEVELS.filter(
    (l) => STUCK_LEVELS.indexOf(l) <= STUCK_LEVELS.indexOf(requestedLevel)
  );

  const ask = async () => {
    setBusy(true);
    setBlocked(null);
    setAnswer(null);
    setPulledDown(false);
    try {
      // Through the route, not a direct call: the gate reads the squad's flag
      // and budget server-side, and the ai_calls row is written where a client
      // cannot skip it.
      const res = await fetch("/api/ai/stuck-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          squadId,
          problemSlug,
          requestedLevel: level,
          request,
          scratchpad,
        }),
      });
      const json = await res.json().catch(() => ({}));

      track("ai_assistant_asked", {
        feature: "stuck_assistant",
        level,
        outcome: json.outcome ?? "error",
      });

      if (!res.ok) {
        setBlocked(json.error ?? "That didn't work.");
        return;
      }
      if (!json.allowed) {
        if (json.outcome === "refused") track("ai_feature_refused", { feature: "stuck_assistant", level });
        setBlocked(json.message || "Not available.");
        return;
      }
      setAnswer(json.answer ?? "");
      setAnsweredLevel(json.level ?? level);
      setPulledDown(Boolean(json.pulledDown));
    } catch {
      setBlocked("Couldn't reach the assistant.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-3xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-3.5 h-3.5 text-[#ffd60a]" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">
          Stuck assistant
        </span>
      </div>

      <p className="text-[11px] text-white/55">
        Hints only, at the level you choose. It will not answer above it.
      </p>

      <div className="flex items-center gap-1.5 flex-wrap">
        {allowedLevels.map((l) => (
          <button
            key={l}
            onClick={() => setLevel(l)}
            className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
              level === l
                ? "bg-white/[0.12] text-white"
                : "bg-white/[0.04] text-white/55 hover:text-white/70"
            }`}
          >
            {LEVEL_LABEL[l]}
          </button>
        ))}
        {allowedLevels.length < STUCK_LEVELS.length && (
          <span className="text-[10px] text-white/20">
            you asked for {LEVEL_LABEL[requestedLevel]}
          </span>
        )}
      </div>

      <textarea
        value={request}
        onChange={(e) => setRequest(e.target.value)}
        rows={2}
        placeholder="What have you tried? (optional)"
        className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[11px] text-white placeholder:text-white/20 focus:outline-none focus:border-white/20 resize-y"
      />

      <button
        onClick={() => void ask()}
        disabled={busy}
        className="px-4 py-2 rounded-full bg-white/[0.08] hover:bg-white/[0.12] border border-white/[0.08] text-white text-[11px] font-bold transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
      >
        {busy && <Spinner size="xs" />}
        Ask for a {LEVEL_LABEL[level].toLowerCase()}
      </button>

      {blocked && (
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-3 space-y-1">
          <p className="text-[11px] text-white/50">{blocked}</p>
          <p className="text-[10px] text-white/50">
            This is not a placeholder answer. No AI feature here will invent one.
          </p>
        </div>
      )}

      {answer && (
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-3 space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-white/25">
            {LEVEL_LABEL[answeredLevel ?? level]}
          </div>
          <p className="text-xs text-white/70 whitespace-pre-wrap">{answer}</p>
          {pulledDown && (
            <p className="text-[10px] text-[#ffd60a]/70">
              Pulled back to your level — the answer came in above what you asked for.
            </p>
          )}
        </div>
      )}
    </div>
  );
}