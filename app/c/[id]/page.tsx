"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Forward, LogIn, Play, SearchX, Swords, Waypoints } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useSolving } from "@/components/providers/SolvingProvider";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/States";
import { ChallengePass, type ProblemMeta } from "@/components/challenges/ChallengePass";
import { ChainTrack, chainNames } from "@/components/challenges/ChainTrack";
import { fmtClock, ticketOf } from "@/components/challenges/challengeFormat";
import { getSuggestionById, getChallengeChain } from "@/lib/data/suggestions";
import { getCatalogBySlugs } from "@/lib/data/problems";
import { chainState } from "@/lib/chains";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { Suggestion } from "@/types/database";

// /c/[id] — challenge deep link (Bible §42): problem + target + message, no
// spoiler by default. Minimal friction: preview first, signup second, battle third.
export default function ChallengeDeepLinkPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { startSolving } = useSolving();
  const [item, setItem] = useState<Suggestion | null>(null);
  const [chain, setChain] = useState<Suggestion[]>([]);
  const [meta, setMeta] = useState<ProblemMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    track("invite_opened", { challenge_id: params.id });
    Promise.all([getSuggestionById(params.id), getChallengeChain(params.id)])
      .then(([row, ch]) => {
        if (!row) setNotFound(true);
        else {
          setItem(row);
          setChain(ch);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [params.id]);

  // Catalog No. and pattern for the problem row; left off if the lookup fails.
  const slug = item?.problem_slug ?? "";
  useEffect(() => {
    if (!slug) return;
    let live = true;
    getCatalogBySlugs([slug])
      .then(([row]) => {
        if (live && row) setMeta({ number: String(row.question_id), pattern: row.topics?.[0] ?? null });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [slug]);

  // Signed out there is no app shell, so the page brings its own gutters and
  // a quiet brand bar; signed in, the shell's <main> already provides them.
  const frame = cn("mx-auto w-full max-w-[780px]", !user && "px-4 pb-12 pt-6 md:pt-10");

  if (loading) {
    return (
      <div className={cn(frame, "space-y-4")}>
        <div className="pass">
          <div className="pass-body space-y-4">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-48" />
            <Skeleton className="h-12 w-full" />
          </div>
          <div className="pass-stub">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
      </div>
    );
  }
  if (notFound || !item) {
    return (
      <div className={frame}>
        <div className="mx-auto max-w-md rounded-xl border border-hairline bg-surface px-6 py-12 text-center">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-hairline bg-surface-raised text-text-secondary">
            <SearchX className="h-6 w-6" strokeWidth={1.5} aria-hidden />
          </span>
          <p className="type-title text-text-primary">This challenge doesn&apos;t exist or was withdrawn.</p>
          <p className="mb-6 mt-2 text-[15px] leading-6 text-text-secondary">Start your own battle instead.</p>
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center rounded-md bg-primary px-5 text-sm font-medium leading-5 text-on-primary hover:bg-primary-hover"
          >
            Start a battle
          </Link>
        </div>
      </div>
    );
  }

  const isRecipient = user?.id === item.to_user;
  const showNote = !item.spoiler || isRecipient || item.status === "completed";

  const handleAccept = () => {
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(`/c/${item.id}`)}`);
      return;
    }
    track("challenge_accepted", { suggestion_id: item.id });
    startSolving({
      id: 1,
      title: item.problem_title,
      slug: item.problem_slug,
      difficulty: item.difficulty,
      category: "Squad Challenge",
    });
    router.push("/");
  };

  // Hand the composer the problem. The recipient also hands this challenge over
  // as the parent, so passing it on grows the chain; anyone else starts a fresh
  // challenge on the same problem.
  const passHref = `/challenges?${new URLSearchParams({
    problem: item.problem_slug,
    title: item.problem_title,
    difficulty: item.difficulty,
    ...(isRecipient ? { pass: item.id } : {}),
  }).toString()}`;

  const state = chainState(item);
  const beat = fmtClock(item.sender_time_sec);
  const hops = chain.length;
  // Fastest time anyone in the chain set when they sent or passed it on.
  const fastest = chain
    .filter((c) => c.sender_time_sec != null && c.from_profile?.username)
    .sort((a, b) => (a.sender_time_sec ?? 0) - (b.sender_time_sec ?? 0))[0];

  return (
    <div className={cn(frame, "select-none space-y-6")}>
      {!user && (
        <div className="flex items-center justify-between gap-3 border-b border-hairline pb-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/" className="flex items-center gap-2 font-display text-lg font-semibold tracking-[-0.01em] text-text-primary">
              <Swords className="h-[18px] w-[18px] text-text-secondary" strokeWidth={1.5} aria-hidden />
              Mahayuddh
            </Link>
            <span aria-hidden className="text-text-disabled">/</span>
            <span className="truncate font-mono text-xs font-medium uppercase tracking-[0.06em] text-text-tertiary tnum">
              <span className="hidden sm:inline">Challenge </span>
              {ticketOf(item.id)}
            </span>
          </div>
          <Link
            href={`/login?next=${encodeURIComponent(`/c/${item.id}`)}`}
            className="inline-flex min-h-[44px] shrink-0 items-center rounded-md px-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
          >
            Sign in
          </Link>
        </div>
      )}

      <ChallengePass
        item={item}
        viewerId={user?.id}
        meta={meta}
        variant="page"
        headingAs="h1"
        noteVisible={showNote}
        lockedCopy="A hint unlocks when you finish."
        actions={
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
            <Button variant="primary" size="lg" className="w-full text-[15px] md:w-auto" onClick={handleAccept}>
              {!user ? (
                <LogIn className="h-[18px] w-[18px]" strokeWidth={1.5} aria-hidden />
              ) : isRecipient ? (
                <Swords className="h-[18px] w-[18px]" strokeWidth={1.5} aria-hidden />
              ) : (
                <Play className="h-[18px] w-[18px]" strokeWidth={1.5} fill="currentColor" aria-hidden />
              )}
              {!user ? "Sign in to accept" : isRecipient ? "Accept challenge" : "Solve it too"}
            </Button>
            <Button
              variant="ghost"
              className="h-11 md:h-12 md:border md:border-hairline md:bg-surface-raised md:px-5 md:text-text-primary md:hover:bg-surface-overlay"
              onClick={() => router.push(passHref)}
            >
              <Forward className="h-4 w-4" strokeWidth={1.5} aria-hidden />
              Pass it on
            </Button>
          </div>
        }
        after={
          <>
            {!user && (
              <p className="-mt-2 text-sm leading-6 text-text-secondary">
                New here? You can join and accept in under a minute.
              </p>
            )}
            {state === "timed_out" && (
              <p className="-mt-2 text-sm leading-6 text-text-secondary">
                This challenge is past its deadline. Solve it anyway, or pass it on.
              </p>
            )}
          </>
        }
      />

      {chain.length > 1 && (
        <section aria-labelledby="chain-heading" className="space-y-4 rounded-xl border border-hairline bg-surface p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="chain-heading" className="flex items-center gap-2 text-sm font-medium leading-5 text-text-secondary">
              <Waypoints className="h-[18px] w-[18px] text-text-tertiary" strokeWidth={1.5} aria-hidden />
              Challenge chain
            </h2>
            <span className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-text-tertiary">
              Started by {chainNames(chain, user?.id)}
            </span>
          </div>
          <ChainTrack chain={chain} viewerId={user?.id} variant="full" className="px-0 md:px-2" />
          <div className="flex items-center justify-between gap-3 border-t border-hairline pt-3 text-[13px] leading-5 text-text-secondary">
            <span>
              {fastest ? (
                <>
                  Fastest set so far:{" "}
                  <span className="font-medium text-text-primary">@{fastest.from_profile?.username}</span>{" "}
                  <span className="font-mono tnum">{fmtClock(fastest.sender_time_sec)}</span>
                </>
              ) : beat ? (
                <>Time to beat: <span className="font-mono tnum">{beat}</span></>
              ) : (
                "No times set in this chain yet"
              )}
            </span>
            <span className="shrink-0 font-mono text-xs text-text-tertiary tnum">
              {hops} {hops === 1 ? "hop" : "hops"} logged
            </span>
          </div>
        </section>
      )}

      <footer className="pt-4 text-center text-xs leading-4 text-text-tertiary">
        Mahayuddh · Practice DSA with your people
      </footer>
    </div>
  );
}
