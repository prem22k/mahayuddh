"use client";

import React from "react";
import { Clock, Lock, Quote, Swords } from "lucide-react";
import { cn } from "@/lib/utils";
import { Pass, PassField, PassStubHeader } from "@/components/pass/Pass";
import { Avatar } from "@/components/ui/Avatar";
import { DifficultyBadgeNew, PatternChip } from "@/components/ui/Badge";
import type { Suggestion } from "@/types/database";
import { ChallengeStatusChip } from "./ChainTrack";
import { dueParts, fmtClock, handleOf, shortDate, ticketOf } from "./challengeFormat";

/** Catalog facts for the problem; both omitted when the lookup has nothing. */
export interface ProblemMeta {
  number: string | null;
  pattern: string | null;
}

/**
 * The 1v1 Challenge Pass (DESIGN.md "The four Passes" #4). `inbox` is the
 * hero on /challenges; `page` is the shareable /c/[id] pass. Only real
 * fields render: no deadline reads "No deadline", no time reads "Solve it".
 */
export function ChallengePass({
  item,
  viewerId,
  meta,
  variant = "inbox",
  headingAs: Heading = "h2",
  noteVisible,
  lockedCopy,
  actions,
  after,
}: {
  item: Suggestion;
  viewerId?: string | null;
  meta?: ProblemMeta | null;
  variant?: "inbox" | "page";
  headingAs?: "h1" | "h2";
  /** Whether the viewer may read the note (spoiler rules live with the caller). */
  noteVisible: boolean;
  /** Shown instead of the note when it is hidden from this viewer. */
  lockedCopy: string;
  actions: React.ReactNode;
  /** Helper lines under the actions (sign-in hint, past-deadline note). */
  after?: React.ReactNode;
}) {
  const page = variant === "page";
  const from = handleOf(item.from_profile);
  const to = handleOf(item.to_profile);
  const isRecipient = !!viewerId && viewerId === item.to_user;
  const headline = item.from_profile?.username
    ? `${from} challenged ${isRecipient ? "you" : to}`
    : isRecipient
      ? "You were challenged"
      : `A squad mate challenged ${to}`;
  const beat = fmtClock(item.sender_time_sec);
  const due = dueParts(item.deadline_at);
  const sent = shortDate(item.created_at);
  const sub = [item.parent_id ? "Passed on" : "Direct challenge", sent ? `sent ${sent}` : null]
    .filter(Boolean)
    .join(" · ");
  const note = (item.message ?? item.note ?? "").trim();

  const problem = (
    <>
      <span
        className={cn(
          "font-semibold text-text-primary",
          page ? "font-display text-lg leading-[26px] tracking-[-0.01em]" : "text-[15px] leading-6 md:text-[17px]"
        )}
      >
        {item.problem_title}
      </span>
      <DifficultyBadgeNew difficulty={item.difficulty} />
      {meta?.number && (
        <span className="font-mono text-xs font-medium tracking-[0.06em] text-text-tertiary tnum">
          No. {meta.number}
        </span>
      )}
      {meta?.pattern && <PatternChip label={meta.pattern} className={cn(page && "md:ml-auto")} />}
    </>
  );

  const body = (
    <div className={cn("flex flex-col", page ? "gap-6" : "gap-5")}>
      {/* Who · when */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar
            name={item.from_profile?.username ?? "Squad mate"}
            src={item.from_profile?.avatar_url}
            size={page ? "lg" : "md"}
            className={cn("border border-hairline-strong", page ? "h-11 w-11" : "h-9 w-9")}
          />
          <div className="min-w-0">
            <Heading
              className={cn(
                "break-words font-display font-semibold text-text-primary",
                page
                  ? "text-xl leading-tight tracking-[-0.015em] md:text-2xl"
                  : "text-[17px] leading-tight tracking-[-0.015em] md:text-xl"
              )}
            >
              {headline}
            </Heading>
            <p className={cn("mt-1 text-xs font-medium leading-4 text-text-tertiary", page && "font-mono tracking-[0.06em]")}>
              {sub}
            </p>
          </div>
        </div>
        <>
            {/* Desktop: due chip. Phone: stacked EXPIRY label. */}
            <span
              className={cn(
                "hidden h-7 shrink-0 items-center gap-1.5 rounded-xs border border-hairline bg-well px-2.5 font-mono text-[11px] font-medium tracking-[0.04em] text-text-secondary tnum md:inline-flex",
                page && "md:h-auto md:flex-col md:items-end md:gap-0.5 md:border-0 md:bg-transparent md:px-0"
              )}
            >
              {page ? (
                <>
                  <span className="text-[11px] uppercase tracking-[0.06em] text-text-tertiary">Time limit</span>
                  <span className="text-xs">{due ? `Due ${due.long}` : "No deadline"}</span>
                </>
              ) : (
                <>
                  <Clock className="h-3.5 w-3.5 text-text-tertiary" strokeWidth={1.5} aria-hidden />
                  {due ? `Due ${due.long} · ${due.time}` : "No deadline"}
                </>
              )}
            </span>
            <span className="flex shrink-0 flex-col items-end text-right md:hidden">
              <span className="text-[11px] font-medium uppercase leading-4 tracking-[0.06em] text-text-tertiary">
                Expiry
              </span>
              <span className="font-mono text-xs leading-4 text-text-secondary tnum">
                {due ? due.long : "None"}
              </span>
            </span>
          </>
      </div>

      {/* Problem */}
      {page ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-hairline bg-well px-4 py-3">
          {problem}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 md:gap-2.5">{problem}</div>
      )}

      {/* Target */}
      {page ? (
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-mono text-xs font-medium uppercase tracking-[0.06em] text-text-tertiary">
              Target objective
            </span>
            {beat && item.from_profile?.username && (
              <span className="truncate text-xs font-medium text-text-tertiary">Set by {from}</span>
            )}
          </div>
          <div className="mt-1 flex items-baseline gap-3">
            {beat && (
              <span className="font-mono text-sm uppercase leading-5 text-text-secondary">Beat</span>
            )}
            <span className="type-mono-display text-text-primary tnum">{beat ?? "Solve it"}</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1 rounded-md border border-hairline bg-well p-4 text-center md:flex-row md:items-center md:justify-between md:p-5 md:text-left">
          <div>
            <div className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-text-tertiary">
              Target objective
            </div>
            <div className="mt-1 font-mono text-[38px] font-medium uppercase leading-none tracking-[-0.02em] text-text-primary tnum md:text-[44px]">
              {beat ? `Beat ${beat}` : "Solve it"}
            </div>
          </div>
          <div className="hidden text-right text-xs font-medium leading-4 text-text-tertiary md:block">
            {beat ? (item.from_profile?.username ? `Benchmark set by ${from}` : "Time to beat") : "No time to beat"}
          </div>
        </div>
      )}

      {/* Note */}
      {noteVisible && note ? (
        <div
          className={cn(
            "flex items-start gap-2.5 rounded-md border border-hairline bg-surface-raised/70 px-4 py-2.5",
            !page && "max-md:rounded-l-none max-md:border-y-0 max-md:border-l-2 max-md:border-r-0 max-md:border-l-hairline-strong max-md:px-3"
          )}
        >
          <Quote className="mt-1 h-4 w-4 shrink-0 text-text-tertiary max-md:hidden" strokeWidth={1.5} aria-hidden />
          <p className={cn("italic text-text-secondary", page ? "text-[15px] leading-6" : "text-[13px] leading-5 md:text-sm md:leading-6")}>
            &ldquo;{note}&rdquo;
          </p>
        </div>
      ) : item.spoiler && !noteVisible && note ? (
        <div className="flex items-center gap-3 rounded-md border border-hairline bg-surface-raised/70 px-4 py-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-hairline bg-surface text-text-tertiary">
            <Lock className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
          </span>
          <p className="text-sm leading-5 text-text-secondary">{lockedCopy}</p>
        </div>
      ) : null}

      <div className="pt-1">{actions}</div>
      {after}
    </div>
  );

  return (
    <Pass
      stubClassName={cn("md:justify-start", page ? "md:w-[220px] md:flex-none" : "md:gap-4")}
      body={body}
      stub={<ChallengeStub item={item} variant={variant} />}
    />
  );
}

