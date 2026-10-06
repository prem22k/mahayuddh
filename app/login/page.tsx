"use client";

import React, { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { Spinner } from "@/components/ui/Spinner";
import { PageLoader } from "@/components/ui/PageLoader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
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

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [leetcodeUsername, setLeetcodeUsername] = useState("");
  const [objective, setObjective] = useState<Objective | "">("");
  // Squad choice at signup is one tap, never a wizard step. "" = continue solo.
  const [squadName, setSquadName] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // If user is already logged in, redirect to the intended destination
  useEffect(() => {
    if (!authLoading && user) {
      window.location.replace(nextPath);
    }
  }, [user, authLoading, nextPath]);

  // Where this visit came from, if a shared artifact sent it (§56 Loop B).
  // Peeked for display, consumed at signup so one visit is credited once.
  const source = useMemo(() => peekSource(), []);

  // Fire the deep-link signup event the plan asks for (Step 2/Step 26 Loop A),
  // plus the Loop B attribution when a share link sent the visitor here.
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (mode === "signin") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          // Never surface the provider string verbatim: it names neither the
          // problem nor the fix, and "Invalid login credentials" used to be the
          // only thing a wrong password ever said.
          setErrorMsg(
            /invalid/i.test(error.message)
              ? "That email and password don't match an account. Check for typos, or join the squad to create one."
              : "Sign in failed. Check your connection and try again."
          );
          setLoading(false);
          return;
        }

        if (data.session) {
          trackSignupFromChallenge("password_signin");
          window.location.replace(nextPath);
          return;
        }
      } else {
        // Sign Up — hoist field values so edits mid-flight can't swap handles.
        // LeetCode handle is OPTIONAL (Bible §43): the app must work without it.
        const squadName = username.trim();
        const lcHandle = leetcodeUsername.trim();
        const emailAddr = email.trim();
        if (!squadName) {
          setErrorMsg("Please provide a squad username.");
          setLoading(false);
          return;
        }

        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: emailAddr,
          password,
          options: {
            data: {
              username: squadName,
              leetcode_username: lcHandle,
            },
          },
        });

        if (authError) {
          setErrorMsg(
            /already registered|already exists/i.test(authError.message)
              ? "An account already uses that email. Sign in instead, or reset the password."
              : "Couldn't create the account. Check the email format and try again."
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

            // Optional squad creation. Failure must never block the first battle:
            // the user can create or join a squad later from /squad.
            let squadCreated = false;
            if (squadName) {
              try {
                const squadRes = await fetch("/api/squads", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${authData.session.access_token}`,
                  },
                  body: JSON.stringify({ name: squadName }),
                });
                squadCreated = squadRes.ok;
                if (!squadRes.ok) {
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
            setSuccessMsg("Account created! Check your email to confirm your account. Your squad profile and LeetCode stats sync on first sign-in.");
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
      <div className="min-h-screen bg-black flex flex-col justify-center items-center gap-3">
        <Spinner size="xl" />
        <span className="text-xs text-white/55 font-medium">Entering Arena...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col justify-center items-center p-4 selection:bg-[var(--accent-strong)] selection:text-white relative overflow-hidden select-none">
      {/* ── Apple Music ambient liquid glow backdrops ── */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/4 w-[600px] h-[600px] bg-[#fa586a]/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-1/4 right-1/3 w-[450px] h-[450px] bg-[#5856d6]/8 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* ── Stylish Logo Wordmark Header ── */}
        <div className="text-center mb-8">
          <div className="inline-block relative">
            <h1 className="text-4xl sm:text-5xl font-black tracking-[-0.04em] text-white">
              Mahayuddh
              <span className="text-[#fa586a] drop-shadow-[0_0_18px_rgba(250,88,106,0.85)]">
                .
              </span>
            </h1>
            <div className="h-[2px] w-14 bg-gradient-to-r from-[#fa586a] via-[#fa586a]/60 to-transparent mx-auto mt-2.5 rounded-full" />
          </div>
          <p className="text-[11px] text-white/55 tracking-[0.22em] uppercase font-medium mt-3">
            Developer Squad Arena
          </p>
          <p className="text-xs text-white/50 mt-3 max-w-xs mx-auto leading-relaxed">
            Practice DSA with your people. Learn how they think. Challenge them. Get better together.
          </p>
          {/* Attribution is shown, not hidden. A visitor who arrived from a
              shared artifact should be able to see that we know it. */}
          {source && (
            <p className="text-[10px] text-white/55 mt-3 font-mono">
              arrived from {source}
            </p>
          )}
        </div>

        {/* ── Frosted Glass Auth Card ── */}
        <div className="bg-[#1c1c1e]/65 border border-white/[0.08] rounded-3xl p-6 sm:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.6),inset_0_0.5px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl">
          {/* Segmented Pill Switcher */}
          <div className="mb-6">
            <SegmentedControl
              label="Sign in or create an account"
              value={mode}
              onChange={(v) => {
                setMode(v);
                setErrorMsg(null);
              }}
              options={[
                { value: "signin", label: "Sign In" },
                { value: "signup", label: "Join Squad" },
              ]}
            />
          </div>

          {/* Loop D: arriving on an invite link. Names the squad so the account
              is created for something specific, and says plainly that the join
              happens next — no pretending it already happened. */}
          {inviteCode && mode === "signup" && (
            <div className="mb-5 p-3 rounded-2xl bg-[#fa586a]/10 border border-[#fa586a]/25 space-y-0.5">
              <p className="text-xs font-bold text-[#fa586a]">
                You were invited to a squad
              </p>
              <p className="text-[11px] text-white/50">
                Create your account and you&apos;ll land straight on the invite for squad{" "}
                <span className="font-mono text-white/70">{inviteCode}</span>, ready to join.
              </p>
            </div>
          )}

          {/* Error + success share one persistent live region: a node that only
              mounts when the message appears is frequently missed by screen
              readers, which is the one moment the copy matters most. */}
          <div aria-live="polite" aria-atomic="true">
            {errorMsg && (
              <div className="mb-5 p-3 rounded-2xl bg-[#ff453a]/10 border border-[#ff453a]/25 text-[#ff453a] text-xs leading-relaxed">
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="mb-5 p-3 rounded-2xl bg-[#30d158]/10 border border-[#30d158]/25 text-[#30d158] text-xs leading-relaxed">
                {successMsg}
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <>
                <div>
                  <label htmlFor="username" className="block text-[11px] font-semibold text-white/60 uppercase tracking-wider mb-1.5 pl-1">
                    Squad Member Name
                  </label>
                  <input
                    id="username"
                    name="username"
                    autoComplete="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. Rahul"
                    className="w-full min-h-11 bg-white/[0.04] hover:bg-white/[0.06] focus:bg-white/[0.08] border border-white/[0.08] focus:border-[#fa586a]/60 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-white/55 transition-colors"
                    required
                  />
                </div>

                <div>
                  <fieldset className="border-0 p-0 m-0">
                  <legend className="block text-[11px] font-semibold text-white/60 uppercase tracking-wider mb-1.5 pl-1">
                    What are you here for? <span className="text-white/55 normal-case font-normal">(optional)</span>
                  </legend>
                  <div className="grid grid-cols-3 gap-1.5">
                    {OBJECTIVES.map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => setObjective(objective === o.value ? "" : o.value)}
                        aria-pressed={objective === o.value}
                        className={cn(
                          "min-h-11 px-2 py-2 rounded-xl border text-[11px] font-semibold transition-colors cursor-pointer",
                          objective === o.value
                            ? "btn-accent border-[#fa586a]/60 text-white"
                            : "bg-white/[0.04] hover:bg-white/[0.06] border-white/[0.08] text-white/50 hover:text-white/80"
                        )}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                  </fieldset>
                </div>

                <div>
                  <label htmlFor="squadName" className="block text-[11px] font-semibold text-white/60 uppercase tracking-wider mb-1.5 pl-1">
                    Start a squad <span className="text-white/55 normal-case font-normal">(optional — you can also join later)</span>
                  </label>
                  <input
                    id="squadName"
                    name="squadName"
                    type="text"
                    value={squadName}
                    onChange={(e) => setSquadName(e.target.value)}
                    placeholder="e.g. College DSA crew — leave blank to go solo"
                    className="w-full min-h-11 bg-white/[0.04] hover:bg-white/[0.06] focus:bg-white/[0.08] border border-white/[0.08] focus:border-[#fa586a]/60 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-white/55 transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="leetcodeUsername" className="block text-[11px] font-semibold text-white/60 uppercase tracking-wider mb-1.5 pl-1">
                    LeetCode Username <span className="text-white/55 normal-case font-normal">(optional)</span>
                  </label>
                  <input
                    id="leetcodeUsername"
                    name="leetcodeUsername"
                    autoComplete="off"
                    type="text"
                    value={leetcodeUsername}
                    onChange={(e) => setLeetcodeUsername(e.target.value)}
                    placeholder="e.g. rahul_dev — connect later if you skip"
                    className="w-full min-h-11 bg-white/[0.04] hover:bg-white/[0.06] focus:bg-white/[0.08] border border-white/[0.08] focus:border-[#fa586a]/60 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-white/55 transition-colors font-mono"
                  />
                  <span className="text-[10px] text-white/50 mt-1.5 pl-1 block">
                    Optional. Adds contest rating + LeetCode evidence badges. Everything else works without it — connect anytime from the Arena.
                  </span>
                </div>
              </>
            )}

            <div>
              <label htmlFor="email" className="block text-[11px] font-semibold text-white/60 uppercase tracking-wider mb-1.5 pl-1">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                autoComplete="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@squad.dev"
                className="w-full min-h-11 bg-white/[0.04] hover:bg-white/[0.06] focus:bg-white/[0.08] border border-white/[0.08] focus:border-[#fa586a]/60 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-white/55 transition-colors"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-[11px] font-semibold text-white/60 uppercase tracking-wider mb-1.5 pl-1">
                Password
              </label>
              <input
                id="password"
                name="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full min-h-11 bg-white/[0.04] hover:bg-white/[0.06] focus:bg-white/[0.08] border border-white/[0.08] focus:border-[#fa586a]/60 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-white/55 transition-colors"
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-11 py-3 mt-6 rounded-full btn-accent active:scale-[0.99] text-white font-bold text-xs shadow-[0_0_24px_rgba(250,88,106,0.4)] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <Spinner size="md" tone="inverse" className="border-white/20" />
              ) : (
                <span>{mode === "signin" ? "Enter Arena" : "Create Account"}</span>
              )}
            </button>
          </form>
        </div>

        {/* ── Subtitle Footer ── */}
        <div className="mt-8 text-center text-[11px] text-white/50 tracking-wider">
          No LeetCode account needed to start. Solve your first battle in under 2 minutes.
        </div>
      </div>
    </div>
  );
}
