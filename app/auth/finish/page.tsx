"use client";

import { Suspense, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { Spinner } from "@/components/ui/Spinner";
import { track } from "@/lib/analytics";
import { safeNext } from "@/lib/safeNext";
import {
  finishSignup,
  inviteCodeFrom,
  takePendingSignup,
  trackSignupCompleted,
} from "@/lib/auth/finishSignup";

/**
 * Where a social sign-in lands after /auth/callback has exchanged the code.
 *
 * A brand-new account gets the same setup as an email signup (profile, the
 * Join choices saved before the provider redirect, invite join) and lands
 * where email signup would. A returning account just continues to ?next=.
 * "New" means created, or its email confirmed, in the last 10 minutes (an
 * emailed confirmation link lands here too). The Join tab can be used by
 * someone who already has an account, and their saved choices must not
 * create a second squad or overwrite their objective.
 */
const NEW_ACCOUNT_WINDOW_MS = 10 * 60_000;

export default function AuthFinishPage() {
  return (
    <Suspense fallback={<Finishing />}>
      <Finish />
    </Suspense>
  );
}

function Finishing() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-canvas">
      <Spinner size="xl" />
      <span className="text-xs font-medium text-text-secondary">Setting up your account…</span>
    </div>
  );
}

function Finish() {
  const { user, loading } = useAuth();
  const searchParams = useSearchParams();
  const ran = useRef(false);

  useEffect(() => {
    if (loading || ran.current) return;
    ran.current = true;
    const nextPath = safeNext(searchParams.get("next")) ?? "/home";

    if (!user) {
      window.location.replace(`/login?error=oauth_failed&next=${encodeURIComponent(nextPath)}`);
      return;
    }

    const pending = takePendingSignup();
    const provider = user.app_metadata?.provider ?? pending?.provider ?? "oauth";
    // New = created just now (social signup) or its email confirmed just now
    // (email signup, possibly hours after the form was sent).
    const recent = (iso: string | undefined | null) => {
      const t = Date.parse(iso ?? "");
      return Number.isFinite(t) && Date.now() - t < NEW_ACCOUNT_WINDOW_MS;
    };
    const isNew = recent(user.created_at) || recent(user.email_confirmed_at);

    if (!isNew) {
      track("signin_completed", { next: nextPath, via: provider });
      window.location.replace(nextPath);
      return;
    }

    void (async () => {
      const { data } = await createClient().auth.getSession();
      const token = data.session?.access_token;
      const inviteCode = pending?.choices.inviteCode ?? inviteCodeFrom(nextPath);
      let landing = nextPath;
      if (token) {
        const done = await finishSignup(
          token,
          { ...pending?.choices, inviteCode, answeredJoinForm: Boolean(pending?.choices.answeredJoinForm) },
          nextPath
        );
        landing = done.landing;
        trackSignupCompleted(
          done.squadCreated ? `${provider}_signup_squad` : `${provider}_signup`,
          nextPath,
          inviteCode
        );
      }
      window.location.replace(landing);
    })();
  }, [loading, user, searchParams]);

  return <Finishing />;
}
