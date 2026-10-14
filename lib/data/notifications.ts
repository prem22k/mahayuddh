import { createClient } from "@/lib/supabase/client";
import { Notification, NotificationKind } from "@/types/database";
import { inQuietHoursIST } from "@/lib/quietHours";

/**
 * Notifications (plan Step 23, Bible §36/§37).
 *
 * Action-oriented and low noise by design:
 *   - only 7 kinds exist, all of which imply a next action
 *   - one open notification per (user, kind, dedupe_key) so a goal nudge can't
 *     stack up — a second nudge replaces nothing, it is simply suppressed
 *   - `quietHours` suppresses anything that isn't directly actionable in-app
 *
 * Writes use the caller's own session: the table has no client INSERT policy,
 * so this goes through /api/notify (service role) instead.
 *
 * Quiet hours are IST (Asia/Kolkata) via lib/quietHours — the single source
 * of truth shared with the API route.
 */

function inQuietHours(now = new Date()): boolean {
  return inQuietHoursIST(now);
}

async function accessToken(): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export interface NotifyInput {
  userId: string;
  kind: NotificationKind;
  title: string;
  body?: string | null;
  deepLink?: string | null;
  actorId?: string | null;
  /** Collapse repeats of the same logical notice (e.g. one goal nudge/day). */
  dedupeKey?: string;
  /** Force delivery even inside quiet hours (challenge received is time-critical). */
  urgent?: boolean;
}

export async function notify(input: NotifyInput): Promise<void> {
  if (!input.urgent && inQuietHours()) return;

  const token = await accessToken();
  if (!token) return; // server-side callers use the service key path below

  await fetch("/api/notify", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  }).catch(() => {
    // Notifications are best-effort: never break the action that triggered them.
  });
}

export async function getNotifications(limit = 20): Promise<Notification[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select(
      "id,user_id,kind,title,body,deep_link,actor_id,dedupe_key,read_at,created_at,actor:actor_id (id, username, avatar_url)"
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  // Embedded `actor:actor_id (...)` widens to an array under the generated
  // PostgREST types; the runtime shape is a single object (see Notification).
  return (data ?? []) as unknown as Notification[];
}

export async function getUnreadCount(): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  if (error) return 0;
  return count ?? 0;
}

export async function markAllRead(): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
}

export async function markRead(id: string): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);
}