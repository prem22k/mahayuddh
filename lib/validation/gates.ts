/**
 * Validation gates and review questions (Step 27, §58, §59, §60, §76).
 *
 * Step 27 is a two-week test with real squads. Software cannot supply the
 * people, and this module does not pretend otherwise. What it does is make
 * every gate that CAN be measured actually measured, so §76's instruction —
 *
 *     If the answer is no, stop adding surface area.
 *
 * — is enforceable rather than rhetorical.
 *
 * Three rules, all learned from earlier work in this codebase:
 *
 *   - A gate with no data is `unknown`, never `false`. "0% activation" over an
 *     empty squad is not a finding, it is a division by zero wearing a suit.
 *   - The qualitative gate ("someone says this is where we do DSA") has no
 *     automated answer and is carried here explicitly as unmeasurable, so its
 *     absence from the numbers is a decision rather than an oversight.
 *   - A measurement and a conclusion are different things. `activation` measures
 *     battles started; it does not claim anyone understood why.
 */

export type GateId = "activation" | "social" | "learning" | "retention" | "organic";

export type GateVerdict = "pass" | "fail" | "unknown";

export interface Gate {
  id: GateId;
  label: string;
  /** §58's wording for this gate. */
  question: string;
  verdict: GateVerdict;
  /** What was counted. Null when there was nothing to count. */
  measured: string | null;
  /**
   * What this gate CANNOT tell you. Present on every gate, because the
   * temptation to read a number as a conclusion is where validation goes wrong.
   */
  cannotTell: string;
}

/** Gates SQL returns. A missing row means "no members", i.e. unknown. */
export interface RawGateRow {
  gate: string;
  passed: boolean;
  measured: string;
  detail: string;
}

const CANNOT_TELL: Record<GateId, string> = {
  activation:
    "Battles started. It cannot show that anybody understood why, only that a button got pressed.",
  social: "Nothing in the product instructs sending a challenge, so these are unprompted. It cannot show intent, and it cannot show a challenge that stayed in a DM.",
  learning:
    "Approaches written and things copied. Reading is not measurable from rows at all — a primer opened and closed leaves nothing behind.",
  retention:
    "Weeks with a solve. It cannot distinguish a member returning from a background job writing one solve.",
  organic: "Invites attributed to a person. It cannot show an invite that went somewhere else entirely.",
};

/**
 * Turn SQL rows into gate verdicts.
 *
 * The SQL already returns no row when there is nobody to measure, so a missing
 * row becomes `unknown` rather than `fail`.
 */
export function buildGates(rows: RawGateRow[]): Gate[] {
  const byId = new Map(rows.map((r) => [r.gate as GateId, r]));
  const order: GateId[] = ["activation", "social", "learning", "retention", "organic"];

  const labels: Record<GateId, { label: string; question: string }> = {
    activation: { label: "Activation", question: "Users can reach first battle quickly." },
    social: { label: "Social activation", question: "Users send challenges without being instructed." },
    learning: { label: "Learning behaviour", question: "Users actually read, copy and write approaches." },
    retention: { label: "Retention", question: "Squads continue practising beyond the first week." },
    organic: { label: "Organic behaviour", question: "Someone invites another person unprompted." },
  };

  return order.map((id) => {
    const row = byId.get(id);
    const verdict: GateVerdict = row ? (row.passed ? "pass" : "fail") : "unknown";
    return {
      id,
      label: labels[id].label,
      question: labels[id].question,
      verdict,
      measured: row?.measured ?? null,
      // The SQL writes a reason for each verdict; keep it because "fail" with no
      // reason is the least actionable word in this product.
      cannotTell: row?.detail ? `${row.detail} ${CANNOT_TELL[id]}` : CANNOT_TELL[id],
    };
  });
}

/** §58's sixth gate. Not automatable, and deliberately carried as such. */
export const QUALITATIVE_GATE = {
  label: "Qualitative",
  question: 'Someone says some version of: "This is where we do DSA."',
  measurable: false as const,
  reason:
    "No query can answer this. It comes from the §59 observation log, category 'praise', recorded by a human who was there.",
} as const;

export interface GateBoard {
  gates: Gate[];
  qualitative: typeof QUALITATIVE_GATE;
  passed: number;
  failed: number;
  unknown: number;
  /** True when nothing could be measured at all — the honest "not started" state. */
  empty: boolean;
}

export function gateBoard(rows: RawGateRow[]): GateBoard {
  const gates = buildGates(rows);
  const passed = gates.filter((g) => g.verdict === "pass").length;
  const failed = gates.filter((g) => g.verdict === "fail").length;
  const unknown = gates.filter((g) => g.verdict === "unknown").length;
  return {
    gates,
    qualitative: QUALITATIVE_GATE,
    passed,
    failed,
    unknown,
    empty: gates.every((g) => g.verdict === "unknown"),
  };
}

