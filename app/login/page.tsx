"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Lock,
  Mail,
  User as UserIcon,
  Code2,
  ArrowRight,
  Loader2,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchLeetCodeProfile, fetchUserCalendar } from "@/lib/leetcode";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [leetcodeUsername, setLeetcodeUsername] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          setErrorMsg(error.message);
          return;
        }

        router.push("/");
        router.refresh();
      } else {
        // Sign Up
        if (!username || !leetcodeUsername) {
          setErrorMsg("Please provide both Squad username and LeetCode handle.");
          return;
        }

        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username,
              leetcode_username: leetcodeUsername,
            },
          },
        });

        if (authError) {
          setErrorMsg(authError.message);
          return;
        }

        if (authData.user) {
          // Fetch initial LeetCode stats
          let contestRating = 1500;
          let streak = 0;
          let easy = 0;
          let medium = 0;
          let hard = 0;

          try {
            const [lcProfile, lcCalendar] = await Promise.all([
              fetchLeetCodeProfile(leetcodeUsername),
              fetchUserCalendar(leetcodeUsername),
            ]);

            if (lcProfile) {
              contestRating = lcProfile.contestRating || 1500;
              easy = lcProfile.totalEasy || 0;
              medium = lcProfile.totalMedium || 0;
              hard = lcProfile.totalHard || 0;
            }
            if (lcCalendar) {
              streak = lcCalendar.streak || 0;
            }
          } catch (fetchErr) {
            console.warn("Could not pre-fetch LeetCode stats:", fetchErr);
          }

          // Insert or update profile in public.profiles
          const { error: profileError } = await supabase.from("profiles").upsert({
            id: authData.user.id,
            username: username.trim(),
            leetcode_username: leetcodeUsername.trim(),
            contest_rating: contestRating,
            streak: streak,
            total_easy: easy,
            total_medium: medium,
            total_hard: hard,
          });

          if (profileError) {
            console.error("Profile creation warning:", profileError);
          }

          if (authData.session) {
            router.push("/");
            router.refresh();
          } else {
            setSuccessMsg("Account created! Please check your email to confirm your account.");
          }
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred.";
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: "github" | "google") => {
    setErrorMsg(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) setErrorMsg(error.message);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "OAuth error.";
      setErrorMsg(message);
    }
  };

  return (
    <div className="min-h-screen bg-surface-base flex flex-col justify-center items-center p-4 selection:bg-apple-accent selection:text-white">
      {/* Background ambient glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-apple-accent/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-apple-accent text-white text-2xl font-black shadow-glow mb-4">
            ⚔️
          </div>
          <h1 className="text-2xl font-extrabold text-txt-primary tracking-tight">
            Mahayuddh
          </h1>
          <p className="text-xs text-txt-secondary mt-1">
            Private DSA Arena for High-Performance Developer Squads
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-surface-sidebar border border-border-subtle rounded-3xl p-6 sm:p-8 shadow-modal backdrop-blur-xl">
          {/* Segmented Mode Switcher */}
          <div className="flex items-center p-1 bg-surface-base rounded-pill border border-border-subtle mb-6">
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setErrorMsg(null);
              }}
              className={cn(
                "flex-1 py-2 rounded-pill text-xs font-semibold transition-all",
                mode === "signin"
                  ? "bg-apple-accent text-white shadow-sm"
                  : "text-txt-secondary hover:text-txt-primary"
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
                "flex-1 py-2 rounded-pill text-xs font-semibold transition-all",
                mode === "signup"
                  ? "bg-apple-accent text-white shadow-sm"
                  : "text-txt-secondary hover:text-txt-primary"
              )}
            >
              Join Squad
            </button>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-apple-red/10 border border-apple-red/30 text-apple-red text-xs">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 rounded-xl bg-apple-green/10 border border-apple-green/30 text-apple-green text-xs">
              {successMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <>
                <div>
                  <label className="block text-[11px] font-semibold text-txt-secondary uppercase tracking-wider mb-1.5">
                    Squad Member Name
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-txt-tertiary absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. rahul"
                      className="w-full bg-surface-muted border border-border-subtle rounded-xl pl-10 pr-3 py-2.5 text-xs text-txt-primary placeholder:text-txt-tertiary focus:outline-none focus:border-apple-accent"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-txt-secondary uppercase tracking-wider mb-1.5">
                    LeetCode Username
                  </label>
                  <div className="relative">
                    <Code2 className="w-4 h-4 text-txt-tertiary absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={leetcodeUsername}
                      onChange={(e) => setLeetcodeUsername(e.target.value)}
                      placeholder="e.g. rahul_leetcode"
                      className="w-full bg-surface-muted border border-border-subtle rounded-xl pl-10 pr-3 py-2.5 text-xs text-txt-primary placeholder:text-txt-tertiary focus:outline-none focus:border-apple-accent font-mono"
                      required
                    />
                  </div>
                  <span className="text-[10px] text-txt-tertiary mt-1 block">
                    Used to synchronize contest rating, streaks, and submissions.
                  </span>
                </div>
              </>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-txt-secondary uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-txt-tertiary absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@squad.dev"
                  className="w-full bg-surface-muted border border-border-subtle rounded-xl pl-10 pr-3 py-2.5 text-xs text-txt-primary placeholder:text-txt-tertiary focus:outline-none focus:border-apple-accent"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-txt-secondary uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-txt-tertiary absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-surface-muted border border-border-subtle rounded-xl pl-10 pr-3 py-2.5 text-xs text-txt-primary placeholder:text-txt-tertiary focus:outline-none focus:border-apple-accent"
                  required
                  minLength={6}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-pill bg-apple-accent hover:opacity-90 text-white font-bold text-xs shadow-glow transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-6 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{mode === "signin" ? "Authenticating..." : "Joining Squad..."}</span>
                </>
              ) : (
                <>
                  <span>{mode === "signin" ? "Enter Arena" : "Create Account & Sync"}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Social Auth Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border-subtle" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase">
              <span className="bg-surface-sidebar px-2 text-txt-tertiary font-semibold">
                Or Continue With
              </span>
            </div>
          </div>

          {/* OAuth Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleOAuthSignIn("github")}
              className="py-2.5 px-3 bg-surface-base hover:bg-surface-raised border border-border-subtle rounded-xl text-xs font-semibold text-txt-primary transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              <span>GitHub</span>
            </button>

            <button
              type="button"
              onClick={() => handleOAuthSignIn("google")}
              className="py-2.5 px-3 bg-surface-base hover:bg-surface-raised border border-border-subtle rounded-xl text-xs font-semibold text-txt-primary transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span>Google</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-txt-tertiary flex items-center justify-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-apple-accent" />
          <span>Squad LeetCode Leaderboard & Roadmaps</span>
        </div>
      </div>
    </div>
  );
}
