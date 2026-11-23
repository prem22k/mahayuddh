import { createClient } from "@/lib/supabase/client";
import type { Notification, NotificationKind } from "@/types/database";
import { getPrefs } from "@/lib/data/notificationPrefs";
import { isNotificationCategoryEnabled } from "@/lib/notifications/preferences";
import { DataError } from "@/lib/data/errors";

/**
 * Notifications (plan Step 23, Bible §36/§37).
 *
 * Rows are created by verified database events or action-specific server routes;
 * the browser never supplies an arbitrary recipient or notification body. User
 * category preferences are applied consistently to the bell, history, and
 * server-side push delivery.
 */

const NOTIFICATION_COLUMNS =
  "id,user_id,kind,title,body,deep_link,actor_id,dedupe_key,read_at,created_at,actor:actor_id (id, username, avatar_url)";

function enabledKinds(prefs: Awaited<ReturnType<typeof getPrefs>>): NotificationKind[] {
  const kinds: NotificationKind[] = [];
  if (prefs.challenge) kinds.push("challenge", "challenge_completed");
  if (prefs.squad) kinds.push("goal", "recap");
  if (prefs.practice) kinds.push("revenge");
  if (prefs.contests) kinds.push("contest");
  return kinds;
}

async function visibleNotifications(
  limit: number,
  opts: { unreadOnly?: boolean; before?: string | null } = {}
): Promise<Notification[]> {
  if (limit <= 0) return [];

  const supabase = createClient();
  const prefs = await getPrefs();
  const rows: Notification[] = [];
  const kinds = enabledKinds(prefs);

  if (kinds.length > 0) {
    let query = supabase.from("notifications").select(NOTIFICATION_COLUMNS).in("kind", kinds);
    if (opts.unreadOnly) query = query.is("read_at", null);
    if (opts.before) query = query.lt("created_at", opts.before);
    const { data, error } = await query.order("created_at", { ascending: false }).limit(limit);
    if (error) throw error;
    rows.push(...((data ?? []) as unknown as Notification[]));
  }

  // `nudge` covers both practice reminders and squad activity. Query only the
  // enabled subtype so disabled rows cannot crowd enabled rows out of a page.
  if (prefs.practice || prefs.squad) {
    let query = supabase
      .from("notifications")
      .select(NOTIFICATION_COLUMNS)
      .eq("kind", "nudge");
    if (opts.unreadOnly) query = query.is("read_at", null);
    if (opts.before) query = query.lt("created_at", opts.before);
    if (prefs.practice !== prefs.squad) {
      query = prefs.squad
        ? query.like("dedupe_key", "nudge:squad-without-you:%")
        : query.not("dedupe_key", "like", "nudge:squad-without-you:%");
    }
    const { data, error } = await query.order("created_at", { ascending: false }).limit(limit);
    if (error) throw error;
    rows.push(...((data ?? []) as unknown as Notification[]));
  }

  return rows
    .filter((row) => isNotificationCategoryEnabled(prefs, row.kind, row.dedupe_key))
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .slice(0, limit);
}

/**
 * The bell's list. `unreadOnly` is what the bell shows: reading an item or
 * "Mark all read" takes it out of the bell, and /notifications keeps the
 * history. Best effort: an error reads as an empty bell, never a broken header.
 */
export async function getNotifications(
  limit = 20,
  opts: { unreadOnly?: boolean } = {}
): Promise<Notification[]> {
  try {
    return await visibleNotifications(limit, opts);
  } catch {
    return [];
  }
}

/**
 * The history page: every enabled notification, read or not, newest first, one
 * page at a time (`before` is the oldest created_at already shown). Throws so
 * the page can offer a retry instead of claiming there is nothing.
 */
export async function getNotificationHistory(limit = 30, before?: string | null): Promise<Notification[]> {
  try {
    return await visibleNotifications(limit, { before });
  } catch (cause) {
    throw new DataError("notifications", "Couldn't load your notifications. Retry.", { cause });
  }
}

export async function getUnreadCount(): Promise<number> {
  try {
    const supabase = createClient();
    const prefs = await getPrefs();
    let count = 0;
    const kinds = enabledKinds(prefs);

    if (kinds.length > 0) {
      const { count: baseCount, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .in("kind", kinds)
        .is("read_at", null);
      if (error) return 0;
      count += baseCount ?? 0;
    }

    if (prefs.practice || prefs.squad) {
      let query = supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("kind", "nudge")
        .is("read_at", null);
      if (prefs.practice !== prefs.squad) {
        query = prefs.squad
          ? query.like("dedupe_key", "nudge:squad-without-you:%")
          : query.not("dedupe_key", "like", "nudge:squad-without-you:%");
      }
      const { count: nudgeCount, error } = await query;
      if (error) return 0;
      count += nudgeCount ?? 0;
    }

    return count;
  } catch {
    return 0;
  }
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