/**
 * Stub: TICKET (from the challenge id), FROM, TO, the deadline and the status.
 * Desktop is the vertical ledger; phone is one line (inbox) or a 2x2 grid (page).
 */
export function ChallengeStub({ item, variant = "inbox" }: { item: Suggestion; variant?: "inbox" | "page" }) {
  const from = `FROM ${handleOf(item.from_profile, "a squad mate")}`;
  const to = `TO ${handleOf(item.to_profile, "a squad mate")}`;
  const due = dueParts(item.deadline_at);
  const dueValue = due ? `DUE ${due.stub}` : "NO DEADLINE";
  const ticket = ticketOf(item.id);

  return (
    <>
      <div className="hidden flex-col gap-5 md:flex">
        <PassStubHeader label="CHALLENGE PASS" icon={<Swords className="h-4 w-4" strokeWidth={1.5} />} />
        <div className="flex flex-col gap-3">
          <PassField label="Serial">{ticket}</PassField>
          <PassField label="Originator">{from}</PassField>
          <PassField label="Recipient">{to}</PassField>
          <PassField label="Expiration">{dueValue}</PassField>
        </div>
        <div className="flex flex-col gap-1.5 border-t border-hairline pt-4">
          <span className="font-mono text-[10px] font-medium uppercase leading-4 tracking-[0.06em] text-text-tertiary">
            Status
          </span>
          <ChallengeStatusChip item={item} className="self-start uppercase" />
        </div>
      </div>

      {variant === "page" ? (
        <div className="flex flex-col gap-4 md:hidden">
          <div className="flex items-center justify-between border-b border-hairline pb-3 font-mono text-xs font-medium uppercase tracking-[0.06em] text-text-tertiary">
            <span>Ticket stub</span>
            <span className="tnum">Serial {ticket}</span>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            <PassField label="Originator">{from}</PassField>
            <PassField label="Recipient">{to}</PassField>
            <PassField label="Expiration">{dueValue}</PassField>
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[10px] font-medium uppercase leading-4 tracking-[0.06em] text-text-tertiary">
                Status
              </span>
              <ChallengeStatusChip item={item} className="self-start uppercase" />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 md:hidden">
          <div className="min-w-0 space-y-0.5 font-mono font-medium uppercase tracking-[0.06em]">
            <p className="break-words text-[11px] leading-4 text-text-secondary">
              {from} · {to}
            </p>
            <p className="truncate text-[10px] leading-4 text-text-tertiary tnum">
              Serial {ticket} · {dueValue}
            </p>
          </div>
          <ChallengeStatusChip item={item} className="uppercase" />
        </div>
      )}
    </>
  );
}
