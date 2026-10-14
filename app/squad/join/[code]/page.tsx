"use client";

import { profileHref } from "@/lib/profiles/username";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Copy, Check } from "lucide-react";
import { copyText } from "@/lib/clipboard";
import { safeNext } from "@/lib/safeNext";
import { useAuth } from "@/components/providers/AuthProvider";
import { PageLoader } from "@/components/ui/PageLoader";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { joinSquad } from "@/lib/data/squads";
import { track } from "@/lib/analytics";

interface Preview {
  squad: { id: string; name: string; description: string | null };
  member_count: number;
  sample_members: { profile: { username: string; avatar_url: string | null } }[];
  /** Who sent the link, when it was a personal referral. Null for a bare code. */
  invited_by: string | null;
}

export default function SquadJoinPage() {
  const params = useParams<{ code: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const { user, refreshProfile } = useAuth();
  const code = (params.code || "").toUpperCase();
  // The referral token identifies who sent the link. It survives signup: this
  // is the difference between "you joined a squad" and "Priya brought you here".
  const ref = search.get("ref") ?? "";
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [copied, setCopied] = useState(false);

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

  if (loading) return <PageLoader label="Loading invite..." />;

  // Deep-continue (Wave D): the header sign-in carries ?next=<invite> through
  // safeNext — and keeps ?ref= inside that target, so the referral survives
  // auth instead of being dropped at the login form.
  const inviteTarget =
    safeNext(ref ? `/squad/join/${code}?ref=${encodeURIComponent(ref)}` : `/squad/join/${code}`) ??
    "/home";

  return (
    <div className="min-h-screen bg-canvas text-text-primary">
      <header className="flex h-14 items-center justify-between px-4 md:px-10">
        <Link href="/welcome" className="font-display text-lg font-semibold tracking-tight">
          Mahayuddh
        </Link>
        {!user && (
          <Link
            href={`/login?next=${encodeURIComponent(inviteTarget)}`}
            className="inline-flex min-h-[44px] items-center rounded-md px-3 text-sm font-medium text-text-secondary hover:bg-surface-raised hover:text-text-primary"
          >
            Sign in
          </Link>
        )}
      </header>

      <main className="mx-auto w-full max-w-[560px] px-4 pb-16 pt-6">
        {error && !preview ? (
          <div className="rounded-xl border border-hairline bg-surface p-8 text-center">
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              That invite code doesn&apos;t work
            </h1>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              {error} Check it with the person who sent it.
            </p>
            <Button variant="secondary" className="mt-5 min-h-[44px]" onClick={() => router.push("/welcome")}>
              Start your own squad
            </Button>
          </div>
        ) : preview ? (
          <>
            <section className="rounded-xl border border-hairline bg-surface p-6 sm:p-8">
              <div className="flex items-center justify-center">
                <span className="inline-flex items-center">
                  {preview.sample_members.slice(0, 5).map((m, i) => (
                    <Avatar
                      key={`${m.profile.username}-${i}`}
                      name={m.profile.username}
                      src={m.profile.avatar_url}
                      size="lg"
                      className={i > 0 ? "-ml-3 ring-2 ring-surface" : "ring-2 ring-surface"}
                    />
                  ))}
                </span>
              </div>
              <p className="mt-5 text-center text-sm leading-6 text-text-secondary">
                {preview.invited_by ? (
                  <>
                    <Link
                      href={profileHref(preview.invited_by)}
                      className="font-medium text-text-primary underline underline-offset-4"
                    >
                      @{preview.invited_by}
                    </Link>{" "}
                    invited you to
                  </>
                ) : (
                  "You were invited to"
                )}
              </p>
              <h1 className="mt-1 text-center font-display text-4xl font-semibold leading-tight tracking-tight">
                {preview.squad.name}
              </h1>
              {preview.squad.description && (
                <p className="mx-auto mt-2 max-w-sm text-center text-sm leading-6 text-text-secondary">
                  {preview.squad.description}
                </p>
              )}
              <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs leading-5 text-text-tertiary">
                <span>
                  {preview.member_count} member{preview.member_count === 1 ? "" : "s"}
                </span>
                <span aria-hidden>·</span>
                <span>One problem a day</span>
              </div>
              {error && (
                <p role="alert" className="mt-4 rounded-md border border-error/30 bg-error-tint px-3 py-2 text-xs leading-5 text-error">
                  {error}
                </p>
              )}
              <Button
                variant="primary"
                size="lg"
                className="mt-6 w-full min-h-[44px]"
                loading={joining}
                onClick={handleJoin}
              >
                {!joining &&
                  (user
                    ? `Join ${preview.squad.name}`
                    : preview.invited_by
                      ? `Join ${preview.squad.name}`
                      : "Create an account to join")}
              </Button>
              <button
                onClick={async () => {
                  if (await copyText(code)) {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }
                }}
                aria-label="Copy invite code"
                className="mt-2 inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-hairline bg-transparent px-3 font-mono text-xs text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
              >
                {copied ? <Check className="h-3.5 w-3.5" strokeWidth={1.5} /> : <Copy className="h-3.5 w-3.5" strokeWidth={1.5} />}
                <span>{copied ? "Copied" : `Code ${code}`}</span>
              </button>
            </section>

            <section className="mx-auto mt-6 max-w-sm space-y-1.5 text-center">
              <p className="text-xs leading-5 text-text-tertiary">Today&apos;s problem, picked for your squad.</p>
              <p className="text-xs leading-5 text-text-tertiary">See who solved it, how fast, and how they thought.</p>
              <p className="text-xs leading-5 text-text-tertiary">Friendly 1v1 challenges, no wagers.</p>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
