import webpush from "web-push";
import { isAllowedPushHost } from "@/lib/security/pushEndpoint";

/** Hostname or "" when the endpoint will not parse. Never throws. */
function safeHostname(endpoint: string): string {
  try {
    return new URL(endpoint).hostname;
  } catch {
    return "";
  }
}

// Configure web-push with VAPID credentials. Never throws: a missing or
// malformed key (e.g. a placeholder in .env.local) must degrade to
// push-disabled, not crash module evaluation during `next build`.
try {
  if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:admin@mahayuddh.app",
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
  }
} catch {
  // Invalid VAPID keys: push stays disabled; senders no-op.
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  data?: {
    url?: string;
    [key: string]: unknown;
  };
}

// Accepts either a flat DB record (PushSubscriptionRecord) or a standard
// PushSubscription JSON. Normalizes to the shape web-push expects.
export interface PushSubscriptionInput {
  endpoint: string;
  p256dh?: string;
  auth?: string;
  keys?: { p256dh?: string; auth?: string };
}

function normalizeSubscription(sub: PushSubscriptionInput) {
  const p256dh = sub.p256dh ?? sub.keys?.p256dh;
  const auth = sub.auth ?? sub.keys?.auth;
  if (!p256dh || !auth) {
    throw new Error("Push subscription missing p256dh/auth keys");
  }
  return { endpoint: sub.endpoint, keys: { p256dh, auth } };
}

export async function sendPushNotification(
  subscription: PushSubscriptionInput,
  payload: PushNotificationPayload
) {
  try {
    /**
     * Re-checked at send time, not only at subscribe time.
     *
     * The allowlist in lib/security/pushEndpoint.ts is enforced where rows are
     * written, but rows predating that check are already in the table, and the
     * service key can write there from anywhere. The sender is the place that
     * actually makes the outbound request, so it is the place the host has to be
     * verified: anything off the list is refused before a socket is opened,
     * rather than trusted because it was validated once on a different code path.
     */
    if (!isAllowedPushHost(safeHostname(subscription.endpoint))) {
      return { success: false, gone: false, error: new Error("push endpoint host not allowed") };
    }

    const pushSubscription = normalizeSubscription(subscription);

    const response = await webpush.sendNotification(
      pushSubscription,
      JSON.stringify(payload)
    );

    return { success: true, statusCode: response.statusCode };
  } catch (error) {
    // 404/410 mean the browser dropped the subscription: retire it rather than
    // retrying a dead endpoint forever.
    const status = (error as { statusCode?: number })?.statusCode;
    return {
      success: false,
      gone: status === 404 || status === 410,
      error,
    };
  }
}

/**
 * Fan a payload out to every live subscription a user holds. Server-only
 * (imports the service client) — never call from a client component.
 */
export async function sendPushToUser(
  userId: string,
  payload: { title: string; body?: string; url?: string }
): Promise<{ sent: number; retired: number }> {
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return { sent: 0, retired: 0 };
  }

  const { getServiceClient } = await import("@/lib/supabase/service");
  const supabase = getServiceClient();
  if (!supabase) return { sent: 0, retired: 0 };

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (error || !subs || subs.length === 0) return { sent: 0, retired: 0 };

  const wire: PushNotificationPayload = {
    title: payload.title,
    body: payload.body ?? "",
    data: payload.url ? { url: payload.url } : undefined,
  };

  let sent = 0;
  let retired = 0;
  for (const sub of subs as {
    id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
  }[]) {
    const result = await sendPushNotification(
      { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
      wire
    );
    if (result.success) sent++;
    else if (result.gone) {
      await supabase.from("push_subscriptions").delete().eq("id", sub.id);
      retired++;
    }
  }

  return { sent, retired };
}
