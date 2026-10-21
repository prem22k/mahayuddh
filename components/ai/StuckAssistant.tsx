"use client";

import React, { useId, useState } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
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
  const requestId = useId();

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
    <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface-raised p-4">
      <div className="flex flex-col gap-0.5">
        <span className="flex items-center gap-2 text-sm font-semibold leading-5 text-text-primary">
          <Sparkles className="h-4 w-4 text-pattern" strokeWidth={1.5} aria-hidden />
          Stuck assistant
        </span>
        <p className="text-xs leading-4 text-text-secondary">
          Hints only, at the level you choose. It will not answer above it.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <div
          role="group"
          aria-label="Assistant level"
          className="flex flex-wrap items-center gap-1 rounded-md border border-hairline bg-well p-1"
        >
          {allowedLevels.map((l, i) => (
            <button
              key={l}
              type="button"
              aria-pressed={level === l}
              onClick={() => setLevel(l)}
              className={cn(
                "flex min-h-[44px] flex-1 cursor-pointer items-center justify-center whitespace-nowrap rounded-sm border px-3 py-1.5 text-xs font-medium leading-4 transition-colors md:min-h-0",
                level === l
                  ? "border-pattern/40 bg-pattern-tint font-semibold text-pattern"
                  : "border-transparent text-text-secondary hover:bg-surface-raised hover:text-text-primary"
              )}
            >
              {i + 1}. {LEVEL_LABEL[l]}
            </button>
          ))}
        </div>
        {allowedLevels.length < STUCK_LEVELS.length && (
          <span className="px-1 font-mono text-[11px] font-medium text-text-tertiary">
            You asked for {LEVEL_LABEL[requestedLevel].toLowerCase()}. Nothing above it.
          </span>
        )}
      </div>

      <label htmlFor={requestId} className="sr-only">
        What have you tried?
      </label>
      <textarea
        id={requestId}
        value={request}
        onChange={(e) => setRequest(e.target.value)}
        rows={2}
        placeholder="What have you tried? (optional)"
        className="w-full resize-y rounded-lg border border-hairline bg-well p-3 text-sm leading-5 text-text-primary placeholder:text-text-disabled focus:border-hairline-strong focus:outline-none"
      />

      <button
        type="button"
        onClick={() => void ask()}
        disabled={busy}
        className="inline-flex h-9 min-h-[44px] cursor-pointer items-center justify-center gap-2 self-start rounded-md border border-hairline bg-surface-overlay px-4 text-sm font-medium leading-5 text-text-primary transition-colors hover:bg-[#272830] disabled:opacity-50 md:min-h-9"
      >
        {busy && <Spinner size="xs" />}
        Ask for a {LEVEL_LABEL[level].toLowerCase()}
      </button>

      {blocked && (
        <div className="flex flex-col gap-1 rounded-lg border border-hairline bg-well p-3">
          <p className="text-sm leading-5 text-text-secondary">{blocked}</p>
          <p className="text-xs leading-4 text-text-tertiary">
            This is not a placeholder answer. No AI feature here will invent one.
          </p>
        </div>
      )}

      {answer && (
        <div className="flex flex-col gap-1.5 rounded-lg border border-hairline bg-well p-4">
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-pattern">
            {LEVEL_LABEL[answeredLevel ?? level]}
          </span>
          <p className="whitespace-pre-wrap text-[15px] leading-6 text-text-primary">{answer}</p>
          {pulledDown && (
            <p className="text-xs leading-4 text-text-secondary">
              Pulled back to your level — the answer came in above what you asked for.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
