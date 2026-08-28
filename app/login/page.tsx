"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
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
        if (!username.trim() || !leetcodeUsername.trim()) {
          setErrorMsg("Please provide both Squad username and LeetCode handle.");
          return;
        }

        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: username.trim(),
              leetcode_username: leetcodeUsername.trim(),
            },
          },
        });

        if (authError) {
          setErrorMsg(authError.message);
          return;
        }

        if (authData.user) {
          let contestRating = 1500;
          let streak = 0;
          let easy = 0;
          let medium = 0;
          let hard = 0;

          try {
            const [lcProfile, lcCalendar] = await Promise.all([
              fetchLeetCodeProfile(leetcodeUsername.trim()),
              fetchUserCalendar(leetcodeUsername.trim()),
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
            setSuccessMsg("Account created! Check your email to confirm your account.");
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
                    LeetCode Username
                  </label>
                  <input
                    type="text"
                    value={leetcodeUsername}
                    onChange={(e) => setLeetcodeUsername(e.target.value)}
                    placeholder="e.g. rahul_dev"
                    className="w-full bg-white/[0.04] hover:bg-white/[0.06] focus:bg-white/[0.08] border border-white/[0.08] focus:border-[#fa586a]/60 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-[#fa586a]/30 transition-all font-mono"
                    required
                  />
                  <span className="text-[10px] text-white/30 mt-1.5 pl-1 block">
                    Used to synchronize contest rating, streaks, and problem submissions.
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
                <div className="w-4 h-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              ) : (
                <span>{mode === "signin" ? "Enter Arena" : "Create Account & Sync"}</span>
              )}
            </button>
          </form>
        </div>

        {/* ── Subtitle Footer ── */}
        <div className="mt-8 text-center text-[11px] text-white/30 tracking-wider">
          Squad LeetCode Leaderboard & Roadmaps
        </div>
      </div>
    </div>
  );
}
