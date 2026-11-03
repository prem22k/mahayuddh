"use client";

import { consumeSource, track } from "@/lib/analytics";

/**
 * Choices a new account makes on the Join form. Every one is optional except
 * that the account needs a profile row.
 */
export interface SignupChoices {
  leetcodeHandle?: string | null;
  squadName?: string | null;
  objective?: string | null;
  /** 8-character invite code when the visitor arrived from a squad invite. */
  inviteCode?: string | null;
  /**
   * The visitor answered the Join form (name, objective, squad, LeetCode), so
   * the first-run setup on /onboarding has nothing left to ask. False for a
   * provider sign-in from the Sign in tab, which asked nothing.
   */
  answeredJoinForm?: boolean;
}

export interface FinishedSignup {
  /** False only when the profile row could not be created; nothing else ran. */
  ok: boolean;
  squadCreated: boolean;
  /** Where the new account should land. */
  landing: string;
}

/**
 * Set up a just-created account: profile row, LeetCode sync, optional squad,
 * objective, and joining the invited squad. Shared by email signup (straight
 * after signUp) and social signup (on /auth/finish after the provider returns),
 * so both paths do exactly the same work.
 *
 * Only the profile is required. Every other step logs and continues: a failed
 * LeetCode sync or squad creation must never stop someone reaching their first
 * battle; each can be redone later from its own page.
 */
export async function finishSignup(
  accessToken: string,
  choices: SignupChoices,
  nextPath: string
): Promise<FinishedSignup> {
  const auth = { Authorization: `Bearer ${accessToken}` };
  const json = { ...auth, "Content-Type": "application/json" };

  // Profile row is created server-side (service role): the browser never
  // writes profiles with the anon key, and never calls LeetCode (CORS).
  try {
    const profileRes = await fetch("/api/auth/profile", { method: "POST", headers: auth });
    if (!profileRes.ok) return { ok: false, squadCreated: false, landing: nextPath };
  } catch {
    return { ok: false, squadCreated: false, landing: nextPath };
  }

  const lcHandle = choices.leetcodeHandle?.trim();
  if (lcHandle) {
    try {
      const syncRes = await fetch("/api/sync/leetcode", {
        method: "POST",
        headers: json,
        body: JSON.stringify({ username: lcHandle }),
      });
      if (!syncRes.ok) console.warn("Post-signup LeetCode sync failed; background sync will retry.");
    } catch (err) {
      console.warn("Post-signup LeetCode sync failed; background sync will retry:", err);
    }
  }

  let squadCreated = false;
  const squadName = choices.squadName?.trim();
  if (squadName) {
    try {
      const squadRes = await fetch("/api/squads", {
        method: "POST",
        headers: json,
        body: JSON.stringify({ name: squadName }),
      });
      squadCreated = squadRes.ok;
      if (squadRes.ok) {
        const squadJson = await squadRes.json().catch(() => ({}));
        const sid = (squadJson as { squad?: { id?: unknown } })?.squad?.id;
        track("squad_created", { via: "signup", ...(typeof sid === "string" ? { squad_id: sid } : {}) });
      } else {
        console.warn("Squad creation failed; user can create one later from /squad.");
      }
    } catch (err) {
      console.warn("Squad creation failed; user can create one later:", err);
    }
  }

  const profilePatch = {
    ...(choices.objective ? { objective: choices.objective } : {}),
    ...(choices.answeredJoinForm ? { onboarded: true } : {}),
  };
  if (Object.keys(profilePatch).length > 0) {
    try {
      await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: json,
        body: JSON.stringify(profilePatch),
      });
    } catch (err) {
      // Non-blocking: worst case the visitor sees /onboarding once.
      console.warn("Objective/onboarded save failed; non-blocking:", err);
    }
  }

  // Signing up from an invite joins the squad here, through the same server
  // route the invite page uses. On failure the invite page is still the next
  // stop and can retry.
  let landing = nextPath;
  if (choices.inviteCode) {
    try {
      const ref = new URL(nextPath, window.location.origin).searchParams.get("ref");
      const joinRes = await fetch("/api/squads/join", {
        method: "POST",
        headers: json,
        body: JSON.stringify({ invite_code: choices.inviteCode, ...(ref ? { ref } : {}) }),
      });
      if (joinRes.ok) {
        landing = "/squad";
        track("squad_joined", { via: "invite_signup", referred: Boolean(ref) });
      } else {
        console.warn("Invite join after signup failed; the invite page will retry.");
      }
    } catch (err) {
      console.warn("Invite join after signup failed; the invite page will retry:", err);
    }
  }

  return { ok: true, squadCreated, landing };
}

/**
 * Signup analytics, one place for both paths. signup_completed always;
 * signup_from_challenge when the account was made to answer a challenge or
 * invite link; share_signup when a shared artifact sent the visitor (consumed,
 * so a visit is credited once); invite_signup when joining by code.
 */
export function trackSignupCompleted(via: string, nextPath: string, inviteCode: string | null): void {
  const from = consumeSource();
  if (nextPath.startsWith("/c/") || nextPath.startsWith("/squad/join/")) {
    track("signup_from_challenge", { via, next: nextPath, source: from ?? undefined });
  }
  if (from) track("share_signup", { source: from, next: nextPath });
  if (inviteCode) track("invite_signup", { invite_code: inviteCode });
  track("signup_completed", { via, next: nextPath, source: from ?? undefined });
}

/** Invite code from a /squad/join/<CODE> next path, upper-cased; else null. */
export function inviteCodeFrom(nextPath: string): string | null {
  const m = nextPath.match(/^\/squad\/join\/([A-Za-z0-9]{8})/);
  return m ? m[1].toUpperCase() : null;
}

const PENDING_KEY = "mahayuddh:pending-signup";
// A provider sends the visitor straight back; an emailed confirmation link can
// be opened hours later.
const PENDING_TTL_MS = 30 * 60_000;
const PENDING_EMAIL_TTL_MS = 24 * 60 * 60_000;

interface PendingSignup {
  choices: SignupChoices;
  nextPath: string;
  provider: string;
  savedAt: number;
}

/**
 * Social signup leaves the page for the provider, so the Join choices are kept
 * in this browser until /auth/finish picks them up. They hold no secrets
 * (objective, squad name, LeetCode handle, invite code) and expire (30
 * minutes for a provider, 24 hours for an email confirmation) so an abandoned
 * attempt can't apply itself to a later sign-in.
 */
export function savePendingSignup(p: Omit<PendingSignup, "savedAt">): void {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify({ ...p, savedAt: Date.now() }));
  } catch {
    // Storage blocked: the account is still created; choices can be set later.
  }
}

/** Read and remove the pending choices. Null when absent, stale or unreadable. */
export function takePendingSignup(): PendingSignup | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    localStorage.removeItem(PENDING_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PendingSignup;
    const ttl = p?.provider === "email" ? PENDING_EMAIL_TTL_MS : PENDING_TTL_MS;
    if (typeof p?.savedAt !== "number" || Date.now() - p.savedAt > ttl) return null;
    return p;
  } catch {
    return null;
  }
}
