"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { rememberSource, track, isValidSlug } from "@/lib/analytics";

/**
 * Records the ?via= artifact slug from a shared link (Bible §56, Loop B).
 *
 * Mounted once per public share surface. The value is kept locally and read by
 * the signup that follows, so "this battle card brought a signup" becomes a
 * question the product can answer instead of guessing at.
 *
 * Renders nothing.
 */
export function TrackVisit({ artifact }: { artifact: string }) {
  const params = useSearchParams();

  useEffect(() => {
    const via = params.get("via");
    if (!via) return;
    // Only a slug this app produced, so a crafted link cannot inject anything
    // arbitrary into the attribution stream.
    if (!isValidSlug(via)) return;
    rememberSource(via);
    track("invite_opened", { via, artifact });
  }, [params, artifact]);

  // Wave D funnel: every /b view counts, with or without ?via=. Kept separate
  // from the attribution above so organic opens are not invisible.
  useEffect(() => {
    if (artifact.startsWith("battle:")) {
      track("battle_card_viewed", { artifact });
    }
  }, [artifact]);

  return null;
}
