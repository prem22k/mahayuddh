"use client";

import React, { useState } from "react";
import { Sparkles } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { track } from "@/lib/analytics";

/**
 * The three §45 features that are not ladder hints (Step 25 #2, #4, #5).
 *
 * One component for all three, because they behave identically from the outside:
 * one piece of the member's own writing goes in, one short answer comes out, and
 * every refusal is reported rather than hidden. Three near-identical components
 * would drift, and the drift would show up as one of them quietly rendering an
 * empty box where another shows a reason.
 *
 * The things they must never do, and where each is enforced:
 *
 *   - give code            stripped server-side (lib/ai/bounded.ts)
 *   - rewrite their work   in the instruction (§45)
 *   - pretend to have answered when refused
 *                          the outcome is rendered as a sentence, never as a gap
 *   - become a chat        interview-sim refuses a second question by name
 *
 * There is no streaming and no retry button. A retry would let somebody hammer a
 * rate-limited provider from a UI, and the budget exists precisely to stop that.
 */

export type BoundedFeature = "explain-mistake" | "explain-back" | "interview-sim";

/** Feature -> its analytics event. Built here rather than by string surgery, so a
 *  typo cannot produce an event name the ANALYTICS_EVENTS union rejects. */
const ANSWERED_EVENT = {
  "explain-mistake": "explain_mistake_answered",
  "explain-back": "explain_back_answered",
  "interview-sim": "interview_sim_answered",
} as const;

/** Route path, and the label to show. Kept next to each other so they cannot drift. */
const ENDPOINTS: Record<BoundedFeature, string> = {
  "explain-mistake": "/api/ai/explain-mistake",
  "explain-back": "/api/ai/explain-back",
  "interview-sim": "/api/ai/interview-sim",
};

const COPY: Record<
  BoundedFeature,
  { title: string; blurb: string; cta: string; inputLabel: string; placeholder: string }
> = {
  "explain-mistake": {
    title: "What did I miss?",
    blurb:
      "Points at the concept your write-up skipped. It does not show you the fix — that is the part you still have to do.",
    cta: "Find the gap",
    inputLabel: "Your scratchpad",
    placeholder: "What you tried, where you got stuck…",
  },
  "explain-back": {
    title: "Explain it back",
    blurb:
      "Say the approach out loud. This responds to your reasoning — what held up, and the one assumption you did not state.",
    cta: "Check my reasoning",
    inputLabel: "Your explanation",
    placeholder: "In your own words, as if explaining to someone else…",
  },
  "interview-sim": {
    title: "Interview follow-up",
    blurb: "One question about the weakest part of your approach, the way an interviewer would ask it.",
    cta: "Ask me one",
    inputLabel: "Your approach",
    placeholder: "How you would solve it…",
  },
};

export function BoundedAssistant({
  feature,
  squadId,
  problemSlug,
  problemTitle,
  input,
  onRequest,
}: {
  feature: BoundedFeature;
  squadId: string | null;
  problemSlug?: string | null;
  problemTitle?: string | null;
  /** Seed value, e.g. the battle's scratchpad. */
  input?: string | null;
  /** Provided when this component owns its own textarea. */
  onRequest?: (input: string) => Promise<void> | void;
}) {
  const copy = COPY[feature];
  const [text, setText] = useState(input ?? "");
  const [answer, setAnswer] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [stripped, setStripped] = useState(false);
  const [busy, setBusy] = useState(false);
  /** interview-sim only: a second question is refused, and saying so is the point. */
  const [asked, setAsked] = useState(false);

  const disabled = busy || text.trim().length < 20;

  const ask = async () => {
    if (disabled) return;
    setBusy(true);
    setRefusal(null);
    setAnswer(null);
    setStripped(false);
    try {
      const body: Record<string, unknown> = { squadId, problemSlug, problemTitle };
      if (feature === "explain-mistake") body.scratchpad = text;
      if (feature === "explain-back") body.explanation = text;
      if (feature === "interview-sim") {
        body.approach = text;
        body.firstQuestion = !asked;
      }

      const res = await fetch(ENDPOINTS[feature], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as {
        allowed?: boolean;
        outcome?: string;
        message?: string;
        text?: string | null;
        stripped?: boolean;
        error?: string;
      };

      if (res.status === 401) {
        setRefusal("Sign in to use this.");
        return;
      }
      if (!json.allowed) {
        setRefusal(json.message ?? "That did not work.");
        track("ai_refused", { feature, outcome: json.outcome ?? "unknown" });
        return;
      }

      setAnswer(json.text ?? null);
      setStripped(Boolean(json.stripped));
      setAsked(true);
      track(ANSWERED_EVENT[feature], { feature, source: "component" });
      onRequest?.(text);
    } catch {
      setRefusal("Could not reach the server. Retry in a moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-label={copy.title}
      className="rounded-2xl border border-white/[0.07] bg-[#1c1c1e]/50 p-4 space-y-3"
    >
      <header className="space-y-1.5">
        <p className="flex items-center gap-1.5 text-sm font-bold">
          <Sparkles className="h-3.5 w-3.5 text-[#fa586a]" aria-hidden />
          {copy.title}
          <span className="text-[10px] font-normal text-white/25">§45</span>
        </p>
        <p className="text-[11px] text-white/45 leading-relaxed">{copy.blurb}</p>
      </header>

      <label className="block">
        <span className="text-[11px] text-white/35">{copy.inputLabel}</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          maxLength={8000}
          placeholder={copy.placeholder}
          className="mt-1 w-full rounded-lg border border-white/[0.08] bg-black/30 p-2 text-[12px] leading-relaxed text-white/85 placeholder:text-white/20 focus:border-[#fa586a]/40 focus:outline-none"
        />
      </label>

      <button
        type="button"
        onClick={ask}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.08] px-3 py-1.5 text-[11px] font-bold text-white/80 hover:bg-white/[0.14] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
      >
        {busy && <Spinner className="h-3 w-3" />}
        {busy ? "Asking…" : copy.cta}
      </button>

      {/*
        A refusal is rendered as a sentence, in the place the answer would go.
        Leaving an empty gap there is how a guardrail starts to look like a bug,
        and people report bugs and stop using the thing.
      */}
      {refusal && (
        <p role="status" className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-2.5 text-[11px] leading-relaxed text-amber-200">
          {refusal}
        </p>
      )}

      {answer && (
        <div className="space-y-2">
          <p className="rounded-xl border border-white/[0.07] bg-black/25 p-3 text-[12px] leading-relaxed text-white/80 whitespace-pre-wrap">
            {answer}
          </p>
          {stripped && (
            <p className="text-[10px] text-white/30">
              Code was removed from that answer — this feature explains, it does not
              hand over an implementation.
            </p>
          )}
          {feature === "interview-sim" && (
            <p className="text-[10px] text-white/30">
              One at a time. Answer that question first — then come back for the next.
            </p>
          )}
        </div>
      )}
    </section>
  );
}