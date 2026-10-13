"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { syncUserProfileStats } from "@/lib/data/profiles";
import { ConnectLeetCodeModal } from "@/components/modals/ConnectLeetCodeModal";
import { DEFAULT_PREFS, getPrefs, savePrefs, type NotificationPrefs } from "@/lib/data/notificationPrefs";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Avatar } from "@/components/ui/Avatar";
import { StreakChip } from "@/components/ui/Badge";

export default function ProfilePage() {
  const { user, profile, session, signOut, refreshProfile } = useAuth();
  const [connectOpen, setConnectOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [objective, setObjective] = useState<string>("");
  const [objSaved, setObjSaved] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

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
      setSyncMsg(ok ? "Synced just now." : "LeetCode didn't respond. Try again in a minute.");
    } catch {
      setSyncMsg("LeetCode didn't respond. Try again in a minute.");
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

  const displayName = profile?.username ?? "You";
  const email = user?.email ?? "";
  const lcHandle = profile?.leetcode_username;
  const synced = profile?.last_synced_at
    ? new Date(profile.last_synced_at).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
      })
    : null;

  const sections = [
    { id: "account", label: "Account" },
    { id: "leetcode", label: "LeetCode" },
    { id: "practice", label: "Practice" },
    { id: "squads", label: "Squads" },
    { id: "notifications", label: "Notifications" },
    { id: "privacy", label: "Privacy" },
  ];

  const notifRows: { id: keyof NotificationPrefs; label: string }[] = [
    { id: "push_enabled", label: "Push alerts on this device" },
    { id: "challenge", label: "New challenges" },
    { id: "squad", label: "Squad goals and recaps" },
    { id: "practice", label: "Practice and revenge reminders" },
    { id: "contests", label: "Contest reminders" },
  ];

  const rowCls =
    "flex min-h-[44px] items-center justify-between gap-3 border-b border-hairline px-4 py-3 last:border-b-0";

  return (
    <div className="mx-auto w-full max-w-content px-4 pb-16 md:px-10">
      <header className="flex flex-wrap items-center gap-4 pt-6">
        <Avatar name={displayName} src={profile?.avatar_url} size="xl" />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-3xl font-semibold tracking-tight">{displayName}</h1>
          <p className="mt-0.5 font-mono text-xs text-text-tertiary">@{displayName}</p>
          <div className="mt-1.5">
            <StreakChip count={profile?.streak ?? 0} alive={(profile?.streak ?? 0) > 0} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/u/${encodeURIComponent(displayName)}`}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-surface-overlay px-4 text-sm font-medium text-text-primary transition-colors hover:bg-[#272830]"
          >
            View public page
          </Link>
          <a
            href="#account"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md px-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
          >
            Edit profile
          </a>
        </div>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[200px_1fr]">
        <nav aria-label="Settings sections" className="hidden lg:block">
          <ul className="sticky top-6 space-y-1">
            {sections.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="flex min-h-[44px] items-center rounded-md px-3 text-sm font-medium text-text-secondary hover:bg-surface-raised hover:text-text-primary"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mx-auto w-full max-w-reading space-y-6">
          <section id="account" className="scroll-mt-6">
            <h2 className="text-lg font-semibold leading-[26px]">Account</h2>
            <div className="mt-2 rounded-xl border border-hairline bg-surface">
              <div className={rowCls}>
                <span className="text-sm text-text-secondary">Name</span>
                <span className="text-sm font-medium text-text-primary">{displayName}</span>
              </div>
              <div className={rowCls}>
                <span className="text-sm text-text-secondary">Username</span>
                <span className="font-mono text-sm text-text-primary">@{displayName}</span>
              </div>
              <div className={rowCls}>
                <span className="text-sm text-text-secondary">Email</span>
                <span className="truncate text-sm text-text-primary">{email || "—"}</span>
              </div>
            </div>
          </section>

          <section id="leetcode" className="scroll-mt-6">
            <h2 className="text-lg font-semibold leading-[26px]">LeetCode</h2>
            <div className="mt-2 rounded-xl border border-hairline bg-surface">
              {lcHandle ? (
                <>
                  <div className={rowCls}>
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm text-text-primary">{lcHandle}</p>
                      <p className="text-xs leading-5 text-text-tertiary">
                        {synced ? `Synced ${synced}` : "Connected"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        variant="secondary"
                        onClick={handleSyncNow}
                        loading={syncing}
                        className="min-h-[44px]"
                      >
                        {!syncing && "Sync now"}
                      </Button>
                      <Button variant="ghost" onClick={() => setConnectOpen(true)} className="min-h-[44px]">
                        Disconnect
                      </Button>
                    </div>
                  </div>
                  <div className={rowCls}>
                    <div>
                      <p className="text-sm font-medium text-text-primary">Import full history</p>
                      <p className="text-xs leading-5 text-text-secondary">
                        Pull every accepted solve so your sheets start complete.
                      </p>
                    </div>
                    <Button variant="ghost" onClick={() => setConnectOpen(true)} className="min-h-[44px]">
                      Import
                    </Button>
                  </div>
                </>
              ) : (
                <div className="px-4 py-4">
                  <p className="text-sm leading-6 text-text-secondary">
                    Connect LeetCode to verify your solves. Everything works without it.
                  </p>
                  <Button variant="secondary" onClick={() => setConnectOpen(true)} className="mt-3 min-h-[44px]">
                    Connect
                  </Button>
                </div>
              )}
            </div>
            {syncMsg && <p className="mt-1.5 text-xs leading-5 text-text-tertiary">{syncMsg}</p>}
          </section>

          <section id="practice" className="scroll-mt-6">
            <h2 className="text-lg font-semibold leading-[26px]">Practice</h2>
            <p className="mt-1 text-sm leading-6 text-text-secondary">What are you practicing for?</p>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {[
                { value: "internship", label: "Internship prep" },
                { value: "fulltime", label: "Full-time roles" },
                { value: "consistency", label: "Daily consistency" },
              ].map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => void handleObjective(o.value)}
                  aria-pressed={objective === o.value}
                  className={`min-h-[44px] cursor-pointer rounded-md border px-2 py-2 text-xs font-medium transition-colors ${
                    objective === o.value
                      ? "border-hairline-strong bg-surface-overlay text-text-primary"
                      : "border-hairline bg-transparent text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {objSaved && <p className="mt-1.5 text-xs leading-5 text-text-tertiary">Saved.</p>}
          </section>

          <section id="squads" className="scroll-mt-6">
            <h2 className="text-lg font-semibold leading-[26px]">Squads</h2>
            <div className="mt-2 rounded-xl border border-hairline bg-surface">
              <div className={rowCls}>
                <Link href="/squad" className="text-sm font-medium text-text-primary underline decoration-hairline-strong underline-offset-4 hover:decoration-text-primary">
                  Open your squad
                </Link>
                <Link
                  href="/squad"
                  className="inline-flex min-h-[44px] items-center rounded-md px-3 text-sm font-medium text-text-secondary hover:bg-surface-raised hover:text-text-primary"
                >
                  Open
                </Link>
              </div>
              <div className={rowCls}>
                <span className="text-sm text-text-secondary">Have an invite code?</span>
                <Link
                  href="/squad"
                  className="inline-flex min-h-[44px] items-center rounded-md px-3 text-sm font-medium text-text-secondary hover:bg-surface-raised hover:text-text-primary"
                >
                  Join with code
                </Link>
              </div>
            </div>
          </section>

          <section id="notifications" className="scroll-mt-6">
            <h2 className="text-lg font-semibold leading-[26px]">Notifications</h2>
            <div className="mt-2 rounded-xl border border-hairline bg-surface">
              {notifRows.map((r) => {
                const on = prefsLoaded ? notif[r.id] : DEFAULT_PREFS[r.id];
                return (
                  <div key={r.id} className={rowCls}>
                    <span className="text-sm text-text-primary">{r.label}</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={on}
                      aria-label={r.label}
                      onClick={() => saveNotif(r.id, !on)}
                      className="inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-end"
                    >
                      <span
                        className={`inline-flex h-6 w-11 items-center rounded-full p-0.5 transition-colors ${on ? "bg-primary" : "bg-surface-overlay"}`}
                      >
                        <span
                          className={`h-5 w-5 rounded-full bg-canvas transition-transform ${on ? "translate-x-5" : ""}`}
                        />
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
            <p className="mt-1.5 text-xs leading-5 text-text-tertiary">
              {notifSource === "server"
                ? "Saved across your devices."
                : "Saved on this device."}
            </p>
          </section>

          <section id="privacy" className="scroll-mt-6">
            <h2 className="text-lg font-semibold leading-[26px]">Privacy</h2>
            <p className="mt-1 text-sm leading-6 text-text-secondary">
              Default visibility for new approaches
            </p>
            <div className="mt-2">
              <SegmentedControl
                label="Default visibility for new approaches"
                value={approachVis}
                onChange={saveApproachVis}
                options={[
                  { value: "private", label: "Private" },
                  { value: "squad", label: "Squad" },
                  { value: "public", label: "Public" },
                ]}
              />
            </div>
            <p className="mt-1.5 text-xs leading-5 text-text-tertiary">
              Saved on this device. Notes stay private.
            </p>
          </section>

          <footer className="flex items-center justify-between gap-2 border-t border-hairline pt-4">
            <Button variant="ghost" onClick={() => void signOut()} className="min-h-[44px]">
              Sign out
            </Button>
            <button
              onClick={() => setDeleteOpen(true)}
              className="inline-flex min-h-[44px] cursor-pointer items-center rounded-md bg-error-tint px-4 text-sm font-medium text-error transition-opacity hover:opacity-80"
            >
              Delete account
            </button>
          </footer>
        </div>
      </div>

      <ConnectLeetCodeModal isOpen={connectOpen} onClose={() => setConnectOpen(false)} onConnected={() => void refreshProfile()} />

      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div aria-hidden className="modal-scrim fixed inset-0" onClick={() => setDeleteOpen(false)} />
          <div role="dialog" aria-modal="true" aria-label="Delete account" className="modal-panel relative z-10 w-full max-w-[480px] p-6">
            <h2 className="font-display text-2xl font-semibold tracking-tight">Delete account?</h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              This removes your profile, solves, and approaches. Your squad keeps going
              without you. This can&apos;t be undone.
            </p>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              Self-serve deletion isn&apos;t available yet — signing out keeps everything
              as it is. To request deletion, reply to any product email.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleteOpen(false)} className="min-h-[44px]">
                Keep my account
              </Button>
              <Button variant="secondary" onClick={() => void signOut()} className="min-h-[44px]">
                Sign out instead
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

