import { createClient } from "@/lib/supabase/client";
import { DataError } from "@/lib/data/errors";
import { track } from "@/lib/analytics";

export interface PrimerProgress {
  primer_slug: string;
  read_at: string | null;
  mastered_at: string | null;
}

/** Your read and mastered state for every primer you've touched. */
export async function getMyPrimerProgress(): Promise<Map<string, PrimerProgress>> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Map();
  const { data, error } = await supabase
    .from("primer_progress")
    .select("primer_slug,read_at,mastered_at")
    .eq("user_id", user.id);
  if (error) throw new DataError("primers", "Couldn't load your primer progress. Retry.", { cause: error });
  return new Map(((data ?? []) as PrimerProgress[]).map((p) => [p.primer_slug, p]));
}

async function stamp(slug: string, column: "read_at" | "mastered_at"): Promise<boolean> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const now = new Date().toISOString();
  // First time only: an existing timestamp is kept, so "read" and "mastered"
  // record when it first happened.
  const { data: existing } = await supabase
    .from("primer_progress")
    .select(column)
    .eq("user_id", user.id)
    .eq("primer_slug", slug)
    .maybeSingle();
  if ((existing as Record<string, string | null> | null)?.[column]) return false;
  const { error } = await supabase
    .from("primer_progress")
    .upsert({ user_id: user.id, primer_slug: slug, [column]: now, updated_at: now }, { onConflict: "user_id,primer_slug" });
  if (error) throw new DataError("primers", "Couldn't save that. Retry.", { cause: error });
  return true;
}

/** Mark a primer read: at the end of the page, or from the button. */
export async function markPrimerRead(slug: string): Promise<boolean> {
  const first = await stamp(slug, "read_at");
  if (first) track("primer_completed", { primer_slug: slug });
  return first;
}

/** Record the first time the mastery rule held for this primer. */
export async function markPrimerMastered(slug: string): Promise<boolean> {
  const first = await stamp(slug, "mastered_at");
  if (first) track("pattern_mastered", { primer_slug: slug });
  return first;
}
