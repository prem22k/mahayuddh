/**
 * Recommendation log analysis (Step 24, Bible §24).
 *
 * §24: "Logging: store recommendation + accepted/rejected to validate signal
 * weights before any AI." This module is the other half of that sentence — the
 * part that reads the log back out.
 *
 * Pure functions over logged rows, so the arithmetic is testable without a
 * database and so the weights can be judged rather than argued about.
 *
 * Two rules the arithmetic follows, both learned from getting it wrong first:
 *
 *   - One presentation is one row. `shown` becomes `accepted` or `dismissed` by
 *     update, never by inserting a second row. Counting both rows made three
 *     shown and one accepted read as 25% instead of 33%.
 *   - Rates are null when the denominator is zero. "0% accept rate" after no
 *     recommendations is a factually wrong thing to show a person.
 */

import type { SignalId } from "./recommend.ts";

export interface LoggedRecommendation {
  decision: "shown" | "accepted" | "rejected" | "dismissed";
  signal_ids: string[] | null;
  surface: string | null;
  problem_slug: string | null;
  created_at: string;
}

export interface AcceptRate {
  /** Presentations that were shown. A presentation, not a person. */
  shown: number;
  accepted: number;
  dismissed: number;
  /** accepted / shown, or null when nothing was shown. */
  rate: number | null;
}

export function acceptRate(rows: LoggedRecommendation[]): AcceptRate | null {
  const shown = rows.filter((r) => r.decision === "shown").length;
  const accepted = rows.filter((r) => r.decision === "accepted").length;
  const dismissed = rows.filter((r) => r.decision === "dismissed").length;
  const total = shown + accepted + dismissed;
  if (total === 0) return null;
  return {
    shown: total,
    accepted,
    dismissed,
    rate: accepted / total,
  };
}

export interface SignalBreakdown {
  signal: SignalId;
  /** How many presentations carried this reason. */
  presented: number;
  /** How many of those were accepted. */
  accepted: number;
  /** accepted / presented, or null when it was never presented. */
  rate: number | null;
}

/**
 * Accept rate per signal.
 *
 * A recommendation can carry several reasons, so each is attributed to every
 * signal that fired. That over-counts deliberately: the question is "does this
 * reason help?", and a reason that appears on accepted recommendations more
 * often than on dismissed ones is the signal worth keeping.
 *
 * `dismissed` counts as not-accepted. `rejected` is a distinct decision and is
 * excluded from both, because it was not logged for the same reason and mixing
 * it in would make the numbers uninterpretable.
 */
export function signalBreakdown(rows: LoggedRecommendation[]): SignalBreakdown[] {
  const considered = rows.filter((r) => r.decision !== "rejected");
  const signals = new Map<string, { presented: number; accepted: number }>();

  for (const row of considered) {
    const ids = row.signal_ids ?? [];
    for (const id of ids) {
      const entry = signals.get(id) ?? { presented: 0, accepted: 0 };
      entry.presented += 1;
      if (row.decision === "accepted") entry.accepted += 1;
      signals.set(id, entry);
    }
  }

  return [...signals.entries()]
    .map(([signal, v]) => ({
      signal: signal as SignalId,
      presented: v.presented,
      accepted: v.accepted,
      rate: v.presented === 0 ? null : v.accepted / v.presented,
    }))
    // Strongest evidence first: a signal that was accepted most often tells us
    // more than one that barely appeared.
    .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0) || b.presented - a.presented);
}

/**
 * The one-line honest summary for the UI.
 *
 * No advice, no cheerleading, and no claim about a weight being wrong. With too
 * few presentations it says so, because "prereq_ready is at 100%" after one
 * recommendation is noise dressed as a finding.
 */
export function explainRates(
  overall: AcceptRate | null,
  perSignal: SignalBreakdown[],
  minEvidence = 5
): string {
  if (!overall) {
    return "No recommendations have been shown yet. This appears after you have been offered one.";
  }
  if (overall.shown < minEvidence) {
    return `Shown ${overall.shown} so far. Too few to say anything useful about the reasons — this stays quiet until there are ${minEvidence}.`;
  }

  const pct = Math.round((overall.rate ?? 0) * 100);
  const strong = perSignal.filter((s) => s.presented >= minEvidence && s.rate != null);
  const base =
    `${overall.accepted} of ${overall.shown} started (${pct}%).`;

  if (strong.length === 0) {
    return `${base} No single reason has enough data yet.`;
  }

  const best = strong[0];
  const bestPct = Math.round((best.rate ?? 0) * 100);
  return `${base} Strongest reason: ${label(best.signal)} at ${bestPct}% over ${best.presented}.`;
}

/** Human label for a signal id, so the UI never shows a raw enum. */
export function label(signal: string): string {
  switch (signal) {
    case "low_exposure":
      return "low exposure";
    case "high_failure":
      return "prior failures";
    case "long_gap":
      return "long gap";
    case "prereq_ready":
      return "prerequisites met";
    case "prereq_missing":
      return "prerequisites unmet";
    case "plateau":
      return "plateau";
    case "squad_activity":
      return "squad activity";
    case "goal":
      return "your goal";
    default:
      return signal;
  }
}