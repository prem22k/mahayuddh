/**
 * AI policy (Step 25, Bible §45).
 *
 * §45's objective is one sentence: *"Use AI to increase thinking, not eliminate
 * thinking."* Everything here serves that sentence, and the module is pure so
 * every rule is testable without a model, an account, or a network call.
 *
 * What is deliberately absent: a model client. None is configured in this
 * repository, and a feature that pretends to have one would report invented
 * output. `lib/ai/gate.ts` decides whether a call may happen; this module
 * decides what the answer is allowed to contain.
 */

import { LEVEL_RANK } from "../stuckLadder.ts";
import type { StuckLevel } from "@/types/database";

export type AiFeature =
  | "stuck_assistant"
  | "explain_mistake"
  | "practice_next"
  | "explain_back"
  | "interview_sim";

export type AiOutcome =
  | "ok"
  | "refused"
  | "rate_limited"
  | "disabled"
  | "no_provider"
  | "error";

export interface AiDecision {
  allowed: boolean;
  outcome: AiOutcome;
  /** Message shown to the user. Written to be read, not logged and forgotten. */
  message: string;
  /** The level the assistant may answer at. Never above the requested level. */
  ceiling: StuckLevel | null;
}

/** Calls allowed per squad per hour. Matches ai_calls_remaining() in SQL. */
export const AI_CALLS_PER_HOUR = 30;

/**
 * §45's bad-use list, encoded as refusals rather than as prose in a policy doc.
 *
 * An instant full solution is the failure mode this product is most likely to
 * drift into, because it is the one that demos well.
 */
export const FORBIDDEN_ASK = [
  "just give me the solution",
  "full solution please",
  "write the code for me",
  "solve it for me",
  "what's the answer",
] as const;

function looksLikeSolutionVending(request: string): boolean {
  const q = request.toLowerCase();
  return FORBIDDEN_ASK.some((phrase) => q.includes(phrase));
}

/**
 * Decide whether a stuck assistant call may proceed, and at what ceiling.
 *
 * Order matters. The gate is checked before the request text, because a squad
 * with AI disabled should get "off" rather than a lecture about phrasing — and
 * because refusing for phrasing must not consume the squad's budget.
 */
export function decideStuckAssistant(input: {
  aiEnabled: boolean;
  requestedLevel: StuckLevel;
  remainingBudget: number;
  /** What the user typed. Optional; an empty request still gets a nudge. */
  request?: string;
  providerConfigured: boolean;
}): AiDecision {
  const ceiling = input.requestedLevel;

  if (!input.aiEnabled) {
    return {
      allowed: false,
      outcome: "disabled",
      ceiling: null,
      message:
        "AI is off for this squad. A squad-mate can still help at the level you asked for.",
    };
  }

  if (input.remainingBudget <= 0) {
    return {
      allowed: false,
      outcome: "rate_limited",
      ceiling: null,
      message: `Hourly limit reached for your squad. It resets soon — or ask a squad-mate, which is usually faster anyway.`,
    };
  }

  if (!input.providerConfigured) {
    // Honest rather than a fake answer. §45's objection to AI filler applies
    // with most force to filler that pretends to be a real answer.
    return {
      allowed: false,
      outcome: "no_provider",
      ceiling: null,
      message:
        "No AI provider is configured for this deployment, so there is no answer to give. The ladder and your squad-mates still work.",
    };
  }

  if (looksLikeSolutionVending(input.request ?? "")) {
    return {
      allowed: false,
      outcome: "refused",
      ceiling,
      message:
        "This assistant gives hints, not answers — that is the point of it. Ask a squad-mate if you want the full solution.",
    };
  }

  return {
    allowed: true,
    outcome: "ok",
    ceiling,
    message: "",
  };
}

/**
 * Clamp an answer's level to the ceiling.
 *
 * Called on the model's output as well as before the request, because a model
 * will sometimes answer "here's the full solution" when asked for a nudge. The
 * database trigger catches the same thing again in ai_calls, so there are three
 * layers: ask, clamp, and refuse-to-log.
 *
 * Returns the level to actually show plus whether it had to be pulled down.
 */
export function clampAnswerLevel(
  requested: StuckLevel,
  answered: StuckLevel
): { level: StuckLevel; pulledDown: boolean } {
  if (LEVEL_RANK[answered] > LEVEL_RANK[requested]) {
    return { level: requested, pulledDown: true };
  }
  return { level: answered, pulledDown: false };
}

