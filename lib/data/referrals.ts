import { createClient } from "@/lib/supabase/client";
import { DataError } from "@/lib/data/errors";

/**
 * Loop D referral links (Step 26, §56).
 *
 * A link is `/squad/join/<invite_code>?ref=<token>`. The code authorises the
 * join; the token attributes it. Splitting them is what makes "who sent this?"
 * answerable without giving the token any power of its own.
 */

export interface ReferralLink {
  squad_id: string;
  squad_name: string;
  token: string;
  invite_code: string;
  /** Root-relative, so it works from any origin without a second copy of the host. */
  path: string;
  opens: number;
  joins: number;
}

async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
}

/** Mint or fetch the caller's link for one squad. Idempotent. */
export async function getOrCreateMyReferralLink(squadId: string): Promise<ReferralLink> {
  const res = await authedFetch("/api/squads/referral", {
    method: "POST",
    body: JSON.stringify({ squad_id: squadId }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new DataError("squads", json.error || "Couldn't get your invite link.", { cause: null });
  }
  return json as ReferralLink;
}

/** Every link this caller has sent, across squads. */
export async function getMyReferralLinks(): Promise<ReferralLink[]> {
  const res = await authedFetch("/api/squads/referral");
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new DataError("squads", json.error || "Couldn't load your links.", { cause: null });
  }
  return (json.links ?? []) as ReferralLink[];
}
