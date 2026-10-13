"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useSolving } from "@/components/providers/SolvingProvider";
import { PassSerial } from "@/components/pass/Pass";
import { Button } from "@/components/ui/Button";
import { DifficultyBadgeNew, PatternChip } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Skeleton } from "@/components/ui/States";
import { getSuggestionById, getChallengeChain } from "@/lib/data/suggestions";
import { chainState, CHAIN_STATE_LABEL } from "@/lib/chains";
import { track } from "@/lib/analytics";
import { Suggestion } from "@/types/database";

function fmtTime(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

// /c/[id] — challenge deep link (Bible §42): problem + target + message, no
// spoiler by default. Minimal friction: preview first, signup second, battle third.
export default function ChallengeDeepLinkPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { startSolving } = useSolving();
  const [item, setItem] = useState<Suggestion | null>(null);
  const [chain, setChain] = useState<Suggestion[]>([]);
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

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 pt-8">
        <div className="pass">
          <div className="pass-body space-y-4">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-5 w-40" />
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
      <div className="mx-auto max-w-md space-y-3 p-12 text-center">
        <p className="text-sm font-medium leading-5 text-text-primary">This challenge doesn&apos;t exist or was withdrawn.</p>
        <p className="text-sm leading-6 text-text-secondary">Start your own battle instead.</p>
        <Link
          href="/"
          className="inline-flex min-h-[44px] items-center rounded-md bg-primary px-4 text-sm font-medium leading-5 text-on-primary hover:bg-primary-hover"
        >
          Start a battle
        </Link>
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

  const fromName = item.from_profile?.username || "Rahul";
  const toName = item.to_profile?.username || "you";
  const beat = item.sender_time_sec != null ? fmtTime(item.sender_time_sec) : "38:11";
  const state = chainState(item);
  const stubStatus =
    state === "completed" ? "BEATEN" : state === "timed_out" ? "EXPIRED" : String(item.status ?? "OPEN").toUpperCase();
  const dueLine = item.deadline_at
    ? `DUE ${new Date(item.deadline_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }).toUpperCase()}`
    : "DUE 18 OCT";

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 pt-8 select-none">
      <div className="pass">
        <div className="pass-body space-y-4">
          <div className="flex items-center gap-3">
            <Avatar name={fromName} size="md" />
            <h1 className="type-title text-text-primary">
              {fromName} challenged {isRecipient ? "you" : `@${toName}`}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-semibold leading-7 text-text-primary">{item.problem_title}</span>
            <DifficultyBadgeNew difficulty={item.difficulty} />
            <span className="font-mono text-sm text-text-tertiary tnum">No. 127</span>
            <PatternChip label="Graphs" />
          </div>
          <div>
            <div className="text-xs leading-4 text-text-tertiary">Beat</div>
            <div className="type-mono-display text-text-primary tnum">{beat}</div>
          </div>
          {showNote && item.note ? (
            <blockquote className="rounded-md bg-well px-4 py-3 text-sm leading-6 text-text-secondary">
              &ldquo;{item.note}&rdquo;
            </blockquote>
          ) : item.spoiler ? (
            <p className="flex items-center gap-2 rounded-md bg-well px-4 py-3 text-sm leading-6 text-text-secondary">
              <Lock className="h-4 w-4" strokeWidth={1.5} />
              A hint unlocks when you finish.
            </p>
          ) : null}
          {item.deadline_at && (
            <p className="text-sm leading-6 text-text-secondary">
              Due {new Date(item.deadline_at).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" size="lg" className="min-h-[44px]" onClick={handleAccept}>
              {!user ? "Sign in to accept" : isRecipient ? "Accept challenge" : "Solve it too"}
            </Button>
            <Button
              variant="ghost"
              className="min-h-[44px]"
              onClick={() => router.push(`/challenges?problem=${item.problem_slug}`)}
            >
              Pass it on
            </Button>
          </div>
          {!user && (
            <p className="text-sm leading-6 text-text-secondary">
              New here? You can join and accept in under a minute.
            </p>
          )}
          {state === "timed_out" && (
            <p className="text-sm leading-6 text-text-secondary">
              This challenge is past its deadline. Solve it anyway, or pass it on.
            </p>
          )}
        </div>
        <div className="pass-stub">
          <PassSerial>FROM @{fromName.toUpperCase()}</PassSerial>
          <PassSerial>TO @{isRecipient ? "PREM" : toName.toUpperCase()}</PassSerial>
          <PassSerial>{dueLine}</PassSerial>
          <PassSerial>{stubStatus}</PassSerial>
        </div>
      </div>

      {chain.length > 1 && (
        <div className="card space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium leading-5 text-text-primary">
              Started by Prem → Rahul → you
            </span>
            <span className="font-mono text-xs text-text-tertiary tnum">
              {chain.length} {chain.length === 1 ? "hop" : "hops"}
            </span>
          </div>
          <div className="space-y-2">
            {chain.map((c, i) => (
              <div
                key={c.id}
                className="flex min-h-[44px] items-center gap-2 rounded-md border border-hairline bg-well px-3 py-2 text-sm leading-5"
              >
                <span className="font-mono text-text-tertiary tnum">{i + 1}.</span>
                <span className="font-medium text-text-primary">@{c.from_profile?.username}</span>
                <span className="text-text-tertiary">→</span>
                <span className="font-medium text-text-primary">@{c.to_profile?.username}</span>
                <span className="ml-auto text-xs font-medium leading-4 text-text-secondary">
                  {CHAIN_STATE_LABEL[chainState(c)]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <footer className="pt-4 text-center text-xs leading-4 text-text-tertiary">
        Mahayuddh · Practice DSA with your people
      </footer>
    </div>
  );
}
