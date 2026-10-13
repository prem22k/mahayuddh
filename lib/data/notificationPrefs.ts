import { createClient } from "@/lib/supabase/client";

/**
 * Server-side notification preferences (own rows only, RLS).
 *
 * No row means "never set": every key reads as true. The profile page keeps
 * localStorage as an offline fallback, but this module is the source of truth
 * whenever the server answers.
 */

export interface NotificationPrefs {
  push_enabled: boolean;
  challenge: boolean;
  squad: boolean;
  practice: boolean;
  contests: boolean;
}

export const DEFAULT_PREFS: NotificationPrefs = {
  push_enabled: true,
  challenge: true,
  squad: true,
  practice: true,
  contests: true,
};

export type PrefsPatch = Partial<NotificationPrefs>;

/** Read the caller's prefs. Missing row (or no session) reads as all true. */
export async function getPrefs(): Promise<NotificationPrefs> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ...DEFAULT_PREFS };

  const { data, error } = await supabase
    .from("user_notification_prefs")
    .select("push_enabled,challenge,squad,practice,contests")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !data) return { ...DEFAULT_PREFS };
  return { ...DEFAULT_PREFS, ...(data as NotificationPrefs) };
}

/** Upsert the caller's prefs. Throws when the server write fails. */
export async function savePrefs(patch: PrefsPatch): Promise<NotificationPrefs> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Log in to save notification preferences.");

  const clean: PrefsPatch = {};
  for (const k of Object.keys(patch) as (keyof NotificationPrefs)[]) {
    if (typeof patch[k] === "boolean") clean[k] = patch[k];
  }
  if (Object.keys(clean).length === 0) return getPrefs();

  const { data, error } = await supabase
    .from("user_notification_prefs")
    .upsert(
      { user_id: user.id, ...clean, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    )
    .select("push_enabled,challenge,squad,practice,contests")
    .maybeSingle();
  if (error) throw new Error(error.message || "Couldn't save preferences.");
  if (!data) return getPrefs();
  return { ...DEFAULT_PREFS, ...(data as NotificationPrefs) };
}
