"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Check, ExternalLink, Plus, RefreshCw, TriangleAlert } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { syncUserProfileStats } from "@/lib/data/profiles";
import { getMySquads } from "@/lib/data/squads";
import { dataErrorMessage } from "@/lib/data/errors";
import { ConnectLeetCodeModal } from "@/components/modals/ConnectLeetCodeModal";
import { DEFAULT_PREFS, getPrefs, savePrefs, type NotificationPrefs } from "@/lib/data/notificationPrefs";
import { pushPermissionState, requestPushPermission, type PushPermissionState } from "@/lib/pushPermission";
import { QUIET_END_HOUR, QUIET_START_HOUR } from "@/lib/quietHours";
import { profileUrl } from "@/components/ui/ProblemLink";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Avatar } from "@/components/ui/Avatar";
import { StreakChip } from "@/components/ui/Badge";
import { ModalShell } from "@/components/ui/ModalShell";
import {
  SettingsCard,
  SettingsField,
  SettingsRow,
  SettingsSwitch,
  outlineAction,
} from "@/components/settings/SettingsCard";
import { cn } from "@/lib/utils";
import type { Squad } from "@/types/database";

type SquadState =
  | { status: "loading" }
  | { status: "ready"; squads: Squad[] }
  | { status: "error"; message: string };

const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

const squadInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("") || "?";

