"use client";

import React, { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { MailCheck } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { PageLoader } from "@/components/ui/PageLoader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Button } from "@/components/ui/Button";
import { AvatarStack } from "@/components/ui/Avatar";
import {
  AuthAlert,
  AuthCard,
  AuthFrame,
  PasswordToggle,
  authInputCls,
  authLabelCls,
} from "@/components/auth/AuthChrome";
import { track, consumeSource, peekSource } from "@/lib/analytics";
import { safeNext } from "@/lib/safeNext";
import { cn } from "@/lib/utils";

// Objectives shape the Daily Battle "why" copy and the primer surface. They are
// an intent signal, not a skill assessment (plan Step 3: max 5 fields, no test).
const OBJECTIVES = [
  { value: "internship", label: "Internship prep" },
  { value: "fulltime", label: "Full-time roles" },
  { value: "consistency", label: "Daily consistency" },
] as const;

type Objective = (typeof OBJECTIVES)[number]["value"];

/**
 * Suspense wrapper: LoginForm reads ?next= via useSearchParams, which opts the
 * subtree into client rendering. Without this boundary `next build` cannot
 * prerender /login.
 */
export default function LoginPage() {
  return (
    <Suspense fallback={<PageLoader label="Loading..." />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const supabase = createClient();
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();

  // Where to land after auth. Middleware sets ?next= from the attempted route,
  // so a logged-out challenge-link visitor resumes at the battle (Bible §42).
  const nextPath = useMemo(
    () => safeNext(searchParams.get("next")) ?? "/home",
    [searchParams]
  );
  const isChallengeSignup = useMemo(
    () => nextPath.startsWith("/c/") || nextPath.startsWith("/squad/join/"),
    [nextPath]
  );

  // Loop D: arriving on an invite link. The squad is named on the signup form so
  // the account is created *for* something specific rather than in the hope that
  // something turns up afterwards. Only the code is read here — the join itself
  // happens on the invite page after the account exists.
  const inviteCode = useMemo(() => {
    const m = nextPath.match(/^\/squad\/join\/([A-Za-z0-9]{8})/);
    return m ? m[1].toUpperCase() : null;
  }, [nextPath]);

  // Invite arrivals land on Join (02 spec default), as does every "Start solo"
  // / "Join" link that says ?mode=signup; everyone else on Sign in.
  const [mode, setMode] = useState<"signin" | "signup">(
    inviteCode || searchParams.get("mode") === "signup" ? "signup" : "signin"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [leetcodeUsername, setLeetcodeUsername] = useState("");
  const [objective, setObjective] = useState<Objective | "">("");
  // Squad choice at signup is one tap, never a wizard step. "" = continue solo.
  const [squadName, setSquadName] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  // Password recovery is its own view, not a mode: it must not disturb the
  // Join/Sign-in segmented control or its defaults.
  const [authView, setAuthView] = useState<"form" | "reset">("form");
  const [resetSent, setResetSent] = useState(false);
  // Signup that needs email confirmation: the card swaps to "check your inbox".
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);
  const [, forceTick] = useState(0);

  // The invited squad's public card — the same one /squad/join/[code] shows a
  // logged-out visitor (name, member count, first few members). Deliberately
  // fetched WITHOUT ?ref=: the invite page already counted this open, and a
  // second count would double every referral that converts. A failed lookup
  // just leaves the banner on the bare code.
  const [invite, setInvite] = useState<{
    name: string;
    memberCount: number;
    members: { name: string; src: string | null }[];
  } | null>(null);
  useEffect(() => {
    if (!inviteCode) return;
    let cancelled = false;
    fetch(`/api/squads/preview/${inviteCode}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled || !json?.squad?.name) return;
        type Sample = { profile?: { username?: string; avatar_url?: string | null } | { username?: string; avatar_url?: string | null }[] };
        const members = ((json.sample_members ?? []) as Sample[])
          .map((m) => (Array.isArray(m.profile) ? m.profile[0] : m.profile))
          .filter((p): p is { username: string; avatar_url?: string | null } => !!p?.username)
          .map((p) => ({ name: p.username, src: p.avatar_url ?? null }));
        setInvite({
          name: String(json.squad.name),
          memberCount: Number(json.member_count) || 0,
          members,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [inviteCode]);

  /**
   * Login abuse friction (control 17).
   *
   * The real brute-force control lives in Supabase Auth (server-side rate
   * limits on its endpoints). This is the honest-browser layer on top: after
   * consecutive failures the form backs off (2s, 5s, 10s, 30s cap) so a casual
   * credential-stuffing script aimed at this page pays for every guess, while
   * a legitimate user who mistypes once notices nothing. Counts live in
   * localStorage (no account signal to query before authenticating, and no
   * server row worth creating for logged-out devices). Failures are also
   * counted in analytics — counter only, never the email or the cause.
   */
  const LOCK_KEY = "mahayuddh.signin_lock";
  const FAIL_KEY = "mahayuddh.signin_fails";
  const BACKOFF_SEC = [0, 0, 2, 5, 10, 30];
  function readLock(): { fails: number; until: number } {
    try {
      return {
        fails: parseInt(localStorage.getItem(FAIL_KEY) ?? "0", 10) || 0,
        until: parseInt(localStorage.getItem(LOCK_KEY) ?? "0", 10) || 0,
      };
    } catch {
      return { fails: 0, until: 0 };
    }
  }
  function recordSigninFailure() {
    try {
      const fails = (parseInt(localStorage.getItem(FAIL_KEY) ?? "0", 10) || 0) + 1;
      const delay = BACKOFF_SEC[Math.min(fails, BACKOFF_SEC.length - 1)];
      localStorage.setItem(FAIL_KEY, String(fails));
      if (delay > 0) localStorage.setItem(LOCK_KEY, String(Date.now() + delay * 1000));
    } catch {
      // Storage unavailable: the provider-side limits still hold.
    }
    track("signin_failed", {});
  }
  function clearSigninFailures() {
    try {
      localStorage.removeItem(FAIL_KEY);
      localStorage.removeItem(LOCK_KEY);
    } catch {
      // ignore
    }
  }
  function lockRemainingSec(): number {
    const { until } = readLock();
    return Math.max(0, Math.ceil((until - Date.now()) / 1000));
  }

  // If user is already logged in, redirect to the intended destination
  useEffect(() => {
    if (!authLoading && user) {
      window.location.replace(nextPath);
    }
  }, [user, authLoading, nextPath]);

  // One-shot notices from the auth flow (recovery bounce, password updated).
  // Read once: ?notice= survives in the address bar, so consuming it on mount
  // keeps a refresh from re-announcing.
  useEffect(() => {
    const err = searchParams.get("error");
    const notice = searchParams.get("notice");
    if (err === "auth_callback_failed") {
      setErrorMsg("That link didn't work — it may have expired. Ask for a fresh one.");
    } else if (notice === "password_updated") {
      setSuccessMsg("Password set. Every other device was logged out — sign in again.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Where this visit came from, if a shared artifact sent it (§56 Loop B).
  // Peeked for display, consumed at signup so one visit is credited once.
  const source = useMemo(() => peekSource(), []);

  // Fire the deep-link signup event the plan asks for (Step 2/Step 26 Loop A),
  // plus the Loop B attribution when a share link sent the visitor here.
  // Signup ONLY: a returning session is not a new account, so the sign-in
  // branch below fires signin_completed instead. Mixing the two made every
  // login look like growth.
  const trackSignupFromChallenge = useCallback(
    (via: string) => {
      const from = consumeSource();
      if (isChallengeSignup) {
        track("signup_from_challenge", { via, next: nextPath, source: from ?? undefined });
      }
      // §56 Loop B names this event explicitly: share_clicked on the way out,
      // share_signup on the way in. Without the second one, sharing is only
      // measurable up to the click and never as a conversion.
      if (from) {
        track("share_signup", { source: from, next: nextPath });
      }
      if (inviteCode) {
        track("invite_signup", { invite_code: inviteCode });
      }
      track("signup_completed", { via, next: nextPath, source: from ?? undefined });
    },
    [isChallengeSignup, nextPath, inviteCode]
  );

  // The sign-in half of the split: counted separately so the activation funnel
  // never mistakes a returning session for a new account. No attribution
  // events here — share_signup and invite_signup credit a signup, not a login.
  const trackSigninSuccess = useCallback(() => {
    track("signin_completed", { next: nextPath });
  }, [nextPath]);

  /**
   * Password recovery request (controls 4, 5, 12, 18).
   *
   * Token mechanics are provider-owned: Supabase issues a single-use,
   * short-lived recovery token and delivers it by email; the app never sees,
   * logs, or stores the token. What the app owns: (a) a generic response that
   * is identical whether the address has an account or not (no enumeration),
   * (b) a 60s resend cooldown so one tap cannot burn unbounded email cost,
   * (c) a counter-only telemetry event (never the address).
   *
   * Requires the Supabase dashboard redirect allowlist to include
   * `<site>/auth/callback`, which it already must for OAuth.
   */
  const RESET_COOLDOWN_KEY = "mahayuddh.reset_cooldown";
  const RESET_COOLDOWN_SEC = 60;
  function resetCooldownLeft(): number {
    try {
      const until = parseInt(localStorage.getItem(RESET_COOLDOWN_KEY) ?? "0", 10) || 0;
      return Math.max(0, Math.ceil((until - Date.now()) / 1000));
    } catch {
      return 0;
    }
  }
  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    const addr = email.trim();
    if (!addr || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr)) {
      setErrorMsg("Enter the email address you signed up with.");
      return;
    }
    if (resetCooldownLeft() > 0) {
      setErrorMsg(`A link was just sent. Wait ${resetCooldownLeft()} seconds before asking again.`);
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(addr, {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`,
      });
      // Generic either way: success and "no such account" are the same
      // sentence, and the provider error is never surfaced (it distinguishes
      // rate-limit from unknown-address, which is exactly the oracle).
      if (error) console.warn("reset request failed:", error.message);
      try {
        localStorage.setItem(RESET_COOLDOWN_KEY, String(Date.now() + RESET_COOLDOWN_SEC * 1000));
      } catch {
        // ignore
      }
      track("password_reset_requested", {});
      setResetSent(true);
      setSuccessMsg("If an account uses that email, a reset link is on its way. It expires soon and works once.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (mode === "signin") {
        if (lockRemainingSec() > 0) {
          setErrorMsg(
            `Too many attempts. Try again in ${lockRemainingSec()} seconds.`
          );
          setLoading(false);
          return;
        }
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          // Never surface the provider string verbatim: it names neither the
          // problem nor the fix, and "Invalid login credentials" used to be the
          // only thing a wrong password ever said.
          recordSigninFailure();
          const wait = BACKOFF_SEC[Math.min(readLock().fails, BACKOFF_SEC.length - 1)];
          setErrorMsg(
            /invalid/i.test(error.message)
              ? `That email and password don't match an account. Check for typos, or join the squad to create one.${wait > 0 ? ` Try again in ${wait} seconds.` : ""}`
              : "Sign in failed. Check your connection and try again."
          );
          setLoading(false);
          // Re-render so the lock countdown shows even without typing.
          if (wait > 0) {
            forceTick((t) => t + 1);
            setTimeout(() => forceTick((t) => t + 1), wait * 1000);
          }
          return;
        }

        if (data.session) {
          clearSigninFailures();
          trackSigninSuccess();
          window.location.replace(nextPath);
          return;
        }
      } else {
        // Sign Up — hoist field values so edits mid-flight can't swap handles.
        // LeetCode handle is OPTIONAL (Bible §43): the app must work without it.
        // NOTE: squadName state (the "Start a squad" field) is the squad name.
        // It must never be derived from username — that shadowing bug named
        // every new squad after the person's handle.
        const handle = username.trim();
        const newSquadName = squadName.trim();
        const lcHandle = leetcodeUsername.trim();
        const emailAddr = email.trim();
        if (!handle) {
          setErrorMsg("Please provide a squad username.");
          setLoading(false);
          return;
        }

        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: emailAddr,
          password,
          options: {
            data: {
              username: handle,
              leetcode_username: lcHandle,
            },
          },
        });

        if (authError) {
          /**
           * No enumeration.
           *
           * "An account already uses that email" answers the question "does this
           * address have an account here?" for anyone who asks, which turns the
           * signup form into an account-existence oracle for any address they
           * know. The messages below are identical for "already registered",
           * a malformed address, and a provider outage: the user is told the
           * signup did not complete and pointed at the one action that works
           * either way (sign in). The genuine already-has-an-account case is not
           * lost — the sign-in path returns its own generic failure, and the
           * provider's own confirmation email tells them the truth.
           */
          setErrorMsg(
            "Couldn't create the account. Check the email format, or sign in if you already have one."
          );
          setLoading(false);
          return;
        }

        if (authData.user) {
          // Profile row is created server-side via /api/auth/profile (service role),
          // so this browser flow never touches LeetCode GraphQL (CORS-blocked)
          // or writes to profiles with the anon key (RLS 401).
          // ponytail: no pre-signup LeetCode handle validation; add server-side
          // handle check when instant-handle-feedback matters.
          if (authData.session) {
            try {
              const profileRes = await fetch("/api/auth/profile", {
                method: "POST",
                headers: { Authorization: `Bearer ${authData.session.access_token}` },
              });
              if (!profileRes.ok) {
                setErrorMsg("Account created but profile setup failed. Please sign in to retry.");
                setLoading(false);
                return;
              }
              // Optional handle: only sync when provided. Skipping never blocks entry.
              if (lcHandle) {
                const syncRes = await fetch("/api/sync/leetcode", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${authData.session.access_token}`,
                  },
                  body: JSON.stringify({ username: lcHandle }),
                });
                if (!syncRes.ok) {
                  console.warn("Post-signup LeetCode sync failed; background sync will retry.");
                }
              }
            } catch (syncErr) {
              console.warn("Post-signup sync failed; background sync will retry:", syncErr);
            }

            // Optional squad creation from the "Start a squad" field.
            // Failure must never block the first battle: the user can create
            // or join a squad later from /squad.
            let squadCreated = false;
            let createdSquadId: string | null = null;
            if (newSquadName) {
              try {
                const squadRes = await fetch("/api/squads", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${authData.session.access_token}`,
                  },
                  body: JSON.stringify({ name: newSquadName }),
                });
                squadCreated = squadRes.ok;
                if (squadRes.ok) {
                  const squadJson = await squadRes.json().catch(() => ({}));
                  const sid = (squadJson as { squad?: { id?: unknown } })?.squad?.id;
                  createdSquadId = typeof sid === "string" ? sid : null;
                  track("squad_created", {
                    via: "signup",
                    ...(createdSquadId ? { squad_id: createdSquadId } : {}),
                  });
                } else {
                  console.warn("Squad creation failed; user can create one later from /squad.");
                }
              } catch (squadErr) {
                console.warn("Squad creation failed; user can create one later:", squadErr);
              }
            }

            trackSignupFromChallenge(squadCreated ? "password_signup_squad" : "password_signup");

            // Plan Step 3: land on the first battle, never on a profile wall.
            if (objective) {
              try {
                await fetch("/api/auth/profile", {
                  method: "PATCH",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${authData.session.access_token}`,
                  },
                  body: JSON.stringify({ objective }),
                });
              } catch (objErr) {
                console.warn("Objective save failed; non-blocking:", objErr);
              }
            }
            window.location.replace(nextPath);
            return;
          } else {
            setConfirmEmail(emailAddr);
            setLoading(false);
          }
        } else {
          setErrorMsg("Signup did not return a user. Please try signing in.");
          setLoading(false);
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred.";
      setErrorMsg(message);
      setLoading(false);
    }
  };

  // If already logged in, show sleek loader while redirecting
  if (!authLoading && user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-canvas">
        <Spinner size="xl" />
        <span className="text-xs font-medium text-text-secondary">Entering Arena...</span>
      </div>
    );
  }

  const joining = mode === "signup";
  const trimmedSquad = squadName.trim();
  const primaryLabel =
    mode === "signin"
      ? "Sign in"
      : inviteCode
        ? invite
          ? `Join ${invite.name}`
          : "Join squad"
        : trimmedSquad
          ? `Start ${trimmedSquad}`
          : "Start practicing";

  const clearForMode = (next: "signin" | "signup") => {
    setMode(next);
    setConfirmEmail(null);
  };

  return (
    <AuthFrame
      intro={
        <>
          {/* One heading, two looks: the frame's mobile headline, the desktop tagline. */}
          <h1 className="font-display text-2xl font-semibold leading-tight tracking-tight text-text-primary md:font-sans md:text-[15px] md:font-normal md:leading-6 md:tracking-normal md:text-text-secondary">
            Practice DSA with your people.
          </h1>
          <p className="mt-1 text-xs leading-5 text-text-secondary md:hidden">
            One problem a day, timed and verified together.
          </p>
          {source && (
            <p className="mt-2 font-mono text-xs text-text-tertiary">arrived from {source}</p>
          )}
        </>
      }
    >
      {inviteCode && joining && (
        <div className="mb-4 rounded-lg border border-hairline bg-surface-raised p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] md:p-3.5">
          <div className="flex items-center gap-3">
            {invite && invite.members.length > 0 && (
              <AvatarStack people={invite.members} className="shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-text-primary md:text-[13px]">
                You were invited to{" "}
                {invite ? <span className="text-primary">{invite.name}</span> : "join a squad"}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] leading-4 text-text-secondary md:text-xs">
                {invite && (
                  <>
                    <span className="tnum">
                      {invite.memberCount} member{invite.memberCount === 1 ? "" : "s"}
                    </span>
                    <span aria-hidden className="text-text-disabled">
                      ·
                    </span>
                  </>
                )}
                <span className="font-mono tnum">Code {inviteCode}</span>
              </p>
            </div>
          </div>
          <p className="mt-2 text-xs leading-5 text-text-secondary">
            Create your account and you land straight on the invite, ready to join.
          </p>
        </div>
      )}

      <div aria-live="polite" aria-atomic="true">
        {errorMsg && (
          <AuthAlert tone="error">
            {errorMsg}
            {/already|sign in/i.test(errorMsg) && mode === "signup" && authView === "form" && (
              <>
                {" "}
                <button
                  type="button"
                  onClick={() => clearForMode("signin")}
                  className="font-medium underline underline-offset-2 hover:text-text-primary"
                >
                  Sign in instead
                </button>
              </>
            )}
          </AuthAlert>
        )}
        {successMsg && <AuthAlert tone="success">{successMsg}</AuthAlert>}
      </div>

      {authView === "reset" ? (
        <AuthCard>
          <h2 className="font-display text-xl font-semibold leading-7 tracking-tight">
            Reset your password
          </h2>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            One link by email. It expires soon and works once.
          </p>
          {!resetSent && (
            <form onSubmit={handleResetRequest} className="mt-5 space-y-4">
              <div>
                <label htmlFor="reset-email" className={authLabelCls}>
                  Email
                </label>
                <input
                  id="reset-email"
                  name="reset-email"
                  autoComplete="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@squad.dev"
                  className={authInputCls}
                  required
                />
              </div>
              <div className="pt-2">
                <Button type="submit" variant="primary" size="full" loading={loading} className="h-11 md:h-10">
                  {!loading && "Send reset link"}
                </Button>
              </div>
            </form>
          )}
          <button
            type="button"
            onClick={() => {
              setAuthView("form");
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className="mt-4 min-h-[44px] w-full text-center text-xs font-medium text-text-secondary underline underline-offset-4 transition-colors hover:text-text-primary"
          >
            Back to sign in
          </button>
        </AuthCard>
      ) : (
        <>
          <AuthCard>
            <div className="mb-4 md:mb-6">
              <SegmentedControl
                label="Sign in or join"
                className="max-md:h-auto"
                value={mode}
                onChange={(v) => {
                  clearForMode(v);
                  setErrorMsg(null);
                }}
                options={[
                  { value: "signin", label: "Sign in" },
                  { value: "signup", label: "Join" },
                ]}
              />
            </div>

            {confirmEmail ? (
              <div role="status" className="space-y-4 py-4 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-verified/30 bg-verified-tint text-verified">
                  <MailCheck className="h-6 w-6" strokeWidth={1.5} aria-hidden />
                </span>
                <div>
                  <h2 className="font-display text-xl font-semibold tracking-tight">Check your inbox</h2>
                  <p className="mt-1 text-sm leading-6 text-text-secondary">
                    Account created. We sent a confirmation link to
                  </p>
                  <p className="mt-0.5 break-all font-mono text-sm font-medium text-primary">
                    {confirmEmail}
                  </p>
                </div>
                <p className="rounded-md border border-hairline bg-well p-3 text-left text-xs leading-relaxed text-text-tertiary">
                  Open it to confirm your account. Your squad profile and LeetCode stats sync on
                  first sign-in.
                </p>
                <button
                  type="button"
                  onClick={() => setConfirmEmail(null)}
                  className="min-h-[44px] text-xs font-medium text-text-secondary transition-colors hover:text-text-primary hover:underline"
                >
                  Use a different email
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {joining && (
                  <>
                    <div>
                      <label htmlFor="username" className={authLabelCls}>
                        Your name
                      </label>
                      <input
                        id="username"
                        name="username"
                        autoComplete="username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Meera Rao"
                        className={authInputCls}
                        required
                      />
                    </div>

                    <fieldset className="m-0 border-0 p-0">
                      <legend className={cn(authLabelCls, "p-0")}>What are you practicing for?</legend>
                      <div className="flex flex-wrap gap-1.5">
                        {OBJECTIVES.map((o) => (
                          <button
                            key={o.value}
                            type="button"
                            onClick={() => setObjective(objective === o.value ? "" : o.value)}
                            aria-pressed={objective === o.value}
                            className={cn(
                              "inline-flex h-11 cursor-pointer items-center rounded-full border px-3 text-xs font-medium transition-colors md:h-8",
                              objective === o.value
                                ? "border-hairline-strong bg-surface-overlay text-text-primary"
                                : "border-hairline bg-transparent text-text-secondary hover:bg-surface-raised hover:text-text-primary"
                            )}
                          >
                            {o.label}
                          </button>
                        ))}
                      </div>
                    </fieldset>

                    <div>
                      {inviteCode ? (
                        <>
                          <p className={authLabelCls}>Squad</p>
                          <div className="flex h-11 items-center justify-between gap-2 rounded-md border border-hairline bg-well pl-3 md:h-10">
                            <span className="flex min-w-0 items-center gap-2 text-xs font-medium text-text-primary">
                              <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-verified" />
                              <span className="truncate">
                                Joining{" "}
                                {invite ? (
                                  <span className="font-semibold">{invite.name}</span>
                                ) : (
                                  <>
                                    with code <span className="font-mono tnum">{inviteCode}</span>
                                  </>
                                )}
                              </span>
                            </span>
                            <Link
                              href="/login"
                              className="inline-flex min-h-[44px] items-center px-3 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary hover:underline md:min-h-0"
                            >
                              Change
                            </Link>
                          </div>
                        </>
                      ) : (
                        <>
                          <label htmlFor="squadName" className={authLabelCls}>
                            Start a squad <span className="font-normal text-text-tertiary">(optional)</span>
                          </label>
                          <input
                            id="squadName"
                            name="squadName"
                            type="text"
                            value={squadName}
                            onChange={(e) => setSquadName(e.target.value)}
                            placeholder="e.g. Night Owls"
                            className={authInputCls}
                          />
                          <p className="mt-1 text-[11px] leading-4 text-text-tertiary">
                            Skip it to practice solo. You can start or join one later.
                          </p>
                        </>
                      )}
                    </div>

                    <div>
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <label htmlFor="leetcodeUsername" className="block text-xs font-medium text-text-secondary">
                          LeetCode username <span className="font-normal text-text-tertiary">(optional)</span>
                        </label>
                        <span className="flex shrink-0 items-center gap-1 font-mono text-[11px] text-verified">
                          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-verified" />
                          auto-sync
                        </span>
                      </div>
                      <div className="relative">
                        <span
                          aria-hidden
                          className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 font-mono text-xs text-text-tertiary"
                        >
                          @
                        </span>
                        <input
                          id="leetcodeUsername"
                          name="leetcodeUsername"
                          autoComplete="off"
                          type="text"
                          value={leetcodeUsername}
                          onChange={(e) => setLeetcodeUsername(e.target.value)}
                          placeholder="meera_codes"
                          className={cn(authInputCls, "pl-7 font-mono")}
                        />
                      </div>
                      <p className="mt-1 text-[11px] leading-4 text-text-tertiary">
                        Everything works without it. Connecting lets us verify your solves.
                      </p>
                    </div>
                  </>
                )}

                <div>
                  <label htmlFor="email" className={authLabelCls}>
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    autoComplete="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@squad.dev"
                    className={authInputCls}
                    required
                  />
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <label htmlFor="password" className="block text-xs font-medium text-text-secondary">
                      Password
                    </label>
                    {mode === "signin" && (
                      <button
                        type="button"
                        onClick={() => {
                          setAuthView("reset");
                          setErrorMsg(null);
                          setSuccessMsg(null);
                          setResetSent(false);
                        }}
                        className="-my-3 inline-flex min-h-[44px] items-center text-xs font-medium text-text-secondary transition-colors hover:text-text-primary hover:underline md:my-0 md:min-h-0"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      autoComplete={mode === "signin" ? "current-password" : "new-password"}
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

                <div className="pt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    size="full"
                    loading={loading}
                    className="h-11 md:h-10"
                  >
                    {!loading && primaryLabel}
                  </Button>
                </div>
              </form>
            )}
          </AuthCard>

          <p className="mt-6 text-center text-xs leading-5 text-text-secondary">
            {mode === "signin" ? (
              <>
                New here?{" "}
                <button
                  type="button"
                  onClick={() => clearForMode("signup")}
                  className="min-h-[44px] font-medium text-text-primary underline underline-offset-4 transition-colors hover:text-primary"
                >
                  Join
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => clearForMode("signin")}
                  className="min-h-[44px] font-medium text-text-primary underline underline-offset-4 transition-colors hover:text-primary"
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </>
      )}

      <p className="mt-6 text-center font-mono text-[11px] leading-4 text-text-tertiary md:mt-12">
        <span>No LeetCode password stored</span>
        <span aria-hidden className="mx-2 hidden sm:inline">
          ·
        </span>
        <span className="block sm:inline">Works without LeetCode</span>
      </p>
    </AuthFrame>
  );
}
