"use client";

import React, { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { Spinner } from "@/components/ui/Spinner";
import { PageLoader } from "@/components/ui/PageLoader";
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
      track("signup_completed", { via, next: nextPath, source: from ?? undefined });
    },
    [isChallengeSignup, nextPath]
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
          setErrorMsg(error.message);
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
          setErrorMsg(authError.message);
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
        <span className="text-xs text-white/40 font-medium">Entering Arena...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col justify-center items-center p-4 selection:bg-[#fa586a] selection:text-white relative overflow-hidden select-none">
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
          <p className="text-[11px] text-white/40 tracking-[0.22em] uppercase font-medium mt-3">
            Developer Squad Arena
          </p>
          <p className="text-xs text-white/50 mt-3 max-w-xs mx-auto leading-relaxed">
            Practice DSA with your people. Learn how they think. Challenge them. Get better together.
          </p>
          {/* Attribution is shown, not hidden. A visitor who arrived from a
              shared artifact should be able to see that we know it. */}
          {source && (
            <p className="text-[10px] text-white/25 mt-3 font-mono">
              arrived from {source}
            </p>
          )}
        </div>

        {/* ── Frosted Glass Auth Card ── */}
        <div className="bg-[#1c1c1e]/65 border border-white/[0.08] rounded-3xl p-6 sm:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.6),inset_0_0.5px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl">
          {/* Segmented Pill Switcher */}
          <div className="flex items-center p-1 bg-white/[0.04] rounded-full border border-white/[0.06] mb-6">
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setErrorMsg(null);
              }}
              className={cn(
                "flex-1 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer",
                mode === "signin"
                  ? "bg-white/[0.12] text-white shadow-sm"
                  : "text-white/40 hover:text-white/80"
              )}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setErrorMsg(null);
              }}
              className={cn(
                "flex-1 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer",
                mode === "signup"
                  ? "bg-white/[0.12] text-white shadow-sm"
                  : "text-white/40 hover:text-white/80"
              )}
            >
              Join Squad
            </button>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="mb-5 p-3 rounded-2xl bg-[#ff453a]/10 border border-[#ff453a]/25 text-[#ff453a] text-xs leading-relaxed">
              {errorMsg}
            </div>
          )}

          {/* Success Message */}
          {successMsg && (
            <div className="mb-5 p-3 rounded-2xl bg-[#30d158]/10 border border-[#30d158]/25 text-[#30d158] text-xs leading-relaxed">
              {successMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <>
                <div>
                  <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-1.5 pl-1">
                    Squad Member Name
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. Rahul"
                    className="w-full bg-white/[0.04] hover:bg-white/[0.06] focus:bg-white/[0.08] border border-white/[0.08] focus:border-[#fa586a]/60 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-[#fa586a]/30 transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-1.5 pl-1">
                    What are you here for? <span className="text-white/25 normal-case font-normal">(optional)</span>
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {OBJECTIVES.map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => setObjective(objective === o.value ? "" : o.value)}
                        aria-pressed={objective === o.value}
                        className={cn(
                          "px-2 py-2 rounded-xl border text-[11px] font-semibold transition-all cursor-pointer",
                          objective === o.value
                            ? "bg-[#fa586a]/20 border-[#fa586a]/60 text-white"
                            : "bg-white/[0.04] hover:bg-white/[0.06] border-white/[0.08] text-white/50 hover:text-white/80"
                        )}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-1.5 pl-1">
                    Start a squad <span className="text-white/25 normal-case font-normal">(optional — you can also join later)</span>
                  </label>
                  <input
                    type="text"
                    value={squadName}
                    onChange={(e) => setSquadName(e.target.value)}
                    placeholder="e.g. College DSA crew — leave blank to go solo"
                    className="w-full bg-white/[0.04] hover:bg-white/[0.06] focus:bg-white/[0.08] border border-white/[0.08] focus:border-[#fa586a]/60 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-[#fa586a]/30 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-1.5 pl-1">
                    LeetCode Username <span className="text-white/25 normal-case font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={leetcodeUsername}
                    onChange={(e) => setLeetcodeUsername(e.target.value)}
                    placeholder="e.g. rahul_dev — connect later if you skip"
                    className="w-full bg-white/[0.04] hover:bg-white/[0.06] focus:bg-white/[0.08] border border-white/[0.08] focus:border-[#fa586a]/60 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-[#fa586a]/30 transition-all font-mono"
                  />
                  <span className="text-[10px] text-white/30 mt-1.5 pl-1 block">
                    Optional. Adds contest rating + LeetCode evidence badges. Everything else works without it — connect anytime from the Arena.
                  </span>
                </div>
              </>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-1.5 pl-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@squad.dev"
                className="w-full bg-white/[0.04] hover:bg-white/[0.06] focus:bg-white/[0.08] border border-white/[0.08] focus:border-[#fa586a]/60 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-[#fa586a]/30 transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-1.5 pl-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white/[0.04] hover:bg-white/[0.06] focus:bg-white/[0.08] border border-white/[0.08] focus:border-[#fa586a]/60 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-[#fa586a]/30 transition-all"
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 mt-6 rounded-full bg-[#fa586a] hover:bg-[#fa586a]/90 active:scale-[0.99] text-white font-bold text-xs shadow-[0_0_24px_rgba(250,88,106,0.4)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
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
        <div className="mt-8 text-center text-[11px] text-white/30 tracking-wider">
          No LeetCode account needed to start. Solve your first battle in under 2 minutes.
        </div>
      </div>
    </div>
  );
}
