import webpush from "web-push";

// Configure web-push with VAPID credentials
if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@mahayuddh.app",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
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
    const pushSubscription = normalizeSubscription(subscription);

    const response = await webpush.sendNotification(
      pushSubscription,
      JSON.stringify(payload)
    );

    return { success: true, statusCode: response.statusCode };
  } catch (error) {
    console.error("Error sending push notification:", error);
    return { success: false, error };
  }
}
