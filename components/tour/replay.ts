"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Replaying the first-run tour (the profile page's "Replay the tour").
 *
 * Clears `profiles.tour_completed_at`, then asks the mounted <FirstRunTour />
 * to refresh the profile and take the visitor to /home, where the tour starts.
 * If no tour is mounted to hear the request, it falls back to a full load of
 * /home, which reads the fresh profile anyway.
 *
 * Throws with a user-facing message when the server refuses, so the caller
 * can show it.
 */

export const TOUR_REPLAY_EVENT = "mahayuddh:tour-replay";

/** sessionStorage key that stops a dismissed tour from reopening this session. */
export const tourDismissedKey = (userId: string) => `mahayuddh:tour-dismissed:${userId}`;

export async function setTourCompleted(completed: boolean): Promise<void> {
  const supabase = createClient();
  const token = (await supabase.auth.getSession()).data.session?.access_token;
  if (!token) throw new Error("You're signed out. Sign in and try again.");

  const res = await fetch("/api/auth/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ tour_completed: completed }),
  });
  if (!res.ok) {
    throw new Error(
      completed
        ? "Couldn't save that you finished the tour."
        : "Couldn't restart the tour. Try again in a moment."
    );
  }
}

export async function replayTour(): Promise<void> {
  await setTourCompleted(false);

  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key?.startsWith("mahayuddh:tour-dismissed:")) sessionStorage.removeItem(key);
    }
  } catch {
    // Storage blocked: nothing was saved there either.
  }

  const request = new CustomEvent(TOUR_REPLAY_EVENT, { cancelable: true });
  const handled = !window.dispatchEvent(request);
  // No mounted tour heard the request (it lives in the signed-in shell): a
  // full load of /home reads the cleared flag and starts it.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  if (!handled) window.location.assign("/home");
}
