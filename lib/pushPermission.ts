"use client";

import { track } from "@/lib/analytics";

/**
 * Push permission request, shared by the bell and the first-solve prompt.
 *
 * One flow, two surfaces: the bell owns the toggle UI, the first-solve prompt
 * borrows the request itself so a grant from either place is counted the same
 * way (notification_push_toggled). Nothing here renders.
 */
export type PushPermissionState = "granted" | "denied" | "default" | "unsupported";

export function pushPermissionState(): PushPermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export async function requestPushPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  const permission = await Notification.requestPermission();
  const granted = permission === "granted";
  track("notification_push_toggled", { granted });
  return granted;
}
