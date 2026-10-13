"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { PageLoader } from "@/components/ui/PageLoader";
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
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/login?error=auth_callback_failed");
        return;
      }
      setChecking(false);
    });
  }, [router, supabase]);

  const inputCls =
    "w-full min-h-[44px] rounded-md border border-hairline bg-well px-3 py-2.5 text-sm text-text-primary placeholder:text-text-disabled transition-colors hover:border-hairline-strong focus:border-hairline-strong focus:outline-none";

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
      // the caller's own — to sign the account out globally.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) {
        await fetch("/api/auth/revoke-sessions", {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
        }).catch(() => {});
      }
      await supabase.auth.signOut();
      router.replace("/login?notice=password_updated");
    } finally {
      setLoading(false);
    }
  };

  if (checking) return <PageLoader label="Checking your link..." />;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas p-4 text-text-primary select-none">
      <div className="w-full max-w-[440px]">
        <p className="mb-6 text-center font-display text-3xl font-semibold tracking-tight">
          Mahayuddh
        </p>
        <div className="rounded-xl border border-hairline bg-surface p-6 sm:p-8">
          <h1 className="font-display text-xl font-semibold">Choose a new password</h1>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            After this, every other signed-in device is logged out.
          </p>
          {errorMsg && (
            <div
              aria-live="polite"
              className="mt-4 rounded-md border border-error/30 bg-error-tint px-3 py-2.5 text-xs leading-5 text-error"
            >
              {errorMsg}
            </div>
          )}
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label htmlFor="new-password" className="mb-1.5 block pl-1 text-sm font-medium text-text-secondary">
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
                  className={cn(inputCls, "pr-16")}
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-pressed={showPassword}
                  className="absolute right-1 top-1/2 min-h-[44px] min-w-[44px] -translate-y-1/2 rounded-md px-2 text-xs font-medium text-text-secondary hover:text-text-primary"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="confirm-password" className="mb-1.5 block pl-1 text-sm font-medium text-text-secondary">
                Repeat it
              </label>
              <input
                id="confirm-password"
                autoComplete="new-password"
                type={showPassword ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Same password again"
                className={inputCls}
                required
                minLength={8}
              />
            </div>
            <Button type="submit" variant="primary" size="full" loading={loading} className="min-h-[44px]">
              {!loading && "Set password and log out everywhere"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function UpdatePasswordPage() {
  return (
    <Suspense fallback={<PageLoader label="Loading..." />}>
      <UpdatePasswordForm />
    </Suspense>
  );
}
