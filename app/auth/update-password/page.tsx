"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { PageLoader } from "@/components/ui/PageLoader";
import {
  AuthAlert,
  AuthCard,
  AuthFrame,
  PasswordToggle,
  authInputCls,
  authLabelCls,
} from "@/components/auth/AuthChrome";
import { cn } from "@/lib/utils";

/**
 * Password update after a recovery link (controls 3, 4).
 *
 * Reached only with a live recovery session: the /auth/callback code exchange
 * turns the single-use emailed token into a short-lived session, and without
 * one this page bounces to /login. The token itself never appears here.
 *
 * After the password is set, every other session is revoked server-side
 * (/api/auth/revoke-sessions, global sign-out), so a password change made
 * because "someone else might be in" actually ends that access. The caller is
 * logged out everywhere too, and signs back in with the new password.
 */
function UpdatePasswordForm() {
  const router = useRouter();
  const supabase = createClient();
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const user = data.user as unknown as {
        amr?: Array<{ method?: string } | string>;
      } | null;
      const amr = user?.amr ?? [];
      // A normal signed-in session must NOT reach this form: only a recovery
      // session (amr contains "recovery") may set the password here. Without
      // this gate, any logged-in user could change their password without
      // proving ownership of the emailed link.
      const isRecovery = amr.some((entry) =>
        typeof entry === "string"
          ? entry === "recovery"
          : entry?.method === "recovery"
      );
      if (!data.user || !isRecovery) {
        router.replace("/login?error=auth_callback_failed");
        return;
      }
      setChecking(false);
    });
  }, [router, supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (password.length < 8) {
      setErrorMsg("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setErrorMsg("The two passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        // Generic: the provider string distinguishes expired from malformed
        // sessions, which is information about token state, not the fix.
        setErrorMsg("Couldn't set the new password. Ask for a fresh link and try again.");
        setLoading(false);
        return;
      }
      // Revoke everything else (control 3). Uses the current access token —
      // the caller's own — to sign the account out globally. Awaited and
      // checked: a failed revoke must block the redirect and surface a retry
      // rather than promising a global logout that never happened.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) {
        let revoked = false;
        try {
          const res = await fetch("/api/auth/revoke-sessions", {
            method: "POST",
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          revoked = res.ok;
        } catch {
          revoked = false;
        }
        if (!revoked) {
          setErrorMsg(
            "Password updated, but other devices may still be signed in. Please retry — sign in with the new password, then use \"log out everywhere\" again."
          );
          setLoading(false);
          return;
        }
      }
      await supabase.auth.signOut();
      router.replace("/login?notice=password_updated");
    } finally {
      setLoading(false);
    }
  };

  if (checking) return <PageLoader label="Checking your link..." />;

  return (
    <AuthFrame
      intro={
        <p className="font-display text-2xl font-semibold leading-tight tracking-tight text-text-primary md:font-sans md:text-[15px] md:font-normal md:leading-6 md:tracking-normal md:text-text-secondary">
          Practice DSA with your people.
        </p>
      }
    >
      <div aria-live="polite" aria-atomic="true">
        {errorMsg && <AuthAlert tone="error">{errorMsg}</AuthAlert>}
      </div>
      <AuthCard>
        <h1 className="font-display text-xl font-semibold leading-7 tracking-tight">
          Choose a new password
        </h1>
        <p className="mt-1 text-sm leading-6 text-text-secondary">
          After this, every other signed-in device is logged out.
        </p>
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="new-password" className={authLabelCls}>
              New password
            </label>
            <div className="relative">
              <input
                id="new-password"
                autoComplete="new-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className={cn(authInputCls, "pr-11")}
                required
                minLength={8}
              />
              <PasswordToggle shown={showPassword} onToggle={() => setShowPassword((s) => !s)} />
            </div>
          </div>
          <div>
            <label htmlFor="confirm-password" className={authLabelCls}>
              Repeat it
            </label>
            <input
              id="confirm-password"
              autoComplete="new-password"
              type={showPassword ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Same password again"
              className={authInputCls}
              required
              minLength={8}
            />
          </div>
          <div className="pt-2">
            <Button type="submit" variant="primary" size="full" loading={loading} className="h-11 md:h-10">
              {!loading && "Set password and log out everywhere"}
            </Button>
          </div>
        </form>
      </AuthCard>
    </AuthFrame>
  );
}

export default function UpdatePasswordPage() {
  return (
    <Suspense fallback={<PageLoader label="Loading..." />}>
      <UpdatePasswordForm />
    </Suspense>
  );
}
