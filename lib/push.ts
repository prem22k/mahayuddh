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

export interface SubscriptionKeys {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export async function sendPushNotification(
  subscription: SubscriptionKeys,
  payload: PushNotificationPayload
) {
  try {
    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    };

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
