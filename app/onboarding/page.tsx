"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { authInputCls, authLabelCls } from "@/components/auth/AuthChrome";
import { OBJECTIVES } from "@/lib/objectives";
import { useInvalidate } from "@/lib/cache/query";
import { cn } from "@/lib/utils";

interface ApiResponse<T = Record<string, unknown>> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

async function api<T = Record<string, unknown>>(
  path: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  body?: unknown
): Promise<ApiResponse<T>> {
  try {
    const supabase = createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const res = await fetch(path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;

    if (!res.ok) {
      const errorMsg =
        typeof json.error === "string" && json.error.trim()
          ? json.error
          : "Couldn't reach the server. Try again.";
      return { ok: false, status: res.status, error: errorMsg, data: json as T };
    }

    return { ok: true, status: res.status, data: json as T };
  } catch {
    return { ok: false, status: 0, error: "Couldn't reach the server. Try again." };
  }
}

export default function OnboardingPage() {
  const router = useRouter();
  const { profile, loading, refreshProfile } = useAuth();
  const invalidate = useInvalidate();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form states
  const [usernameDraft, setUsernameDraft] = useState("");
  const [objective, setObjective] = useState<string>("");
  const [lcDraft, setLcDraft] = useState("");
  const [connectedHandle, setConnectedHandle] = useState<string | null>(null);
  const [squadChoice, setSquadChoice] = useState<"create" | "join" | "solo">("create");
  const [squadName, setSquadName] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  // Loading & error states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConnectingLc, setIsConnectingLc] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Input refs for auto-focusing the first input on each step
  const step1InputRef = useRef<HTMLInputElement>(null);
  const step3InputRef = useRef<HTMLInputElement>(null);
  const squadNameInputRef = useRef<HTMLInputElement>(null);
  const squadCodeInputRef = useRef<HTMLInputElement>(null);

  // Sync initial values from profile once loaded
  const profileInitializedRef = useRef(false);
  useEffect(() => {
    if (profile && !profileInitializedRef.current) {
      profileInitializedRef.current = true;
      if (profile.username) {
        setUsernameDraft(profile.username);
      }
      const existingObjective = (profile as { objective?: string | null }).objective;
      if (existingObjective) {
        setObjective(existingObjective);
      }
    }
  }, [profile]);

  // If already onboarded, redirect to /home
  useEffect(() => {
    if (profile?.onboarded_at) {
      router.replace("/home");
    }
  }, [profile?.onboarded_at, router]);

  // Focus the step's first input when step opens
  useEffect(() => {
    if (step === 1) {
      step1InputRef.current?.focus();
    } else if (step === 3 && !profile?.leetcode_username && !connectedHandle) {
      step3InputRef.current?.focus();
    } else if (step === 4 && !profile?.active_squad_id) {
      if (squadChoice === "create") {
        squadNameInputRef.current?.focus();
      } else if (squadChoice === "join") {
        squadCodeInputRef.current?.focus();
      }
    }
  }, [step, squadChoice, profile?.leetcode_username, profile?.active_squad_id, connectedHandle]);

  // Complete setup: mark onboarded, refresh profile, and redirect to /home
  const finishAndGoHome = useCallback(async () => {
    setFinishing(true);
    try {
      await api("/api/auth/profile", "PATCH", { onboarded: true });
    } catch {
      // Never trap the user here
    }
    try {
      await refreshProfile();
    } catch {
      // Ignore
    }
    router.replace("/home");
  }, [refreshProfile, router]);

  // Handle "Skip setup" top-right text button
  const handleSkipSetup = async () => {
    if (finishing) return;
    await finishAndGoHome();
  };

  // Step 1: Your name
  const handleStep1 = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting || finishing) return;
    setErrorMsg(null);

    const trimmed = usernameDraft.trim();
    if (!trimmed) {
      setErrorMsg("Please enter a name.");
      return;
    }

    if (trimmed !== profile?.username) {
      setIsSubmitting(true);
      const res = await api("/api/auth/profile", "PATCH", { username: trimmed });
      setIsSubmitting(false);

      if (!res.ok) {
        setErrorMsg(res.error || "Couldn't save your name. Try again.");
        return;
      }
      await refreshProfile();
    }

    setStep(2);
  };

  // Step 2: Your goal
  const handleStep2 = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting || finishing) return;
    setErrorMsg(null);

    const existingObjective = (profile as { objective?: string | null })?.objective ?? "";
    if (objective && objective !== existingObjective) {
      setIsSubmitting(true);
      const res = await api("/api/auth/profile", "PATCH", { objective });
      setIsSubmitting(false);

      if (!res.ok) {
        setErrorMsg(res.error || "Couldn't save your goal. Try again.");
        return;
      }
      await refreshProfile();
    }

    setStep(3);
  };

  const handleSkipStep2 = () => {
    if (isSubmitting || finishing) return;
    setErrorMsg(null);
    setStep(3);
  };

  // Step 3: LeetCode (optional)
  const isLcConnected = Boolean(profile?.leetcode_username || connectedHandle);

  const handleConnectLeetcode = async () => {
    const handle = lcDraft.trim();
    if (!handle || isConnectingLc || finishing) return;

    setIsConnectingLc(true);
    setErrorMsg(null);

    const res = await api("/api/sync/leetcode", "POST", { username: handle });
    setIsConnectingLc(false);

    if (res.ok) {
      setConnectedHandle(handle);
      await refreshProfile();
    } else {
      setErrorMsg(res.error || "Couldn't connect LeetCode. Try again.");
    }
  };

  const handleStep3 = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting || finishing || !isLcConnected) return;
    setErrorMsg(null);
    setStep(4);
  };

  const handleSkipStep3 = () => {
    if (isSubmitting || finishing) return;
    setErrorMsg(null);
    setStep(4);
  };

  // Step 4: Your squad
  const handleStep4 = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting || finishing) return;
    setErrorMsg(null);

    if (!profile?.active_squad_id) {
      if (squadChoice === "create") {
        const name = squadName.trim();
        if (!name) {
          setErrorMsg("Squad name is required (max 60 chars).");
          return;
        }
        setIsSubmitting(true);
        const res = await api("/api/squads", "POST", { name });
        if (!res.ok) {
          setIsSubmitting(false);
          setErrorMsg(res.error || "Couldn't create squad. Try again.");
          return;
        }
        await invalidate("my-squads", "squad-detail", "active-squad-members");
      } else if (squadChoice === "join") {
        const code = inviteCode.trim().toUpperCase();
        if (!/^[A-Z0-9]{8}$/.test(code)) {
          setErrorMsg("Invite code looks wrong — 8 letters/digits.");
          return;
        }
        setIsSubmitting(true);
        const res = await api("/api/squads/join", "POST", { invite_code: code });
        if (!res.ok) {
          setIsSubmitting(false);
          setErrorMsg(res.error || "Couldn't join squad. Try again.");
          return;
        }
        await invalidate("my-squads", "squad-detail", "active-squad-members");
      }
    }

    await finishAndGoHome();
  };

  // Handle Back button
  const handleBack = () => {
    if (isSubmitting || finishing) return;
    setErrorMsg(null);
    if (step > 1) {
      setStep((s) => (s - 1) as 1 | 2 | 3 | 4);
    }
  };

  // Loading state
  if (loading || !profile || profile.onboarded_at) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner size="xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[560px]">
      <div className="w-full rounded-xl border border-hairline bg-surface p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] md:p-6">
        {/* Step indicator and Skip setup */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-text-tertiary tnum">
              Step {step} of 4
            </span>
            <button
              type="button"
              onClick={handleSkipSetup}
              disabled={finishing || isSubmitting}
              className="-mr-2 inline-flex min-h-[44px] items-center px-2 text-xs text-text-secondary transition-colors hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50 md:min-h-0"
            >
              Skip setup
            </button>
          </div>
          <div
            role="progressbar"
            aria-valuenow={step}
            aria-valuemin={1}
            aria-valuemax={4}
            aria-label={`Step ${step} of 4`}
            className="mt-3 h-1 w-full overflow-hidden rounded-full bg-surface-overlay"
          >
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${(step / 4) * 100}%` }}
            />
          </div>
        </div>

        {/* Step 1: Your name */}
        {step === 1 && (
          <form onSubmit={handleStep1} className="transition-opacity duration-200 motion-reduce:transition-none">
            <div className="mb-6">
              <h1 className="font-display text-2xl font-semibold tracking-tight text-text-primary">
                What should we call you?
              </h1>
              <p className="mt-1 text-sm text-text-secondary">
                This is how your squad sees you.
              </p>
            </div>

            <div>
              <label htmlFor="username" className={authLabelCls}>
                Your name
              </label>
              <input
                ref={step1InputRef}
                id="username"
                name="username"
                type="text"
                maxLength={30}
                value={usernameDraft}
                onChange={(e) => {
                  setUsernameDraft(e.target.value);
                  setErrorMsg(null);
                }}
                placeholder="Meera Rao"
                className={authInputCls}
                required
              />
              {errorMsg && (
                <p role="alert" className="mt-1.5 text-xs text-error">
                  {errorMsg}
                </p>
              )}
            </div>

            <div className="mt-8 flex flex-col-reverse gap-3 border-t border-hairline pt-6 sm:flex-row sm:items-center sm:justify-end">
              <Button
                type="submit"
                variant="primary"
                loading={isSubmitting || finishing}
                disabled={isSubmitting || finishing || !usernameDraft.trim()}
                className="h-11 w-full min-w-[100px] md:h-10 sm:w-auto"
              >
                Continue
              </Button>
            </div>
          </form>
        )}

        {/* Step 2: Your goal */}
        {step === 2 && (
          <form onSubmit={handleStep2} className="transition-opacity duration-200 motion-reduce:transition-none">
            <div className="mb-6">
              <h1 className="font-display text-2xl font-semibold tracking-tight text-text-primary">
                What are you practising for?
              </h1>
              <p className="mt-1 text-sm text-text-secondary">
                It shapes your daily battle. You can change it later in your profile.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {OBJECTIVES.map((o) => {
                const isSelected = objective === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => {
                      setObjective(isSelected ? "" : o.value);
                      setErrorMsg(null);
                    }}
                    aria-pressed={isSelected}
                    className={cn(
                      "inline-flex h-11 cursor-pointer items-center rounded-full border px-4 text-xs font-medium transition-colors md:h-10",
                      isSelected
                        ? "border-hairline-strong bg-surface-overlay text-text-primary"
                        : "border-hairline bg-transparent text-text-secondary hover:bg-surface-raised hover:text-text-primary"
                    )}
                  >
                    {isSelected && (
                      <Check className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                    )}
                    {o.label}
                  </button>
                );
              })}
            </div>

            {errorMsg && (
              <p role="alert" className="mt-2 text-xs text-error">
                {errorMsg}
              </p>
            )}

            <div className="mt-8 flex flex-col-reverse gap-3 border-t border-hairline pt-6 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="secondary"
                onClick={handleBack}
                disabled={isSubmitting || finishing}
                className="h-11 w-full md:h-10 sm:w-auto"
              >
                Back
              </Button>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleSkipStep2}
                  disabled={isSubmitting || finishing}
                  className="h-11 w-full text-text-secondary hover:text-text-primary md:h-10 sm:w-auto"
                >
                  Skip
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={isSubmitting || finishing}
                  disabled={isSubmitting || finishing}
                  className="h-11 w-full min-w-[100px] md:h-10 sm:w-auto"
                >
                  Continue
                </Button>
              </div>
            </div>
          </form>
        )}

        {/* Step 3: LeetCode (optional) */}
        {step === 3 && (
          <form onSubmit={handleStep3} className="transition-opacity duration-200 motion-reduce:transition-none">
            <div className="mb-6">
              <h1 className="font-display text-2xl font-semibold tracking-tight text-text-primary">
                Connect LeetCode
              </h1>
              <p className="mt-1 text-sm text-text-secondary">
                Optional. Your solves get verified automatically; everything works without it.
              </p>
            </div>

            {profile?.leetcode_username ? (
              <div className="rounded-lg border border-hairline bg-well p-4">
                <p className="flex items-center gap-2 text-sm font-medium text-verified">
                  <Check className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                  Connected @{profile.leetcode_username}
                </p>
                <p className="mt-1 text-xs text-text-secondary">
                  Your LeetCode account is connected and verifies your daily battle solves.
                </p>
              </div>
            ) : (
              <div>
                <label htmlFor="leetcodeUsername" className={authLabelCls}>
                  LeetCode username <span className="font-normal text-text-tertiary">(optional)</span>
                </label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="relative flex-1">
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 font-mono text-xs text-text-tertiary"
                    >
                      @
                    </span>
                    <input
                      ref={step3InputRef}
                      id="leetcodeUsername"
                      name="leetcodeUsername"
                      autoComplete="off"
                      type="text"
                      value={lcDraft}
                      onChange={(e) => {
                        setLcDraft(e.target.value);
                        setErrorMsg(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (!isLcConnected) {
                            if (lcDraft.trim()) {
                              void handleConnectLeetcode();
                            } else {
                              handleSkipStep3();
                            }
                          } else {
                            handleStep3();
                          }
                        }
                      }}
                      disabled={isConnectingLc || Boolean(connectedHandle)}
                      placeholder="username"
                      className={cn(authInputCls, "pl-7 font-mono")}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    loading={isConnectingLc}
                    disabled={!lcDraft.trim() || isConnectingLc || Boolean(connectedHandle)}
                    onClick={() => void handleConnectLeetcode()}
                    className="h-11 shrink-0 md:h-10"
                  >
                    Connect
                  </Button>
                </div>

                {connectedHandle && (
                  <p className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-verified">
                    <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
                    Connected @{connectedHandle}
                  </p>
                )}

                {errorMsg && (
                  <p role="alert" className="mt-1.5 text-xs text-error">
                    {errorMsg}
                  </p>
                )}

                <p className="mt-2 text-xs leading-5 text-text-tertiary">
                  Everything works without it. Connecting lets us verify your solves.
                </p>
              </div>
            )}

            <div className="mt-8 flex flex-col-reverse gap-3 border-t border-hairline pt-6 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="secondary"
                onClick={handleBack}
                disabled={isSubmitting || finishing || isConnectingLc}
                className="h-11 w-full md:h-10 sm:w-auto"
              >
                Back
              </Button>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
                {!isLcConnected && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleSkipStep3}
                    disabled={isSubmitting || finishing || isConnectingLc}
                    className="h-11 w-full text-text-secondary hover:text-text-primary md:h-10 sm:w-auto"
                  >
                    Skip
                  </Button>
                )}
                <Button
                  type="submit"
                  variant="primary"
                  loading={isSubmitting || finishing}
                  disabled={!isLcConnected || isSubmitting || finishing || isConnectingLc}
                  className="h-11 w-full min-w-[100px] md:h-10 sm:w-auto"
                >
                  Continue
                </Button>
              </div>
            </div>
          </form>
        )}

        {/* Step 4: Your squad */}
        {step === 4 && (
          <form onSubmit={handleStep4} className="transition-opacity duration-200 motion-reduce:transition-none">
            <div className="mb-6">
              <h1 className="font-display text-2xl font-semibold tracking-tight text-text-primary">
                Practise with people
              </h1>
              <p className="mt-1 text-sm text-text-secondary">
                A squad sees who solved today&apos;s battle and how fast.
              </p>
            </div>

            {profile?.active_squad_id ? (
              <div className="rounded-lg border border-hairline bg-well p-4">
                <p className="text-sm font-medium text-text-primary">
                  You&apos;re already in a squad
                </p>
                <p className="mt-1 text-xs text-text-secondary">
                  Your squad is set up and ready for battle.
                </p>
              </div>
            ) : (
              <div role="radiogroup" aria-label="Squad choice" className="space-y-3">
                {/* Choice 1: Start a squad */}
                <div
                  role="radio"
                  aria-checked={squadChoice === "create"}
                  tabIndex={squadChoice === "create" ? 0 : -1}
                  onClick={() => {
                    setSquadChoice("create");
                    setErrorMsg(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.target instanceof HTMLInputElement) return;
                    if (e.key === " " || e.key === "Enter") {
                      e.preventDefault();
                      setSquadChoice("create");
                      setErrorMsg(null);
                    } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
                      e.preventDefault();
                      setSquadChoice("join");
                      setErrorMsg(null);
                    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
                      e.preventDefault();
                      setSquadChoice("solo");
                      setErrorMsg(null);
                    }
                  }}
                  className={cn(
                    "cursor-pointer rounded-lg border p-4 transition-colors",
                    squadChoice === "create"
                      ? "border-hairline-strong bg-surface-raised shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                      : "border-hairline bg-surface hover:bg-surface-raised/50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                        squadChoice === "create"
                          ? "border-primary bg-primary text-on-primary"
                          : "border-hairline-strong bg-transparent"
                      )}
                    >
                      {squadChoice === "create" && (
                        <span className="h-1.5 w-1.5 rounded-full bg-on-primary" />
                      )}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-text-primary">Start a squad</p>
                      <p className="text-xs text-text-secondary">
                        Create a squad and invite your teammates.
                      </p>
                    </div>
                  </div>

                  {squadChoice === "create" && (
                    <div
                      className="mt-4 border-t border-hairline pt-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <label htmlFor="squadName" className={authLabelCls}>
                        Squad name
                      </label>
                      <input
                        ref={squadNameInputRef}
                        id="squadName"
                        name="squadName"
                        type="text"
                        maxLength={60}
                        value={squadName}
                        onChange={(e) => {
                          setSquadName(e.target.value);
                          setErrorMsg(null);
                        }}
                        placeholder="e.g. Night Owls"
                        className={authInputCls}
                      />
                      {errorMsg && (
                        <p role="alert" className="mt-1.5 text-xs text-error">
                          {errorMsg}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Choice 2: Join with a code */}
                <div
                  role="radio"
                  aria-checked={squadChoice === "join"}
                  tabIndex={squadChoice === "join" ? 0 : -1}
                  onClick={() => {
                    setSquadChoice("join");
                    setErrorMsg(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.target instanceof HTMLInputElement) return;
                    if (e.key === " " || e.key === "Enter") {
                      e.preventDefault();
                      setSquadChoice("join");
                      setErrorMsg(null);
                    } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
                      e.preventDefault();
                      setSquadChoice("solo");
                      setErrorMsg(null);
                    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
                      e.preventDefault();
                      setSquadChoice("create");
                      setErrorMsg(null);
                    }
                  }}
                  className={cn(
                    "cursor-pointer rounded-lg border p-4 transition-colors",
                    squadChoice === "join"
                      ? "border-hairline-strong bg-surface-raised shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                      : "border-hairline bg-surface hover:bg-surface-raised/50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                        squadChoice === "join"
                          ? "border-primary bg-primary text-on-primary"
                          : "border-hairline-strong bg-transparent"
                      )}
                    >
                      {squadChoice === "join" && (
                        <span className="h-1.5 w-1.5 rounded-full bg-on-primary" />
                      )}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-text-primary">Join with a code</p>
                      <p className="text-xs text-text-secondary">
                        Enter an 8-character invite code from a squad.
                      </p>
                    </div>
                  </div>

                  {squadChoice === "join" && (
                    <div
                      className="mt-4 border-t border-hairline pt-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <label htmlFor="inviteCode" className={authLabelCls}>
                        Invite code
                      </label>
                      <input
                        ref={squadCodeInputRef}
                        id="inviteCode"
                        name="inviteCode"
                        autoComplete="off"
                        type="text"
                        maxLength={8}
                        value={inviteCode}
                        onChange={(e) => {
                          setInviteCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""));
                          setErrorMsg(null);
                        }}
                        placeholder="ABC123XY"
                        className={cn(authInputCls, "font-mono uppercase tracking-wider")}
                      />
                      {errorMsg && (
                        <p role="alert" className="mt-1.5 text-xs text-error">
                          {errorMsg}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Choice 3: Practise solo for now */}
                <div
                  role="radio"
                  aria-checked={squadChoice === "solo"}
                  tabIndex={squadChoice === "solo" ? 0 : -1}
                  onClick={() => {
                    setSquadChoice("solo");
                    setErrorMsg(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === " " || e.key === "Enter") {
                      e.preventDefault();
                      setSquadChoice("solo");
                      setErrorMsg(null);
                    } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
                      e.preventDefault();
                      setSquadChoice("create");
                      setErrorMsg(null);
                    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
                      e.preventDefault();
                      setSquadChoice("join");
                      setErrorMsg(null);
                    }
                  }}
                  className={cn(
                    "cursor-pointer rounded-lg border p-4 transition-colors",
                    squadChoice === "solo"
                      ? "border-hairline-strong bg-surface-raised shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                      : "border-hairline bg-surface hover:bg-surface-raised/50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                        squadChoice === "solo"
                          ? "border-primary bg-primary text-on-primary"
                          : "border-hairline-strong bg-transparent"
                      )}
                    >
                      {squadChoice === "solo" && (
                        <span className="h-1.5 w-1.5 rounded-full bg-on-primary" />
                      )}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-text-primary">Practise solo for now</p>
                      <p className="text-xs text-text-secondary">
                        Start on your own. You can join or create a squad anytime.
                      </p>
                    </div>
                  </div>
                </div>

                {errorMsg && squadChoice === "solo" && (
                  <p role="alert" className="mt-1.5 text-xs text-error">
                    {errorMsg}
                  </p>
                )}
              </div>
            )}

            <div className="mt-8 flex flex-col-reverse gap-3 border-t border-hairline pt-6 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="secondary"
                onClick={handleBack}
                disabled={isSubmitting || finishing}
                className="h-11 w-full md:h-10 sm:w-auto"
              >
                Back
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={isSubmitting || finishing}
                disabled={isSubmitting || finishing}
                className="h-11 w-full min-w-[100px] md:h-10 sm:w-auto"
              >
                Finish
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