/**
 * Strip a solution out of a response that overstepped.
 *
 * Not a general answer-quality filter — it only handles the two shapes that
 * turn a hint into a solution: a fenced code block, and a "here's the code"
 * preamble followed by code. The honest limit is stated in the return: if
 * `stripped` is true the caller should re-ask at a lower level rather than show
 * the remainder, because prose can carry an answer without code.
 */
export function stripCodeBlocks(text: string): { text: string; stripped: boolean } {
  const fenced = /```[\s\S]*?```/g;
  const inline = /`[^`\n]{20,}`/g;
  const withoutCode = text.replace(fenced, "").replace(inline, "");
  const withoutPreamble = withoutCode.replace(
    /\b(here('| i)s the (full )?(code|solution|answer))\b[:\s]*/gi,
    ""
  );
  return {
    text: withoutPreamble.trim(),
    stripped: withoutPreamble !== text,
  };
}

/** §45's five good uses, with what each is for and what it must never become. */
export const AI_FEATURES: {
  id: AiFeature;
  label: string;
  purpose: string;
  /** The §45 bad use this feature is most at risk of drifting into. */
  neverBecomes: string;
  needsModel: boolean;
}[] = [
  {
    id: "stuck_assistant",
    label: "Stuck assistant",
    purpose: "Give progressively stronger hints on the ladder you asked for.",
    neverBecomes: "An instant solution generator.",
    needsModel: true,
  },
  {
    id: "explain_mistake",
    label: "Explain my mistake",
    purpose: "Point at the concept a failed attempt missed.",
    neverBecomes: "A rewrite of your code.",
    needsModel: true,
  },
  {
    id: "practice_next",
    label: "Practice next",
    purpose: "A plain-language wrapper over the deterministic recommendation engine.",
    neverBecomes: "A black-box score. It must cite the same why-bullets.",
    needsModel: false,
  },
  {
    id: "explain_back",
    label: "Explain back",
    purpose: "Ask you to explain your solution, then respond to what you said.",
    neverBecomes: "A quiz that scores you on vocabulary.",
    needsModel: true,
  },
  {
    id: "interview_sim",
    label: "Interview simulation",
    purpose: "Ask follow-up questions about an approach you wrote.",
    neverBecomes: "A fake interviewer that praises every answer.",
    needsModel: true,
  },
];

/**
 * The prompt preamble that keeps a model inside §45.
 *
 * Shared rather than repeated per feature so the rule lives in one place, and
 * so a new feature cannot ship without it.
 */
export const SYSTEM_PREAMBLE = [
  "You are helping a developer learn, not finishing their work for them.",
  "Never give a complete solution unless the developer explicitly asked for the 'full' level.",
  "Prefer a question that makes them think of the next step.",
  "Be brief. Three sentences is usually enough.",
  "If you cannot help without giving the answer, say so instead of giving the answer.",
].join(" ");

/** Levels in ladder order, for a select that cannot offer 'full' by accident. */
export const LADDER_LEVELS: StuckLevel[] = ["nudge", "pattern", "direction", "full"];

/**
 * Post-process a model response.
 *
 * Exported so the provider seam and its tests both use the same path, and so the
 * behaviour can be verified before a provider exists.
 */
export function sanitizeAnswer(
  requested: StuckLevel,
  raw: { level: StuckLevel; text: string }
): { level: StuckLevel; text: string; pulledDown: boolean; stripped: boolean } {
  const clamped = clampAnswerLevel(requested, raw.level);
  const stripped = stripCodeBlocks(raw.text);
  return {
    level: clamped.level,
    text: stripped.text,
    pulledDown: clamped.pulledDown,
    stripped: stripped.stripped,
  };
}

/**
 * Practice next — §45's "Practice next", which the plan describes as an NL
 * wrapper over the Step 24 engine that "must cite why-bullets".
 *
 * Fully functional with no model, because Step 24 is deterministic. The model
 * would only restate the engine's own reasons in prose, which is exactly the
 * kind of filler §45's bad-use list warns about. So this is the shipped version
 * and the seam is deliberately absent.
 */
export function practiceNextFromRecommendation(reasonCount: number): {
  summary: string;
  citesWhy: boolean;
} {
  return {
    summary:
      reasonCount > 0
        ? "Based on your own logged history, not a prediction."
        : "Nothing to suggest yet — no recorded reason.",
    // The engine's why-bullets are always carried through; a recommendation
    // without its reasons is exactly what §24 forbids.
    citesWhy: reasonCount > 0,
  };
}

/**
 * Is a provider configured?
 *
 * Reads the environment rather than a feature flag, so there is exactly one
 * source of truth. Nothing in this repository sets either variable, which is
 * why no AI feature has ever returned an invented answer.
 */
export function isProviderConfigured(): boolean {
  return Boolean(
    process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY
  );
}
