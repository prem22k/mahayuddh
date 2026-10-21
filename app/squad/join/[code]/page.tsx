"use client";

import { profileHref } from "@/lib/profiles/username";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, CalendarDays, Copy, Check, Users } from "lucide-react";
import { copyText } from "@/lib/clipboard";
import { safeNext } from "@/lib/safeNext";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Skeleton } from "@/components/ui/States";
import { getMySquads, joinSquad, switchActiveSquad } from "@/lib/data/squads";
import { dataErrorMessage } from "@/lib/data/errors";
import { track } from "@/lib/analytics";

interface Preview {
  squad: { id: string; name: string; description: string | null; created_at?: string };
  member_count: number;
  sample_members: { profile: { username: string; avatar_url: string | null } }[];
  /** Who sent the link, when it was a personal referral. Null for a bare code. */
  invited_by: string | null;
}

/** Mirrors the cap /api/squads/join enforces, so a full squad says so up front. */
const SQUAD_CAP = 30;

const MEMBERSHIP_LINES = [
  { dot: "bg-primary", text: "Today’s problem, picked for your squad." },
  { dot: "bg-verified", text: "See who solved it, how fast, and how they thought." },
  { dot: "bg-pattern", text: "Friendly 1v1 challenges, no wagers." },
];

export default function SquadJoinPage() {
  const params = useParams<{ code: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();
  const code = (params.code || "").toUpperCase();
  // The referral token identifies who sent the link. It survives signup: this
  // is the difference between "you joined a squad" and "Priya brought you here".
  const ref = search.get("ref") ?? "";
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [copied, setCopied] = useState(false);
  // Signed-in members get "Open squad" instead of a join they already made.
  // Unknown (or a failed lookup) falls back to the ordinary, idempotent join.
  const [alreadyMember, setAlreadyMember] = useState(false);

  useEffect(() => {
    track("invite_opened", { invite_code: code, referred: Boolean(ref) });
    fetch(`/api/squads/preview/${code}${ref ? `?ref=${encodeURIComponent(ref)}` : ""}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(json.error || "No squad found for that code.");
          return;
        }
        setPreview(json as Preview);
      })
      .catch(() => setError("Couldn't load this invite. Check your connection."))
      .finally(() => setLoading(false));
  }, [code, ref]);

  const previewSquadId = preview?.squad.id ?? null;
  useEffect(() => {
    if (!user || !previewSquadId) {
      setAlreadyMember(false);
      return;
    }
    let cancelled = false;
    getMySquads(user.id)
      .then((mine) => {
        if (!cancelled) setAlreadyMember(mine.squads.some((s) => s.id === previewSquadId));
      })
      .catch(() => {
        if (!cancelled) setAlreadyMember(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, previewSquadId]);

  const handleJoin = async () => {
    if (!user) {
      // Same-origin continuation: after signup the user returns to this invite.
      const target = ref
        ? `/squad/join/${code}?ref=${encodeURIComponent(ref)}`
        : `/squad/join/${code}`;
      router.push(`/login?next=${encodeURIComponent(target)}`);
      return;
    }
    setJoining(true);
    setError(null);
    try {
      const joined = await joinSquad(code, ref || null);
      await refreshProfile();
      router.push("/squad");
      track("referral_join_completed", { squad_id: joined?.squad.id, referred: Boolean(ref) });
      track("squad_joined", { via: "invite", squad_id: joined?.squad.id, referred: Boolean(ref) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't join. Try again.");
    } finally {
      setJoining(false);
    }
  };

  // Already a member: make this the active squad (so /squad shows it), then go.
  const handleOpen = async () => {
    if (!preview) return;
    setJoining(true);
    setError(null);
    try {
      if (profile?.active_squad_id !== preview.squad.id) {
        await switchActiveSquad(preview.squad.id);
        await refreshProfile();
      }
      router.push("/squad");
    } catch (err) {
      setError(dataErrorMessage(err, "Couldn't open this squad. Try again."));
    } finally {
      setJoining(false);
    }
  };

  const handleCopy = async () => {
    if (await copyText(code)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Deep-continue (Wave D): the header sign-in carries ?next=<invite> through
  // safeNext — and keeps ?ref= inside that target, so the referral survives
  // auth instead of being dropped at the login form.
  const inviteTarget =
    safeNext(ref ? `/squad/join/${code}?ref=${encodeURIComponent(ref)}` : `/squad/join/${code}`) ??
    "/home";

  const full = preview != null && !alreadyMember && preview.member_count >= SQUAD_CAP;
  const createdAt = preview?.squad.created_at ? new Date(preview.squad.created_at) : null;
  const since =
    createdAt && !Number.isNaN(createdAt.getTime())
      ? `${createdAt.toLocaleDateString("en-US", { month: "short" })} ${createdAt.getFullYear()}`
      : null;
  const extraMembers = preview ? Math.max(0, preview.member_count - preview.sample_members.length) : 0;

  const card = loading ? (
    <InviteSkeleton />
  ) : error && !preview ? (
    <InviteCard>
      <PassHeader code={code} status={{ label: "Unavailable", tone: "error" }} />
      <div className="text-center">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
          That invite code doesn&apos;t work
        </h1>
      </div>
      <p
        role="alert"
        className="mt-5 rounded-md border border-error/30 bg-error-tint p-3 text-center text-sm leading-6 text-error"
      >
        {error} Check it with the person who sent it.
      </p>
      <Button
        variant="secondary"
        className="mt-3 h-11 w-full min-h-[44px] border border-hairline"
        onClick={() => router.push("/welcome")}
      >
        Start your own squad
      </Button>
    </InviteCard>
  ) : preview ? (
    <InviteCard>
      <PassHeader
        code={code}
        status={full ? { label: "Squad full", tone: "error" } : { label: "Open invite", tone: "verified" }}
      />

      {/* Who is already in. The person who sent the link is ringed in gold. */}
      <div className="mb-5 flex items-center justify-center sm:mb-6">
        <span className="inline-flex items-center -space-x-3 p-1">
          {preview.sample_members.slice(0, 5).map((m, i) => {
            const isInviter = preview.invited_by != null && m.profile.username === preview.invited_by;
            return (
              <Avatar
                key={`${m.profile.username}-${i}`}
                name={m.profile.username}
                src={m.profile.avatar_url}
                size="lg"
                className={cn(
                  "border-2 border-surface text-text-primary",
                  isInviter && "z-10 border-primary/70 bg-primary-tint font-semibold text-primary ring-2 ring-primary/20"
                )}
              />
            );
          })}
          {extraMembers > 0 && (
            <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-full border-2 border-surface bg-surface-overlay font-mono text-xs text-text-secondary tnum">
              +{extraMembers}
            </span>
          )}
        </span>
      </div>

      <div className="mb-4 text-center">
        <p className="mb-1 text-sm leading-6 text-text-secondary">
          {preview.invited_by ? (
            <>
              <Link
                href={profileHref(preview.invited_by)}
                className="font-medium text-text-primary underline decoration-hairline-strong underline-offset-4 hover:decoration-text-primary"
              >
                @{preview.invited_by}
              </Link>{" "}
              invited you to join
            </>
          ) : (
            "You were invited to join"
          )}
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
          {preview.squad.name}
        </h1>
      </div>

      <p className="mx-auto mb-5 max-w-[440px] text-center text-[15px] leading-relaxed text-text-secondary sm:mb-6">
        {preview.squad.description ? `${preview.squad.description} ` : ""}One problem a day.
      </p>

      {/* Squad facts: only what the public preview actually returns. */}
      <div
        className={cn(
          "mb-6 grid gap-2 rounded-lg border border-hairline bg-well p-2 sm:mb-7 sm:gap-2.5 sm:border-0 sm:bg-transparent sm:p-0",
          since ? "grid-cols-2" : "grid-cols-1"
        )}
      >
        <Fact
          icon={<Users className="h-4 w-4 text-text-secondary" strokeWidth={1.5} />}
          value={String(preview.member_count)}
          caption={preview.member_count === 1 ? "member" : "members"}
        />
        {since && (
          <Fact
            icon={<CalendarDays className="h-4 w-4 text-text-secondary" strokeWidth={1.5} />}
            value={since}
            caption="squad since"
          />
        )}
      </div>

      <div className="mb-5 flex flex-col gap-2">
        {error && (
          <p
            role="alert"
            className="rounded-md border border-error/30 bg-error-tint px-3 py-2 text-center text-xs leading-5 text-error"
          >
            {error}
          </p>
        )}
        {alreadyMember ? (
          <>
            <div className="rounded-md border border-hairline bg-surface-raised p-3 text-center text-sm text-text-secondary">
              You&apos;re already in <span className="font-medium text-text-primary">{preview.squad.name}</span>.
            </div>
            <Button
              variant="secondary"
              className="h-11 w-full min-h-[44px] border border-hairline"
              loading={joining}
              onClick={handleOpen}
            >
              Open squad
            </Button>
          </>
        ) : full ? (
          <>
            <div className="rounded-md border border-error/30 bg-error-tint p-3 text-center text-sm text-error">
              {preview.squad.name} is full ({SQUAD_CAP} members max).
            </div>
            <Button
              variant="secondary"
              className="h-11 w-full min-h-[44px] border border-hairline"
              onClick={() => router.push("/welcome")}
            >
              Start your own squad
            </Button>
          </>
        ) : (
          <Button
            variant="primary"
            size="lg"
            className="group w-full text-[15px]"
            loading={joining}
            onClick={handleJoin}
          >
            {!joining && (
              <>
                {user
                  ? `Join ${preview.squad.name}`
                  : preview.invited_by
                    ? `Join ${preview.squad.name}`
                    : "Create an account to join"}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
              </>
            )}
          </Button>
        )}
      </div>

      {/* Perforation: dashed with notches on phones, a plain rule on desktop. */}
      <div className="relative -mx-6 mb-4 border-t border-dashed border-hairline-strong sm:mx-0 sm:border-solid sm:border-hairline">
        <span aria-hidden className="absolute -left-2 -top-2 h-4 w-4 rounded-full border border-hairline bg-canvas sm:hidden" />
        <span aria-hidden className="absolute -right-2 -top-2 h-4 w-4 rounded-full border border-hairline bg-canvas sm:hidden" />
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-wider text-text-tertiary sm:font-sans sm:text-xs sm:normal-case sm:tracking-normal">
            Invite code:
          </span>
          <code className="rounded-xs border border-hairline bg-well px-2 py-1 font-mono text-xs font-semibold tracking-wider text-text-primary tnum">
            {code}
          </code>
        </div>
        <button
          onClick={() => void handleCopy()}
          aria-label="Copy invite code"
          className="inline-flex min-h-[44px] shrink-0 cursor-pointer items-center gap-1.5 rounded-sm border border-hairline px-2.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary sm:min-h-0 sm:border-transparent sm:py-1 sm:hover:border-hairline"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-verified" strokeWidth={1.5} />
          ) : (
            <Copy className="h-3.5 w-3.5" strokeWidth={1.5} />
          )}
          <span>
            {copied ? "Copied" : (
              <>
                Copy<span className="hidden sm:inline"> code</span>
              </>
            )}
          </span>
        </button>
      </div>
    </InviteCard>
  ) : null;

  const lines = (
    <section className="mx-auto mt-8 w-full max-w-[500px] px-3 sm:mt-10 sm:px-0" aria-label="What squad membership means">
      <h2 className="mb-3 font-mono text-[11px] uppercase tracking-wider text-text-tertiary">
        What squad membership means
      </h2>
      <ul className="space-y-2.5 text-sm text-text-secondary">
        {MEMBERSHIP_LINES.map((l) => (
          <li key={l.text} className="flex items-start gap-3">
            <span aria-hidden className={cn("mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full", l.dot)} />
            <span>{l.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );

  // Signed in, the app shell already draws the chrome around this page.
  if (user) {
    return (
      <div className="mx-auto w-full max-w-[560px] pb-8 pt-2 md:pt-6">
        {card}
        {!loading && preview && lines}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-text-primary">
      <header className="mx-auto flex h-14 w-full max-w-[1120px] items-center justify-between border-b border-hairline px-4 sm:px-8">
        <Link href="/welcome" className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-sm border border-hairline bg-surface-raised font-display text-sm font-semibold text-primary sm:text-text-primary">
            M
          </span>
          <span className="font-display text-base font-semibold tracking-tight">Mahayuddh</span>
        </Link>
        <Link
          href={`/login?next=${encodeURIComponent(inviteTarget)}`}
          className="inline-flex min-h-[44px] items-center rounded-sm border border-hairline px-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary sm:min-h-0 sm:border-transparent sm:py-1.5"
        >
          Sign in
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col items-center px-4 pb-16 pt-6 sm:justify-center sm:py-12">
        <div className="w-full max-w-[560px]">{card}</div>
        {!loading && preview && lines}
      </main>

      <footer className="mx-auto flex w-full max-w-[1120px] items-center justify-between gap-3 border-t border-hairline px-4 py-6 text-xs text-text-tertiary sm:px-8">
        <span>
          Mahayuddh <span aria-hidden>·</span> Practice with your own people
        </span>
      </footer>
    </div>
  );
}

function InviteCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-hairline bg-surface p-6 sm:p-8">
      <div aria-hidden className="absolute inset-x-4 top-0 h-px bg-edge-highlight" />
      {children}
    </div>
  );
}

function PassHeader({
  code,
  status,
}: {
  code: string;
  status: { label: string; tone: "verified" | "error" };
}) {
  return (
    <div className="mb-5 flex items-center justify-between gap-3 border-b border-hairline pb-4 sm:mb-6">
      <div className="flex min-w-0 items-center gap-2 font-mono text-[11px]">
        <span className="uppercase tracking-wider text-text-tertiary">Invite pass</span>
        <span aria-hidden className="text-text-disabled">
          ·
        </span>
        <span className="truncate text-text-secondary tnum">#{code}</span>
      </div>
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-xs border px-2 py-0.5 font-mono text-[11px] uppercase",
          status.tone === "verified"
            ? "border-verified/30 bg-verified-tint text-verified sm:border-hairline sm:bg-well sm:text-text-secondary"
            : "border-error/30 bg-error-tint text-error"
        )}
      >
        <span
          aria-hidden
          className={cn("h-1.5 w-1.5 rounded-full", status.tone === "verified" ? "bg-verified" : "bg-error")}
        />
        {status.label}
      </span>
    </div>
  );
}

function Fact({ icon, value, caption }: { icon: React.ReactNode; value: string; caption: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-md border border-hairline bg-surface-raised px-2.5 py-3 text-center">
      <span className="flex items-center gap-1.5">
        {icon}
        <span className="font-display text-base font-semibold text-text-primary tnum">{value}</span>
      </span>
      <span className="text-xs text-text-tertiary">{caption}</span>
    </div>
  );
}

function InviteSkeleton() {
  return (
    <div className="w-full rounded-xl border border-hairline bg-surface p-6 sm:p-8" aria-label="Loading invite">
      <Skeleton className="mb-6 h-4 w-48" />
      <div className="mb-6 flex justify-center -space-x-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-12 w-12 rounded-full border-2 border-surface" />
        ))}
      </div>
      <Skeleton className="mx-auto mb-2 h-4 w-32" />
      <Skeleton className="mx-auto mb-4 h-8 w-48" />
      <Skeleton className="mb-6 h-12 w-full" />
      <div className="mb-8 grid grid-cols-2 gap-2">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
      <Skeleton className="mb-4 h-12 w-full" />
      <Skeleton className="mx-auto h-5 w-40" />
    </div>
  );
}