/**
 * §76 — the six questions every major iteration must answer.
 *
 * Each maps to a gate. "Are new people joining through existing users?" is the
 * one that could not be answered at all before Loop D, which is worth stating
 * rather than quietly filling in.
 */
export interface ReviewQuestion {
  id: string;
  question: string;
  gate: GateId | "qualitative";
  /** Why this question exists, or what a "no" means for the roadmap. */
  note: string;
}

export const REVIEW_QUESTIONS: ReviewQuestion[] = [
  {
    id: "practice",
    question: "Are users practising more?",
    gate: "activation",
    note: "A no here is about the product working, not about marketing.",
  },
  {
    id: "interact",
    question: "Are squads interacting?",
    gate: "social",
    note: "The challenge loop is Loop A. If it is not firing unprompted, everything built for it is early.",
  },
  {
    id: "learn",
    question: "Are users learning from each other?",
    gate: "learning",
    note: "Writing and copying only. Reading is invisible in the data.",
  },
  {
    id: "return",
    question: "Are they returning?",
    gate: "retention",
    note: "The §59 day-7 question: does anybody come back voluntarily.",
  },
  {
    id: "join",
    question: "Are new people joining through existing users?",
    gate: "organic",
    note: "Unanswerable before Loop D, because a signup through an invite link could not be tied to the inviter.",
  },
  {
    id: "knowledge",
    question: "Are users generating useful knowledge?",
    gate: "learning",
    note: "Also depends on the Loop C completion window: writing is cheap, being used is the claim.",
  },
];

/** §76's conclusion rule, stated once. */
export const REVIEW_RULE =
  "If the answer to any of these is no, stop adding surface area.";

// ── §59 observation log ──────────────────────────────────────────────────────

export type ObservationCategory =
  | "hesitation"
  | "ignored"
  | "requested"
  | "workaround"
  | "praise"
  | "blocker";

export interface ObservationCategoryInfo {
  id: ObservationCategory;
  label: string;
  /** What this category is for, so an observer does not guess. */
  hint: string;
}

export const OBSERVATION_CATEGORIES: ObservationCategoryInfo[] = [
  { id: "hesitation", label: "Hesitation", hint: "Where they stalled or needed help to continue." },
  { id: "blocker", label: "Blocker", hint: "Something that stopped them outright." },
  { id: "ignored", label: "Ignored", hint: "What they never touched. Silence is data." },
  { id: "workaround", label: "Workaround", hint: "What they did outside the app instead." },
  { id: "requested", label: "Requested", hint: "What they kept asking for." },
  { id: "praise", label: "Praise", hint: "Unprompted positive. The §58 qualitative gate lives here." },
];

/** §59's four day markers. */
export const OBSERVATION_DAYS = [
  { day: 1, question: "Can everyone understand what to do?" },
  { day: 3, question: "Has someone naturally challenged someone?" },
  { day: 7, question: "Do people return voluntarily?" },
  { day: 14, question: "Does the squad have a meaningful history?" },
] as const;

// ── §60 feature decision framework ───────────────────────────────────────────

export type TriageLabel = "CORE" | "SUPPORT" | "EXPERIMENT" | "FUTURE" | "KILL" | "DUPLICATE";

export const TRIAGE_LABELS: Record<TriageLabel, string> = {
  CORE: "Directly strengthens the main loop.",
  SUPPORT: "Useful infrastructure or quality layer.",
  EXPERIMENT: "Worth testing, not yet committed.",
  FUTURE: "Potentially valuable after core validation.",
  KILL: "Adds complexity without strengthening user value.",
  DUPLICATE: "Already solved by an existing product or feature.",
};

/** §60's nine recorded fields, in its order. */
export const TRIAGE_FIELDS = [
  "Problem",
  "User",
  "Behavior",
  "Core-loop link",
  "Alternative",
  "Cost",
  "Risk",
  "Success metric",
  "Decision",
] as const;

export type TriageField = (typeof TRIAGE_FIELDS)[number];

export interface TriageEntry {
  feature: string;
  label: TriageLabel | null;
  problem: string | null;
  target_user: string | null;
  behaviour: string | null;
  core_loop_link: string | null;
  alternative: string | null;
  cost: string | null;
  risk: string | null;
  success_metric: string | null;
  decision: string | null;
}

/** How complete a triage entry is, out of the nine fields §60 requires. */
export function triageCompleteness(entry: TriageEntry): {
  filled: number;
  total: number;
  ready: boolean;
} {
  const values: Record<TriageField, string | null> = {
    Problem: entry.problem,
    User: entry.target_user,
    Behavior: entry.behaviour,
    "Core-loop link": entry.core_loop_link,
    Alternative: entry.alternative,
    Cost: entry.cost,
    Risk: entry.risk,
    "Success metric": entry.success_metric,
    Decision: entry.decision,
  };
  const filled = TRIAGE_FIELDS.filter((f) => (values[f] ?? "").trim().length > 0).length;
  return { filled, total: TRIAGE_FIELDS.length, ready: filled === TRIAGE_FIELDS.length };
}