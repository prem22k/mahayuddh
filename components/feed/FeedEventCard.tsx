"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowRightLeft,
  ArrowUpRight,
  BadgeCheck,
  BookOpen,
  Ellipsis,
  Eye,
  Flag,
  Flame,
  Lightbulb,
  Swords,
  Target,
  Timer,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import {
  VerifiedBadge,
  SelfReportedBadge,
  DifficultyBadgeNew,
  PatternChip,
} from "@/components/ui/Badge";
import { blockUser, reportFeedEvent, type RankedFeedEvent } from "@/lib/data/feed";
import { dataErrorMessage } from "@/lib/data/errors";
import { FEED_ACTIONS, actionabilityLabel } from "@/lib/feedPolicy";
import { LEVEL_LABEL } from "@/lib/stuckLadder";
import { titleFromSlug } from "@/lib/format";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import type { StuckLevel } from "@/types/database";

/** Catalog facts for a slug, looked up once per page of events. */
export interface ProblemMeta {
  title: string;
  number: string | null;
  difficulty: string | null;
}

const TYPE_LABEL: Record<string, string> = {
  solve: "solved",
  solved: "solved",
  challenge: "challenged",
  complete: "completed",
  completed: "completed",
  squad_milestone: "squad",
  stuck: "stuck",
  teach: "taught",
  resource: "shared",
  contest: "contest",
  improve: "improved",
  suggested: "suggested",
  streak: "streak",
  discuss: "discussed",
};