export default function ProfilePage() {
  const { user, profile, session, signOut, refreshProfile } = useAuth();
  const [connectOpen, setConnectOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [objective, setObjective] = useState<string>("");
  const [objSaved, setObjSaved] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [squadState, setSquadState] = useState<SquadState>({ status: "loading" });
  const [pushPerm, setPushPerm] = useState<PushPermissionState | null>(null);
  const [activeSection, setActiveSection] = useState("overview");

  // Server prefs with a localStorage offline fallback. The label under the
  // section says honestly where the last write landed.
  const [notif, setNotif] = useState<NotificationPrefs>({ ...DEFAULT_PREFS });
  const [notifSource, setNotifSource] = useState<"server" | "device">("server");
  const [approachVis, setApproachVis] = useState<"private" | "squad" | "public">("squad");
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const readDevice = (): NotificationPrefs | null => {
      try {
        const raw = localStorage.getItem("mahayuddh.notif");
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Record<string, boolean>;
        const pick = (v: unknown, fallback = true) =>
          typeof v === "boolean" ? v : fallback;
        return {
          // New keys first, then the legacy per-device keys they replaced.
          push_enabled: pick(parsed.push_enabled, pick(parsed.push, true)),
          challenge: pick(parsed.challenge, true),
          squad: pick(parsed.squad, parsed.goal != null || parsed.recap != null
            ? pick(parsed.goal, true) && pick(parsed.recap, true)
            : true),
          practice: pick(parsed.practice, pick(parsed.revenge, true)),
          contests: pick(parsed.contests, pick(parsed.contest, true)),
        };
      } catch {
        return null;
      }
    };
    const load = async () => {
      try {
        const server = await getPrefs();
        if (cancelled) return;
        setNotif(server);
        setNotifSource("server");
        try {
          localStorage.setItem("mahayuddh.notif", JSON.stringify(server));
        } catch {
          // Mirror is best-effort.
        }
      } catch {
        if (cancelled) return;
        const device = readDevice();
        if (device) setNotif(device);
        setNotifSource("device");
      } finally {
        if (!cancelled) setPrefsLoaded(true);
      }
      try {
        const a = localStorage.getItem("mahayuddh.approachVis");
        if (!cancelled && (a === "private" || a === "squad" || a === "public")) setApproachVis(a);
      } catch {
        // Private mode: prefs just don't persist. The toggles still work.
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Browser push permission is per device and separate from the saved pref,
  // so the row says which of the two is the blocker.
  useEffect(() => {
    setPushPerm(pushPermissionState());
  }, []);

  const loadSquads = useCallback(async () => {
    if (!user) return;
    setSquadState({ status: "loading" });
    try {
      const mine = await getMySquads(user.id, profile?.active_squad_id ?? null);
      setSquadState({ status: "ready", squads: mine.squads });
    } catch (e) {
      setSquadState({ status: "error", message: dataErrorMessage(e, "Couldn't load your squads. Retry.") });
    }
  }, [user, profile?.active_squad_id]);

  useEffect(() => {
    void loadSquads();
  }, [loadSquads]);

  // Scroll spy for the "Jump to" rail (desktop only renders the rail).
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const ids = ["overview", "account", "leetcode", "practice", "squads", "notifications", "privacy"];
    const els = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => !!el);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveSection(visible[0].target.id);
      },
      { rootMargin: "-15% 0px -65% 0px" }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const saveNotif = (key: keyof NotificationPrefs, value: boolean) => {
    const next = { ...notif, [key]: value };
    setNotif(next);
    try {
      localStorage.setItem("mahayuddh.notif", JSON.stringify(next));
    } catch {
      // Ignore: the toggle still reflects this session.
    }
    // Try the server; when the write fails the device copy above is the
    // honest fallback, and the label says so.
    void savePrefs({ [key]: value } as Partial<NotificationPrefs>)
      .then((server) => {
        setNotif(server);
        setNotifSource("server");
        try {
          localStorage.setItem("mahayuddh.notif", JSON.stringify(server));
        } catch {
          // Ignore.
        }
      })
      .catch(() => {
        setNotifSource("device");
      });
  };

  const saveApproachVis = (v: "private" | "squad" | "public") => {
    setApproachVis(v);
    try {
      localStorage.setItem("mahayuddh.approachVis", v);
    } catch {
      // Ignore.
    }
  };

  const handleSyncNow = async () => {
    if (!user || !profile?.leetcode_username) return;
    setSyncing(true);
    setSyncMsg(null);
    try {
      const ok = await syncUserProfileStats(user.id, profile.leetcode_username);
      await refreshProfile();
      setSyncMsg(
        ok
          ? { tone: "ok", text: "Synced just now." }
          : { tone: "error", text: "LeetCode didn't respond. Try again in a minute." }
      );
    } catch {
      setSyncMsg({ tone: "error", text: "LeetCode didn't respond. Try again in a minute." });
    } finally {
      setSyncing(false);
    }
  };

  const handleObjective = async (v: string) => {
    setObjective(v === objective ? "" : v);
    setObjSaved(false);
    const next = v === objective ? "" : v;
    if (!next || !session) return;
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ objective: next }),
      });
      if (res.ok) setObjSaved(true);
    } catch {
      // Non-blocking: the chip still shows the pick for this session.
    }
  };

  const handleAllowPush = async () => {
    await requestPushPermission();
    setPushPerm(pushPermissionState());
  };

  // Global sign-out through the same route the password-recovery flow uses.
  // A failed revoke keeps this session and says so; it never claims the other
  // devices were signed out.
  const handleRevokeAll = async () => {
    if (!session) return;
    setRevoking(true);
    setRevokeError(null);
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
      setRevokeError("Couldn't sign out your other devices, so they're still signed in. Try again.");
      setRevoking(false);
      return;
    }
    await signOut();
  };

  const displayName = profile?.username ?? "You";
  const email = user?.email ?? "";
  const emailConfirmed = !!user?.email_confirmed_at;
  const lcHandle = profile?.leetcode_username;
  const lcSolved = (profile?.total_easy ?? 0) + (profile?.total_medium ?? 0) + (profile?.total_hard ?? 0);
  const synced = profile?.last_synced_at
    ? new Date(profile.last_synced_at).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
      })
    : null;
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString(undefined, { month: "short", year: "numeric" })
    : null;
  const squads = squadState.status === "ready" ? squadState.squads : [];
  const activeSquad = squads.find((s) => s.id === profile?.active_squad_id) ?? null;
  const publicPath = `/u/${encodeURIComponent(displayName)}`;

  const sections = [
    { id: "overview", label: "Overview" },
    { id: "account", label: "Account" },
    { id: "leetcode", label: "LeetCode" },
    { id: "practice", label: "Practice objective" },
    { id: "squads", label: "Squads" },
    { id: "notifications", label: "Notifications" },
    { id: "privacy", label: "Privacy" },
  ];

  const notifRows: { id: keyof NotificationPrefs; label: string; caption: string }[] = [
    { id: "push_enabled", label: "Push alerts on this device", caption: "" },
    { id: "challenge", label: "New challenges", caption: "When a squad mate sends you a 1v1 challenge." },
    { id: "squad", label: "Squad goals and recaps", caption: "Goal progress and the weekly squad recap." },
    { id: "practice", label: "Practice and revenge reminders", caption: "When a problem you missed is due for another try." },
    { id: "contests", label: "Contest reminders", caption: "Upcoming LeetCode contests." },
  ];

  const pushCaption =
    pushPerm === "granted"
      ? "Allowed in this browser."
      : pushPerm === "denied"
        ? "Blocked in this browser's site settings."
        : pushPerm === "unsupported"
          ? "This browser can't show push alerts."
          : pushPerm === "default"
            ? "This browser hasn't been asked yet."
            : "";

  return (
    <div className="pb-8 md:pb-16">
      <div className="grid gap-10 lg:grid-cols-[192px_minmax(0,680px)]">
        <nav aria-label="Settings sections" className="hidden lg:block">
          <div className="sticky top-6 flex flex-col gap-1 pt-2">
            <span className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
              Jump to
            </span>
            {sections.map((s) => {
              const active = activeSection === s.id;
              return (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  aria-current={active ? "location" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs transition-colors",
                    active
                      ? "border-hairline bg-surface-raised font-medium text-text-primary"
                      : "border-transparent text-text-secondary hover:bg-surface-raised hover:text-text-primary"
                  )}
                >
                  <span
                    aria-hidden
                    className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-text-primary" : "bg-transparent")}
                  />
                  {s.label}
                </a>
              );
            })}
          </div>
        </nav>

        <div className="flex min-w-0 flex-col gap-5 md:gap-8">
          {/* Overview: identity and the way out to the public page. */}
          <section
            id="overview"
            aria-label="Profile overview"
            className="relative scroll-mt-24 overflow-hidden rounded-xl border border-hairline bg-surface p-4 md:p-6"
          >
            <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-edge-highlight" />
            <div className="flex items-start gap-3.5 md:gap-4">
              <Avatar
                name={displayName}
                src={profile?.avatar_url}
                size="xl"
                className="max-md:h-14 max-md:w-14 max-md:text-base"
              />
              <div className="min-w-0 flex-1 md:pt-1">
                <div className="flex flex-wrap items-center gap-2 md:gap-2.5">
                  <h1 className="truncate font-display text-xl font-semibold tracking-tight text-text-primary md:text-2xl">
                    {displayName}
                  </h1>
                  <StreakChip count={profile?.streak ?? 0} alive={(profile?.streak ?? 0) > 0} />
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-text-secondary">
                  <span className="font-mono">@{displayName}</span>
                  {activeSquad && (
                    <>
                      <span aria-hidden className="text-text-tertiary">·</span>
                      <span>{activeSquad.name}</span>
                    </>
                  )}
                  {memberSince && (
                    <>
                      <span aria-hidden className="text-text-tertiary">·</span>
                      <span className="text-text-tertiary">Member since {memberSince}</span>
                    </>
                  )}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-3 border-t border-hairline pt-4 md:mt-5 md:flex-row md:items-center md:justify-between md:pt-5">
              <p className="flex items-center gap-2 text-xs text-text-tertiary">
                <span
                  aria-hidden
                  className={cn("h-2 w-2 rounded-full", lcHandle ? "bg-text-secondary" : "border border-hairline-strong")}
                />
                {lcHandle
                  ? "Public proof verified by LeetCode sync"
                  : "LeetCode not connected · solves are self-reported"}
              </p>
              <div className="grid grid-cols-2 gap-2 md:flex md:items-center md:gap-2.5">
                <a href="#account" className={cn(outlineAction, "h-11 md:h-9 md:px-3.5")}>
                  Edit profile
                </a>
                <Link
                  href={publicPath}
                  className="inline-flex h-11 items-center justify-center gap-1.5 rounded-md border border-hairline bg-surface-overlay px-4 text-xs font-medium text-text-primary transition-colors hover:bg-[#272830] md:h-9"
                >
                  View public page
                  <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                </Link>
              </div>
            </div>
          </section>

          <SettingsCard id="account" title="Account" description="Your identity on Mahayuddh.">
            <div className="divide-y divide-hairline">
              <SettingsField label="Name">
                <span className="font-medium">{displayName}</span>
              </SettingsField>
              <SettingsField label="Username">
                <span className="font-mono">@{displayName}</span>
                <span className="text-[11px] text-text-tertiary">{publicPath}</span>
              </SettingsField>
              <SettingsField label="Email address">
                <span className="truncate font-medium">{email || "—"}</span>
                {email && emailConfirmed && (
                  <span className="inline-flex h-5 items-center rounded-xs border border-hairline-strong px-1.5 text-[10px] font-medium text-text-secondary">
                    Confirmed
                  </span>
                )}
              </SettingsField>
              <SettingsField
                label="Sessions"
                action={
                  <button type="button" onClick={() => setRevokeOpen(true)} className={outlineAction}>
                    Sign out everywhere
                  </button>
                }
              >
                <span className="text-xs text-text-secondary md:text-sm">Signed in on this device</span>
              </SettingsField>
            </div>
          </SettingsCard>

          <SettingsCard
            id="leetcode"
            title="LeetCode connection"
            description="Verifies accepted submissions and battle times."
            badge={
              lcHandle ? (
                <span className="inline-flex h-5 items-center gap-1 rounded-full border border-hairline-strong px-2 text-[11px] font-medium text-text-secondary">
                  <Check className="h-3 w-3" strokeWidth={2} aria-hidden />
                  Connected
                </span>
              ) : (
                <span className="inline-flex h-5 items-center rounded-full border border-hairline px-2 text-[11px] font-medium text-text-tertiary">
                  Not connected
                </span>
              )
            }
          >
            {lcHandle ? (
              <div className="flex flex-col gap-3">
                {syncMsg?.tone === "error" && (
                  <div
                    role="alert"
                    className="flex items-center justify-between gap-3 rounded-lg border border-error/30 bg-error-tint p-3 text-xs text-error"
                  >
                    <span className="flex items-center gap-2">
                      <TriangleAlert className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden />
                      {syncMsg.text}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleSyncNow()}
                      disabled={syncing}
                      className="min-h-[44px] shrink-0 cursor-pointer font-medium underline underline-offset-2 hover:text-text-primary md:min-h-0"
                    >
                      Retry now
                    </button>
                  </div>
                )}
                <div className="flex flex-col gap-2.5 rounded-lg border border-hairline bg-well p-3 md:flex-row md:items-center md:justify-between md:p-3.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-xs border border-hairline bg-surface-overlay font-mono text-[10px] font-semibold text-text-primary md:h-8 md:w-8 md:rounded-md md:text-xs"
                    >
                      LC
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-mono text-xs font-medium text-text-primary md:text-sm">
                          {lcHandle}
                        </span>
                        <a
                          href={profileUrl(lcHandle)}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Open ${lcHandle} on LeetCode`}
                          className="inline-flex h-11 w-8 shrink-0 items-center justify-center text-text-tertiary transition-colors hover:text-text-primary md:h-auto md:w-auto"
                        >
                          <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} />
                        </a>
                      </div>
                      <p className="font-mono text-[11px] leading-4 text-text-tertiary tnum">
                        {synced ? `Synced ${synced}` : "Connected"}
                        {lcSolved > 0 && ` · ${lcSolved} solved`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleSyncNow()}
                      disabled={syncing}
                      className="inline-flex h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-hairline bg-surface-overlay px-3 text-xs font-medium text-text-primary transition-colors hover:bg-[#272830] disabled:cursor-wait md:h-8 md:flex-none"
                    >
                      <RefreshCw
                        className={cn("h-3.5 w-3.5", syncing && "animate-spin")}
                        strokeWidth={1.5}
                        aria-hidden
                      />
                      {syncing ? "Syncing…" : "Sync now"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConnectOpen(true)}
                      className={cn(outlineAction, "hover:text-error")}
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-hairline bg-surface-raised p-3 md:p-3.5">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-xs font-semibold text-text-primary">Import full history</span>
                    <span className="text-[11px] leading-4 text-text-secondary">
                      Pull every accepted solve so your sheets start complete.
                    </span>
                  </div>
                  <button type="button" onClick={() => setConnectOpen(true)} className={outlineAction}>
                    Import
                  </button>
                </div>
                {syncMsg?.tone === "ok" && (
                  <p role="status" className="text-xs leading-5 text-text-tertiary">
                    {syncMsg.text}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-well p-4">
                <p className="text-xs leading-5 text-text-secondary">
                  Connect LeetCode to verify your solves. Everything works without it.
                </p>
                <div>
                  <button
                    type="button"
                    onClick={() => setConnectOpen(true)}
                    className="inline-flex h-11 cursor-pointer items-center justify-center rounded-md border border-hairline bg-surface-overlay px-4 text-xs font-medium text-text-primary transition-colors hover:bg-[#272830] md:h-9"
                  >
                    Connect
                  </button>
                </div>
              </div>
            )}
          </SettingsCard>

          <SettingsCard
            id="practice"
            title="Practice objective"
            description="What are you practicing for?"
          >
            <div className="flex flex-wrap items-center gap-2">
              {[
                { value: "internship", label: "Internship prep" },
                { value: "fulltime", label: "Full-time roles" },
                { value: "consistency", label: "Daily consistency" },
              ].map((o) => {
                const on = objective === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => void handleObjective(o.value)}
                    aria-pressed={on}
                    className={cn(
                      "inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition-colors md:h-8",
                      on
                        ? "border-hairline-strong bg-surface-overlay text-text-primary"
                        : "border-hairline bg-transparent text-text-secondary hover:bg-surface-raised hover:text-text-primary"
                    )}
                  >
                    {on && <Check className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />}
                    {o.label}
                  </button>
                );
              })}
            </div>
            {objSaved && <p role="status" className="mt-2 text-[11px] leading-4 text-text-tertiary">Saved.</p>}
          </SettingsCard>

          <SettingsCard
            id="squads"
            title="Squads"
            description="Who you share streaks, challenges, and goals with."
            action={
              <Link href="/squad" className={outlineAction}>
                <Plus className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                Join with code
              </Link>
            }
          >
            {squadState.status === "loading" ? (
              <div className="flex items-center gap-3 py-3" aria-hidden>
                <span className="skeleton h-8 w-8 shrink-0" />
                <span className="flex-1 space-y-1.5">
                  <span className="skeleton block h-3 w-32" />
                  <span className="skeleton block h-2.5 w-48" />
                </span>
              </div>
            ) : squadState.status === "error" ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-hairline bg-well p-3">
                <p role="alert" className="text-xs leading-5 text-text-secondary">
                  {squadState.message}
                </p>
                <button type="button" onClick={() => void loadSquads()} className={outlineAction}>
                  Retry
                </button>
              </div>
            ) : squads.length === 0 ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-hairline bg-well p-3">
                <p className="text-xs leading-5 text-text-secondary">
                  You&apos;re not in a squad yet. Start one or join with an invite code.
                </p>
                <Link href="/squad" className={outlineAction}>
                  Open
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-hairline">
                {squads.map((s) => {
                  const active = s.id === profile?.active_squad_id;
                  return (
                    <li key={s.id} className="flex min-h-[44px] items-center justify-between gap-3 py-2.5 md:py-3">
                      <div className="flex min-w-0 items-center gap-2.5 md:gap-3">
                        <span
                          aria-hidden
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xs border border-hairline bg-surface-raised font-display text-xs font-semibold uppercase text-text-primary md:h-8 md:w-8 md:rounded-md"
                        >
                          {squadInitials(s.name)}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-xs font-semibold text-text-primary">{s.name}</span>
                            {active && (
                              <span className="inline-flex h-4 items-center rounded-xs border border-hairline bg-surface-overlay px-1.5 text-[10px] font-medium text-text-secondary">
                                Active
                              </span>
                            )}
                          </div>
                          {s.season_name && (
                            <p className="mt-0.5 truncate text-[11px] leading-4 text-text-tertiary">
                              {s.season_name}
                            </p>
                          )}
                        </div>
                      </div>
                      <Link
                        href={active ? "/squad" : `/squad/${s.id}/wall`}
                        aria-label={`Open ${s.name}`}
                        className={outlineAction}
                      >
                        Open
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </SettingsCard>

          <SettingsCard
            id="notifications"
            title="Notifications"
            description="Choose what reaches you, and on which devices."
            action={
              <span className="hidden shrink-0 items-center gap-1 pt-0.5 font-mono text-[11px] text-text-tertiary md:inline-flex">
                <Check className="h-3 w-3" strokeWidth={2} aria-hidden />
                {notifSource === "server" ? "Saved across your devices." : "Saved on this device."}
              </span>
            }
          >
            <div className="divide-y divide-hairline">
              {notifRows.map((r) => {
                const on = prefsLoaded ? notif[r.id] : DEFAULT_PREFS[r.id];
                const isPush = r.id === "push_enabled";
                return (
                  <SettingsRow
                    key={r.id}
                    label={r.label}
                    caption={isPush ? pushCaption || undefined : r.caption}
                  >
                    <div className="flex shrink-0 items-center gap-2">
                      {isPush && pushPerm === "default" && (
                        <button type="button" onClick={() => void handleAllowPush()} className={outlineAction}>
                          Allow
                        </button>
                      )}
                      <SettingsSwitch on={on} onToggle={() => saveNotif(r.id, !on)} label={r.label} />
                    </div>
                  </SettingsRow>
                );
              })}
              <SettingsRow
                label="Quiet hours"
                caption="Most alerts stay quiet overnight. This window is fixed for now."
              >
                <span className="shrink-0 font-mono text-xs text-text-secondary tnum">
                  {hh(QUIET_START_HOUR)}–{hh(QUIET_END_HOUR)} IST
                </span>
              </SettingsRow>
            </div>
            <p className="mt-1 font-mono text-[11px] text-text-tertiary md:hidden">
              {notifSource === "server" ? "Saved across your devices." : "Saved on this device."}
            </p>
          </SettingsCard>

          <SettingsCard
            id="privacy"
            title="Privacy defaults"
            description="Who sees your write-ups and notes."
          >
            <div className="flex flex-col">
              <div className="flex flex-col gap-2 pb-3 md:flex-row md:items-center md:justify-between md:gap-4">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium leading-5 text-text-primary md:text-sm">
                    Default visibility for new approaches
                  </span>
                  <span className="text-[11px] leading-4 text-text-tertiary md:text-xs">
                    Saved on this device.
                  </span>
                </div>
                <SegmentedControl
                  label="Default visibility for new approaches"
                  value={approachVis}
                  onChange={saveApproachVis}
                  className="border border-hairline max-md:h-auto md:w-[240px] md:shrink-0"
                  options={[
                    { value: "private", label: "Private" },
                    { value: "squad", label: "Squad" },
                    { value: "public", label: "Public" },
                  ]}
                />
              </div>
              <SettingsRow
                className="border-t border-hairline"
                label="Notes"
                caption="Notes stay private. Share one at a time from your Notebook."
              >
                <span className="shrink-0 text-xs font-medium text-text-secondary">Private</span>
              </SettingsRow>
            </div>
          </SettingsCard>

          <footer className="flex flex-col gap-2 border-t border-hairline pt-4 md:flex-row md:items-center md:justify-between">
            <button
              type="button"
              onClick={() => void signOut()}
              className="inline-flex h-11 cursor-pointer items-center justify-center rounded-md border border-hairline px-4 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary md:h-9"
            >
              Sign out
            </button>
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="inline-flex h-11 cursor-pointer items-center justify-center rounded-md border border-error/30 bg-error-tint px-4 text-xs font-medium text-error transition-opacity hover:opacity-80 md:h-9"
            >
              Delete account
            </button>
          </footer>
        </div>
      </div>

      <ConnectLeetCodeModal isOpen={connectOpen} onClose={() => setConnectOpen(false)} onConnected={() => void refreshProfile()} />

      {revokeOpen && (
        <ModalShell
          label="Sign out everywhere"
          variant="sheet"
          zIndexClass="z-[300]"
          onClose={() => {
            if (!revoking) setRevokeOpen(false);
          }}
          maxWidthClass="max-w-[480px]"
          panelClassName="max-md:pt-8"
        >
          <h2 className="font-display text-xl font-semibold tracking-tight">Sign out everywhere?</h2>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            This ends every session on every device, including this one. You&apos;ll sign in
            again here afterwards.
          </p>
          {revokeError && (
            <p role="alert" className="mt-3 rounded-lg border border-error/30 bg-error-tint p-3 text-xs leading-5 text-error">
              {revokeError}
            </p>
          )}
          <div className="mt-5 flex flex-col-reverse gap-2 md:flex-row md:justify-end">
            <Button
              variant="ghost"
              onClick={() => setRevokeOpen(false)}
              disabled={revoking}
              className="min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => void handleRevokeAll()}
              loading={revoking}
              className="min-h-[44px]"
            >
              Sign out everywhere
            </Button>
          </div>
        </ModalShell>
      )}

      {deleteOpen && (
        <ModalShell
          label="Delete account"
          variant="sheet"
          zIndexClass="z-[300]"
          onClose={() => setDeleteOpen(false)}
          maxWidthClass="max-w-[480px]"
          panelClassName="max-md:pt-8"
        >
          <h2 className="font-display text-xl font-semibold tracking-tight">Delete account?</h2>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            This removes your profile, solves, and approaches. Your squad keeps going
            without you. This can&apos;t be undone.
          </p>
          <p className="mt-3 rounded-lg border border-hairline bg-well p-3 text-xs leading-5 text-text-tertiary">
            Self-serve deletion isn&apos;t available yet — signing out keeps everything
            as it is. To request deletion, reply to any product email.
          </p>
          <div className="mt-5 flex flex-col-reverse gap-2 md:flex-row md:justify-end">
            <Button variant="ghost" onClick={() => setDeleteOpen(false)} className="min-h-[44px]">
              Keep my account
            </Button>
            <Button variant="secondary" onClick={() => void signOut()} className="min-h-[44px]">
              Sign out instead
            </Button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
