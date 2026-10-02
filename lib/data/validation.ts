import { createClient } from "@/lib/supabase/client";
import { DataError } from "@/lib/data/errors";
import type {
  Gate,
  GateBoard,
  ObservationCategory,
  RawGateRow,
  TriageEntry,
  TriageLabel,
} from "@/lib/validation/gates";
import { gateBoard } from "@/lib/validation/gates";

/**
 * Step 27 reads (Bible §58, §59, §60, §76).
 *
 * The gate functions are `security definer` aggregates so the numbers cannot
 * drift from the rows that produced them — the same reasoning as the Loop C
 * counters in `lib/data/impact.ts`.
 *
 * They are callable by anon as well as authenticated, which is deliberate: §58
 * asks whether a *squad* can be evaluated, and a member reviewing their own
 * squad should not need a different door from the researcher reviewing all of
 * them. Every function returns numbers, never names, so nothing here leaks who
 * is in a squad.
 */

export interface SquadOption {
  squad_id: string;
  name: string;
}

export interface Observation {
  id: string;
  squad_id: string | null;
  day_number: number | null;
  category: ObservationCategory;
  observation: string;
  created_at: string;
}

/** Every §58 gate, in order. Null squad_id means all squads. */
export async function getGateBoard(squadId: string | null = null): Promise<GateBoard> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("validation_gate_board", { p_squad_id: squadId });
  if (error) {
    throw new DataError("gates", "Couldn't read the validation gates. Retry.", { cause: error });
  }
  return gateBoard((data ?? []) as RawGateRow[]);
}

/** Squads with at least one member, so the picker is not full of empty rooms. */
export async function getSquadsForValidation(): Promise<SquadOption[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("validation_squads");
  if (error) throw new DataError("gates", "Couldn't load squads. Retry.", { cause: error });
  return (data ?? []) as SquadOption[];
}

export interface NewObservation {
  squad_id: string | null;
  day_number: number | null;
  category: ObservationCategory;
  observation: string;
}

/**
 * §59's log. RLS allows an insert only when `observed_by` is the caller, so
 * the researcher's own account is never recorded as a participant's.
 */
export async function recordObservation(input: NewObservation): Promise<void> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user?.id;
  if (!userId) throw new DataError("observations", "Sign in to record an observation.");

  const text = input.observation.trim();
  if (text.length === 0) {
    throw new DataError("observations", "Write what happened before saving.");
  }
  if (text.length > 2000) {
    throw new DataError("observations", "Keep it under 2000 characters.");
  }

  const { error } = await supabase.from("validation_observations").insert({
    squad_id: input.squad_id,
    day_number: input.day_number,
    category: input.category,
    observation: text,
    observed_by: userId,
  });
  if (error) throw new DataError("observations", "Couldn't save that. Retry.", { cause: error });
}

/** Observations, newest first. RLS keeps this to the observer and admins. */
export async function listObservations(squadId: string | null = null): Promise<Observation[]> {
  const supabase = createClient();
  let query = supabase
    .from("validation_observations")
    .select("id, squad_id, day_number, category, observation, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (squadId) query = query.eq("squad_id", squadId);
  const { data, error } = await query;
  if (error) throw new DataError("observations", "Couldn't load observations. Retry.", { cause: error });
  return (data ?? []) as Observation[];
}

/**
 * §60's triage table.
 *
 * Readable by everyone, because a decision nobody can see stops being a
 * decision. Writable only by admins, since a label is a commitment.
 */
export async function listTriage(): Promise<TriageEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("feature_triage")
    .select(
      "feature, label, problem, target_user, behaviour, core_loop_link, alternative, cost, risk, success_metric, decision"
    )
    .order("label", { ascending: true });
  if (error) throw new DataError("triage", "Couldn't load triage. Retry.", { cause: error });
  return (data ?? []) as TriageEntry[];
}

/** Add a feature to the triage queue. Blank label: §60 decides after the fields. */
export async function addTriageFeature(feature: string): Promise<void> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user?.id;
  if (!userId) throw new DataError("triage", "Sign in to add a feature.");

  const name = feature.trim();
  if (name.length === 0) throw new DataError("triage", "Name the feature first.");
  if (name.length > 120) throw new DataError("triage", "Keep the name under 120 characters.");

  const { error } = await supabase.from("feature_triage").insert({ feature: name });
  if (error) {
    // unique_violation on the lower(feature) index means it is already queued,
    // which is information rather than a failure worth surfacing as one.
    if (error.code === "23505") {
      throw new DataError("triage", `"${name}" is already in the triage queue.`);
    }
    throw new DataError("triage", "Couldn't add that. Retry.", { cause: error });
  }
}

/** Save the nine §60 fields and the label together. */
export async function decideTriage(entry: TriageEntry): Promise<void> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user?.id;
  if (!userId) throw new DataError("triage", "Sign in to record a decision.");

  const { error } = await supabase
    .from("feature_triage")
    .update({
      label: entry.label,
      problem: entry.problem,
      target_user: entry.target_user,
      behaviour: entry.behaviour,
      core_loop_link: entry.core_loop_link,
      alternative: entry.alternative,
      cost: entry.cost,
      risk: entry.risk,
      success_metric: entry.success_metric,
      decision: entry.decision,
      decided_by: userId,
      decided_at: new Date().toISOString(),
    })
    .eq("feature", entry.feature);
  if (error) throw new DataError("triage", "Couldn't save that decision. Retry.", { cause: error });
}

export type { Gate, TriageLabel };