export function timeAgo(iso: string): string {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function fmtClock(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

function metaNumber(ev: RankedFeedEvent, key: string): number | null {
  const v = ev.metadata?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function metaDuration(ev: RankedFeedEvent): number | null {
  return metaNumber(ev, "duration_sec");
}

function metaPattern(ev: RankedFeedEvent): string | null {
  const v = ev.metadata?.pattern;
  return typeof v === "string" && v.length > 0 ? v : null;
}

function metaVerified(ev: RankedFeedEvent): boolean | null {
  const v = ev.metadata?.verified ?? ev.metadata?.evidence;
  if (v === true || v === "leetcode" || v === "verified") return true;
  if (v === false || v === "self" || v === "self-reported") return false;
  return null;
}

/** Optional one-line note the author added in the composer. Old rows have none. */
function metaCaption(ev: RankedFeedEvent): string | null {
  const v = ev.metadata?.caption;
  return typeof v === "string" && v.trim().length > 0 ? v.trim().slice(0, 280) : null;
}

function metaLevel(ev: RankedFeedEvent): StuckLevel | null {
  const v = ev.metadata?.level;
  return typeof v === "string" && v in LEVEL_LABEL ? (v as StuckLevel) : null;
}

function isSolve(ev: RankedFeedEvent) {
  return ev.event_type === "solve" || ev.event_type === "solved";
}

/** Plain-text sentence for the row; the visible headline is the styled version of it. */
export function describe(ev: RankedFeedEvent, meta?: ProblemMeta): string {
  const who = ev.actor?.username ? `@${ev.actor.username}` : "Someone";
  const title = ev.problem_title || meta?.title || null;
  switch (ev.event_type) {
    case "solve":
    case "solved": {
      const t = metaDuration(ev);
      return `${who} solved ${title || "a problem"}${t != null ? ` in ${fmtClock(t)}` : ""}`;
    }
    case "challenge":
      return `${who} sent a challenge${title ? `: ${title}` : ""}`;
    case "complete":
    case "completed":
      return `${who} completed a challenge${title ? `: ${title}` : ""}`;
    case "teach":
      return `${who} explained ${title || "an approach"}`;
    case "resource":
      return `${who} shared a resource${title ? `: ${title}` : ""}`;
    case "discuss":
      return `${who} started a discussion on ${title || ev.problem_slug || "a problem"}`;
    default:
      return `${who} · ${TYPE_LABEL[ev.event_type] || ev.event_type}`;
  }
}

/** §51 primitives on every row. Narrow by design — no moderation platform. */
function RowMenu({
  ev,
  onDone,
}: {
  ev: RankedFeedEvent;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const run = async (action: "report" | "block" | "delete") => {
    const spec = FEED_ACTIONS.find((a) => a.id === action);
    if (!spec) return;
    if (spec.confirm && !window.confirm(spec.confirm)) return;
    setBusy(true);
    setNote(null);
    try {
      if (action === "report") {
        await reportFeedEvent(ev.id, "noise");
        track("feed_reported", { event_type: ev.event_type });
        setNote("Reported. It leaves your feeds.");
      } else if (action === "block") {
        await blockUser(ev.user_id);
        track("feed_blocked", {});
        setNote("Blocked.");
      }
      setOpen(false);
      onDone();
    } catch (err) {
      setNote(dataErrorMessage(err, "That didn't work."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative -mr-2 -mt-2 shrink-0 md:-mr-1 md:-mt-1">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="More actions"
        aria-expanded={open}
        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-raised hover:text-text-primary md:min-h-0 md:min-w-0 md:p-1.5"
      >
        <Ellipsis className="h-[18px] w-[18px]" strokeWidth={1.5} />
      </button>
      {open && (
        <>
          <button
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div className="popover-panel absolute right-0 top-full z-20 mt-1 min-w-[9rem] p-1.5">
            {/* Feed events have no delete path yet, so the menu offers only what
                works: report and block, on other people's posts. */}
            {FEED_ACTIONS.filter((a) => a.id !== "delete").map((a) => (
              <button
                key={a.id}
                disabled={busy}
                onClick={() => void run(a.id)}
                className="block min-h-[44px] w-full rounded-md px-3 py-2 text-left text-sm font-medium text-text-secondary transition-colors hover:bg-surface-overlay hover:text-text-primary disabled:opacity-40 md:min-h-0"
              >
                {a.label}
              </button>
            ))}
          </div>
        </>
      )}
      {note && (
        <span className="absolute right-0 top-full z-20 mt-1 whitespace-nowrap text-xs text-text-tertiary">
          {note}
        </span>
      )}
    </div>
  );
}

/**
 * Row actions: a bordered 32px chip on phones (with a 44px hit area), a quiet
 * ghost button from md up — the two Stitch frames draw them differently.
 */
export const feedActionCls =
  "relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors before:absolute before:inset-x-0 before:-inset-y-1.5 md:text-sm md:before:hidden";
const actionTone = {
  quiet:
    "border-hairline bg-surface-raised text-text-primary hover:border-hairline-strong md:border-transparent md:bg-transparent md:text-text-secondary md:hover:bg-surface-raised md:hover:text-text-primary",
  gold: "border-hairline bg-primary-tint text-primary hover:border-hairline-strong md:border-transparent md:bg-transparent md:text-text-secondary md:hover:bg-surface-raised md:hover:text-text-primary",
  raised:
    "border-hairline bg-surface-raised text-text-primary hover:border-hairline-strong hover:bg-surface-overlay",
} as const;

function ActionLink({
  href,
  onClick,
  icon,
  tone = "quiet",
  children,
}: {
  href: string;
  onClick?: () => void;
  icon?: React.ReactNode;
  tone?: keyof typeof actionTone;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} onClick={onClick} className={cn(feedActionCls, actionTone[tone])}>
      {icon}
      {children}
    </Link>
  );
}

const iconCls = "h-4 w-4";

/** Mini proof embed for solve rows: title, number, pattern, time. */
function MiniProof({ ev, meta }: { ev: RankedFeedEvent; meta?: ProblemMeta }) {
  const t = metaDuration(ev);
  const pattern = metaPattern(ev);
  const difficulty = ev.difficulty ? String(ev.difficulty) : meta?.difficulty ?? null;
  const title = ev.problem_title || meta?.title || "A problem";
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-hairline bg-well p-3 md:p-3.5">
      <div className="min-w-0 flex-1 space-y-2 md:space-y-1.5">
        <div className="flex min-w-0 items-center justify-between gap-2 md:justify-start">
          <span className="truncate text-sm font-semibold text-text-primary md:font-medium">
            {title}
          </span>
          {meta?.number && (
            <span className="shrink-0 font-mono text-xs font-medium tracking-[0.06em] text-text-tertiary tnum">
              No. {meta.number}
            </span>
          )}
        </div>
        {(pattern || difficulty || t != null) && (
          <div className="flex flex-wrap items-center justify-between gap-2 md:justify-start">
            <span className="flex flex-wrap items-center gap-2">
              {pattern && <PatternChip label={pattern} className="h-6 rounded-xs px-2" />}
              {difficulty && <DifficultyBadgeNew difficulty={difficulty} size="sm" />}
            </span>
            {t != null && (
              <span className="inline-flex h-6 items-center gap-1 rounded-xs border border-hairline bg-verified-tint px-2 font-mono text-sm font-medium text-verified tnum md:hidden">
                <Timer className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                {fmtClock(t)}
              </span>
            )}
          </div>
        )}
      </div>
      {t != null && (
        <span className="hidden shrink-0 text-right type-mono-lg tracking-tight text-primary md:block">
          {fmtClock(t)}
        </span>
      )}
    </div>
  );
}

/** A quote the author attached. Teaching reads as an excerpt; everything else as a note. */
function Caption({ text, teach }: { text: string; teach: boolean }) {
  return teach ? (
    <blockquote className="rounded-md border-l-2 border-pattern bg-well/60 p-3 text-sm leading-6 text-text-primary">
      &ldquo;{text}&rdquo;
    </blockquote>
  ) : (
    <blockquote className="border-l-2 border-primary/40 pl-3 text-sm italic leading-6 text-text-secondary">
      &ldquo;{text}&rdquo;
    </blockquote>
  );
}

export function FeedEventCard({
  ev,
  meta,
  viewerId,
  onChanged,
}: {
  ev: RankedFeedEvent;
  meta?: ProblemMeta;
  viewerId: string | null;
  onChanged: () => void;
}) {
  const name = ev.actor?.username ?? "Someone";
  const isSelf = viewerId != null && ev.user_id === viewerId;
  const solve = isSolve(ev);
  const title = ev.problem_title || meta?.title || (ev.problem_slug ? titleFromSlug(ev.problem_slug) : null);
  const t = metaDuration(ev);
  const verified = metaVerified(ev);
  const caption = metaCaption(ev);
  const level = metaLevel(ev);
  const pattern = metaPattern(ev);
  const difficulty = ev.difficulty ? String(ev.difficulty) : meta?.difficulty ?? null;
  const usefulness = Number(ev.usefulness ?? 0);
  const milestone = ev.event_type === "squad_milestone" || ev.event_type === "streak";

  // The problem title is the row's "Open": same destination and event as the
  // old Open button, without spending a slot in the action row on it.
  const object = (fallback: string) =>
    title ? (
      ev.problem_slug ? (
        <Link
          href={`/practice/${ev.problem_slug}`}
          onClick={() => track("feed_action", { via: "open_problem" })}
          className="font-medium text-text-primary underline-offset-[3px] hover:underline"
        >
          {title}
        </Link>
      ) : (
        <span className="font-medium text-text-primary">{title}</span>
      )
    ) : (
      <span>{fallback}</span>
    );

  let verb: React.ReactNode;
  switch (ev.event_type) {
    case "solve":
    case "solved":
      verb = (
        <>
          solved {object("a problem")}
          {t != null && (
            <>
              {" "}in <span className="font-mono text-text-primary tnum">{fmtClock(t)}</span>
            </>
          )}
        </>
      );
      break;
    case "challenge":
      verb = <>sent a challenge{title ? <> on {object("")}</> : null}</>;
      break;
    case "complete":
    case "completed":
      verb = <>completed a challenge{title ? <> on {object("")}</> : null}</>;
      break;
    case "teach":
      verb = <>explained {object("an approach")}</>;
      break;
    case "resource":
      verb = <>shared {object("a resource")}</>;
      break;
    case "discuss":
      verb = <>started a discussion on {object(ev.problem_slug || "a problem")}</>;
      break;
    case "stuck":
      verb = (
        <>
          asked for {level ? `a ${LEVEL_LABEL[level].toLowerCase()}` : "help"}
          {title ? <> on {object("")}</> : null}
        </>
      );
      break;
    case "improve":
      verb = <>got faster on {object("a problem")}</>;
      break;
    case "squad_milestone": {
      const goal = ev.metadata?.kind === "goal_set" && typeof ev.metadata?.title === "string"
        ? (ev.metadata.title as string)
        : null;
      verb = goal ? (
        <>
          set a squad goal: <span className="font-medium text-text-primary">{goal}</span>
        </>
      ) : (
        <>hit a squad milestone</>
      );
      break;
    }
    default:
      verb = <>· {TYPE_LABEL[ev.event_type] || ev.event_type}</>;
  }

  // Inline flow rather than flex items: the sentence wraps word by word on
  // phones instead of dropping the whole verb phrase onto its own line.
  const tag = "ml-1.5 align-middle";
  const headline = (
    <p className="text-sm leading-6 text-text-secondary">
      <span className="font-semibold text-text-primary">{name}</span> {verb}
      {solve && verified === true && (
        <>
          <VerifiedBadge
            className={cn(tag, "hidden h-5 rounded-full border border-verified/25 px-2 text-[11px] md:inline-flex")}
          />
          <BadgeCheck
            className="ml-1 inline-block h-4 w-4 align-[-3px] text-verified md:hidden"
            strokeWidth={1.75}
            aria-label="Verified"
          />
        </>
      )}
      {solve && verified === false && <SelfReportedBadge className={cn(tag, "h-5 text-[11px]")} />}
      {ev.event_type === "teach" && pattern && (
        <PatternChip label={pattern} className={cn(tag, "h-5 rounded-xs px-2 text-[11px]")} />
      )}
      {(ev.event_type === "challenge" || ev.event_type === "complete" || ev.event_type === "completed") &&
        difficulty && <DifficultyBadgeNew difficulty={difficulty} size="sm" className={tag} />}
    </p>
  );

  if (milestone) {
    return (
      <article
        aria-label={describe(ev, meta)}
        className="flex items-center justify-between gap-3 rounded-lg border border-hairline bg-surface p-3 transition-colors hover:border-hairline-strong md:p-4"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-primary/30 bg-primary-tint text-primary md:h-10 md:w-10 md:rounded-full">
            <Flame className="h-5 w-5" strokeWidth={1.5} fill="currentColor" aria-hidden />
          </span>
          <div className="min-w-0">
            {headline}
            <p className="text-xs text-text-tertiary">{timeAgo(ev.created_at)}</p>
          </div>
        </div>
        {!isSelf && <RowMenu ev={ev} onDone={onChanged} />}
      </article>
    );
  }

  // One primary destination per kind. Solves get Compare + Challenge, the
  // rest get the object they point at.
  const actions: React.ReactNode[] = [];
  if (solve && ev.problem_slug) {
    actions.push(
      <ActionLink
        key="compare"
        href={`/practice/${ev.problem_slug}/compare`}
        onClick={() => track("feed_action", { via: "compare" })}
        icon={<ArrowRightLeft className={iconCls} strokeWidth={1.5} aria-hidden />}
      >
        Compare
      </ActionLink>
    );
  }
  if (solve && !isSelf && ev.actor) {
    actions.push(
      <ActionLink
        key="challenge"
        href={`/challenges?to=${ev.user_id}`}
        onClick={() => track("feed_action", { via: "challenge_back" })}
        tone="gold"
        icon={<Swords className={iconCls} strokeWidth={1.5} aria-hidden />}
      >
        Challenge {name}
      </ActionLink>
    );
  }
  if (ev.event_type === "teach" && ev.object_type === "approach" && ev.object_id) {
    actions.push(
      <ActionLink
        key="read"
        href={`/approach/${ev.object_id}`}
        onClick={() => track("feed_action", { via: "read_approach" })}
        icon={<BookOpen className={iconCls} strokeWidth={1.5} aria-hidden />}
      >
        Read approach
      </ActionLink>
    );
  }
  if (ev.event_type === "challenge" || ev.event_type === "complete" || ev.event_type === "completed") {
    actions.push(
      <ActionLink
        key="view"
        href="/challenges"
        onClick={() => track("feed_action", { via: "view_challenge" })}
        icon={<Eye className={iconCls} strokeWidth={1.5} aria-hidden />}
      >
        View challenge
      </ActionLink>
    );
  }
  if (ev.event_type === "stuck") {
    actions.push(
      <ActionLink
        key="help"
        href="/stuck"
        onClick={() => track("feed_action", { via: "help" })}
        tone="raised"
        icon={<Lightbulb className="h-4 w-4 text-primary" strokeWidth={1.5} aria-hidden />}
      >
        {ev.actor ? `Help ${name}` : "Help"}
      </ActionLink>
    );
  }
  if (
    actions.length === 0 &&
    ev.problem_slug &&
    !solve &&
    ev.event_type !== "stuck"
  ) {
    actions.push(
      <ActionLink
        key="open"
        href={`/practice/${ev.problem_slug}`}
        onClick={() => track("feed_action", { via: "open_problem" })}
        icon={<ArrowUpRight className={iconCls} strokeWidth={1.5} aria-hidden />}
      >
        Open
      </ActionLink>
    );
  }

  const improvedFrom = metaNumber(ev, "previous_failed_sec");
  const improvedTo = metaNumber(ev, "solved_sec");

  return (
    <article
      aria-label={describe(ev, meta)}
      className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-3 transition-colors hover:border-hairline-strong md:p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2 md:gap-3">
          <Avatar name={name} src={ev.actor?.avatar_url} size="md" className="md:h-9 md:w-9" />
          <div className="min-w-0">
            {headline}
            <p className="text-xs text-text-tertiary">{timeAgo(ev.created_at)}</p>
          </div>
        </div>
        {!isSelf && <RowMenu ev={ev} onDone={onChanged} />}
      </div>

      {solve && (ev.problem_title || ev.problem_slug) && <MiniProof ev={ev} meta={meta} />}

      {ev.event_type === "stuck" ? (
        (level || caption) && (
          <div className="space-y-1.5 rounded-md border border-hairline bg-well p-3">
            {level && (
              <span className="inline-flex h-5 items-center rounded-xs border border-primary/20 bg-primary-tint px-1.5 font-mono text-xs font-medium tracking-[0.06em] text-primary">
                {LEVEL_LABEL[level]}
              </span>
            )}
            {caption && (
              <p className="text-xs italic leading-5 text-text-secondary">&ldquo;{caption}&rdquo;</p>
            )}
          </div>
        )
      ) : (
        caption && <Caption text={caption} teach={ev.event_type === "teach"} />
      )}

      {ev.event_type === "challenge" && t != null && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-hairline bg-well p-3">
          <span className="flex items-center gap-2.5 text-xs text-text-secondary">
            <Flag className="h-[18px] w-[18px] text-primary" strokeWidth={1.5} aria-hidden />
            Target
          </span>
          <span className="font-mono text-sm font-semibold text-primary tnum">Beat {fmtClock(t)}</span>
        </div>
      )}

      {ev.event_type === "improve" && improvedTo != null && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-hairline bg-well p-3">
          <span className="flex items-center gap-2.5 text-xs text-text-secondary">
            <Target className="h-[18px] w-[18px] text-verified" strokeWidth={1.5} aria-hidden />
            {improvedFrom != null ? `Failed at ${fmtClock(improvedFrom)} before` : "Solved"}
          </span>
          <span className="font-mono text-sm font-semibold text-verified tnum">{fmtClock(improvedTo)}</span>
        </div>
      )}

      {usefulness > 0 && (
        <p className="flex items-center gap-2 rounded-xs border border-hairline bg-surface-raised/60 px-2.5 py-1.5 text-xs text-text-secondary">
          <Lightbulb className="h-[15px] w-[15px] shrink-0 text-verified" strokeWidth={1.5} aria-hidden />
          {actionabilityLabel(usefulness, (Date.now() - new Date(ev.created_at).getTime()) / 3600000)}
        </p>
      )}

      {actions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 md:gap-1 md:border-t md:border-hairline md:pt-2">
          {actions}
        </div>
      )}
    </article>
  );
}
