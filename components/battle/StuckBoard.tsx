"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ChevronUp,
  CircleCheck,
  CodeXml,
  EyeOff,
  Gavel,
  Info,
  Lightbulb,
  Lock,
  Send,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageLoader } from "@/components/ui/PageLoader";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorCard } from "@/components/ui/States";
import { Avatar } from "@/components/ui/Avatar";
import { DifficultyBadgeNew, PatternChip } from "@/components/ui/Badge";
import {
  getOpenStuckRequests,
  getMyStuckRequests,
  replyToStuckRequest,
  acceptStuckReply,
  setStuckRequestStatus,
  deleteStuckRequest,
} from "@/lib/data/stuck";
import { dataErrorMessage } from "@/lib/data/errors";
import { track } from "@/lib/analytics";
import { useAuth } from "@/components/providers/AuthProvider";
import { StuckAssistant } from "@/components/ai/StuckAssistant";
import {
  STUCK_LEVELS,
  LEVEL_LABEL,
  LEVEL_PROMISE,
  LEVEL_RANK,
  allowedReplyLevels,
} from "@/lib/stuckLadder";
import { relativeDays, daysBetween, titleFromSlug } from "@/lib/format";
import { getCatalogBySlugs } from "@/lib/data/problems";
import type { StuckRequest, StuckReply, StuckLevel, StuckVisibility, Problem } from "@/types/database";

/**
 * Stuck request surface (09): help at the level asked for, no more.
 *
 * Two lists: requests you can answer, and requests you made. The reply picker
 * is pre-capped to the level that was asked for, so the ladder is visible in
 * the UI and enforced again by the database — a client that lies is rejected.
 */
export function StuckBoard() {
  const { profile } = useAuth();
  const activeSquadId = profile?.active_squad_id ?? null;
  const [tab, setTab] = useState<"open" | "mine">("open");
  const [open, setOpen] = useState<StuckRequest[]>([]);
  const [mine, setMine] = useState<StuckRequest[]>([]);
  const [titles, setTitles] = useState<Map<string, Problem>>(new Map());
  const [manualExpanded, setManualExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [openRows, myRows] = await Promise.all([
        getOpenStuckRequests(),
        getMyStuckRequests(),
      ]);
      setOpen(openRows);
      setMine(myRows);
      const slugs = Array.from(
        new Set([...openRows, ...myRows].map((r) => r.problem_slug))
      ).slice(0, 60);
      if (slugs.length > 0) {
        const catalog = await getCatalogBySlugs(slugs).catch(() => []);
        setTitles(new Map(catalog.map((c) => [c.title_slug, c])));
      }
    } catch (err) {
      setLoadError(dataErrorMessage(err, "Couldn't load stuck requests."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <PageLoader label="Loading requests..." className="h-40" />;

  if (loadError) {
    return <ErrorCard message={loadError} onRetry={load} />;
  }

  const rows = tab === "open" ? open : mine;
  // One expanded card at a time: the oldest open request leads, and with it
  // the view's single primary action.
  const expandedId = manualExpanded ?? rows[0]?.id ?? null;
  const expanded = rows.find((r) => r.id === expandedId) ?? null;
  const myOpen = mine.find((r) => r.status !== "resolved") ?? null;

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <BoardTabs
        tab={tab}
        counts={{ open: open.length, mine: mine.length }}
        onChange={(t) => {
          setTab(t);
          setManualExpanded(null);
        }}
      />

      <LadderStrip requested={expanded?.level ?? null} />

      {notice && (
        <p role="status" className="rounded-lg border border-hairline bg-surface px-4 py-2.5 text-xs leading-4 text-text-secondary">
          {notice}
        </p>
      )}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-8 lg:gap-6">
          {rows.length > 0 && (
            <p className="font-mono text-xs font-medium uppercase tracking-[0.06em] text-text-tertiary tnum lg:hidden">
              {tab === "open" ? `Queue · ${rows.length} pending` : `Your requests · ${rows.length}`}
            </p>
          )}
          {rows.length === 0 ? (
            <EmptyState
              heading={
                tab === "open" ? "Nobody in your squad is stuck right now" : "No open requests from you"
              }
              body={
                tab === "open"
                  ? "That is a good sign. When someone asks, their request lands here."
                  : "When you're stuck mid-battle, hit Stuck? in the solve dock to ask."
              }
              action={
                tab === "open" ? (
                  <Link
                    href="/practice"
                    className="inline-flex h-10 min-h-[44px] items-center justify-center rounded-md bg-surface-overlay px-4 text-sm font-medium leading-5 text-text-primary transition-colors hover:bg-[#272830] md:min-h-0"
                  >
                    Practice instead
                  </Link>
                ) : undefined
              }
            />
          ) : (
            rows.map((r) => (
              <RequestCard
                key={r.id}
                request={r}
                meta={titles.get(r.problem_slug)}
                mine={tab === "mine"}
                expanded={expandedId === r.id}
                onToggle={() =>
                  setManualExpanded((prev) => (prev === r.id ? `collapsed-${r.id}` : r.id))
                }
                squadId={activeSquadId}
                onRefresh={load}
                onNotice={setNotice}
              />
            ))
          )}
        </div>

        <aside className="flex min-w-0 flex-col gap-5 lg:col-span-4">
          <OpenRequestCard
            request={myOpen}
            meta={myOpen ? titles.get(myOpen.problem_slug) : undefined}
            onOpen={() => {
              if (!myOpen) return;
              setTab("mine");
              setManualExpanded(myOpen.id);
            }}
          />
          <section className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold leading-5 text-text-primary">
              <Gavel className="h-[18px] w-[18px] text-pattern" strokeWidth={1.5} aria-hidden />
              How to help
            </h2>
            <ul className="flex flex-col gap-2 text-xs leading-4 text-text-secondary">
              <li className="flex items-start gap-2">
                <CircleCheck className="mt-px h-3.5 w-3.5 shrink-0 text-pattern" strokeWidth={1.5} aria-hidden />
                <span>
                  <strong className="font-semibold text-text-primary">Respect the ceiling.</strong> Answer
                  at or below the rung they asked for. Anything above it is rejected.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CircleCheck className="mt-px h-3.5 w-3.5 shrink-0 text-pattern" strokeWidth={1.5} aria-hidden />
                <span>
                  <strong className="font-semibold text-text-primary">No spoilers.</strong> Leave them
                  the aha. The least help that unsticks them is the best help.
                </span>
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

/** Underline tabs with a count pill, same semantics as UnderlineTabs. */
function BoardTabs({
  tab,
  counts,
  onChange,
}: {
  tab: "open" | "mine";
  counts: { open: number; mine: number };
  onChange: (t: "open" | "mine") => void;
}) {
  const items = [
    { key: "open" as const, label: "Help someone", count: counts.open },
    { key: "mine" as const, label: "My requests", count: counts.mine },
  ];
  return (
    <div className="flex gap-6 border-b border-hairline" role="tablist">
      {items.map((t) => {
        const active = tab === t.key;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.key)}
            className={cn(
              "-mb-px flex min-h-[44px] items-center gap-2 border-b-2 pb-2.5 pt-1 text-sm font-medium leading-5 transition-colors md:min-h-0",
              active
                ? "border-text-primary text-text-primary"
                : "border-transparent text-text-secondary hover:text-text-primary"
            )}
          >
            {t.label}
            <span
              className={cn(
                "rounded-full border border-hairline px-1.5 py-0.5 font-mono text-[11px] font-medium leading-3 tnum",
                active ? "bg-surface-raised text-text-secondary" : "bg-surface text-text-tertiary"
              )}
            >
              {t.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * The four rungs. When a request is open in the list below, its rung is
 * marked requested and the rungs above it show as locked: that's the ceiling
 * a helper may answer at.
 */
function LadderStrip({ requested }: { requested: StuckLevel | null }) {
  return (
    <section
      aria-label="The help ladder"
      className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-3.5 md:gap-2.5 md:border-0 md:bg-transparent md:p-0"
    >
      <div className="flex items-center justify-between gap-4">
        <span className="font-mono text-xs font-medium uppercase tracking-[0.06em] text-text-tertiary">
          The help ladder
        </span>
        <span className="hidden items-center gap-1.5 text-xs font-medium leading-4 text-text-secondary md:flex">
          <Shield className="h-[15px] w-[15px] text-pattern" strokeWidth={1.5} aria-hidden />
          Rule: answer at or below the requested rung, never above.
        </span>
      </div>
      <ol className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-3 lg:grid-cols-4">
        {STUCK_LEVELS.map((level, i) => {
          const isRequested = requested === level;
          const locked = requested != null && LEVEL_RANK[level] > LEVEL_RANK[requested];
          return (
            <li
              key={level}
              aria-current={isRequested ? "step" : undefined}
              className={cn(
                "flex items-start gap-4 rounded-md border px-4 py-2.5 md:flex-col md:gap-1.5 md:rounded-lg md:p-3.5",
                isRequested
                  ? "border-pattern/30 bg-pattern-tint/40"
                  : "border-hairline bg-transparent md:bg-surface-raised"
              )}
            >
              <span className="flex items-center justify-between md:w-full">
                <span
                  className={cn(
                    "font-mono text-sm font-medium tnum md:text-xs md:tracking-[0.06em]",
                    isRequested ? "text-pattern" : "text-text-tertiary"
                  )}
                >
                  <span className="md:hidden">{i + 1}</span>
                  <span className="hidden md:inline">RUNG {String(i + 1).padStart(2, "0")}</span>
                </span>
                <span className="hidden md:inline-flex">
                  {isRequested ? (
                    <span className="rounded-xs bg-pattern/20 px-1.5 py-0.5 font-mono text-[10px] font-semibold leading-3 text-pattern">
                      REQUESTED
                    </span>
                  ) : locked ? (
                    <Lock className="h-3.5 w-3.5 text-text-disabled" strokeWidth={1.5} aria-label="Above the ask" />
                  ) : (
                    <span className="h-2 w-2 rounded-full bg-text-disabled" aria-hidden />
                  )}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "flex items-center gap-1.5 text-sm font-semibold leading-5",
                      isRequested ? "text-pattern md:text-text-primary" : locked ? "text-text-secondary" : "text-text-primary"
                    )}
                  >
                    {LEVEL_LABEL[level]}
                    {isRequested && (
                      <Lightbulb className="hidden h-4 w-4 text-pattern md:inline" strokeWidth={1.5} aria-hidden />
                    )}
                  </span>
                  {isRequested && (
                    <span className="shrink-0 rounded-xs bg-pattern-tint px-2 py-0.5 font-mono text-[11px] font-medium text-pattern md:hidden">
                      Requested
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    "mt-0.5 block text-xs leading-snug",
                    locked ? "text-text-tertiary" : "text-text-secondary"
                  )}
                >
                  {LEVEL_PROMISE[level]}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
      <p className="flex items-start gap-2 text-xs italic leading-5 text-text-tertiary md:hidden">
        <Info className="mt-0.5 h-4 w-4 shrink-0 not-italic" strokeWidth={1.5} aria-hidden />
        Rule: answer at or below the requested rung, never above.
      </p>
    </section>
  );
}

/** Rail card: the viewer's own open ask and what came back on it. */
function OpenRequestCard({
  request,
  meta,
  onOpen,
}: {
  request: StuckRequest | null;
  meta: Problem | undefined;
  onOpen: () => void;
}) {
  const replies = request?.replies ?? [];
  const latest = replies[replies.length - 1] ?? null;
  const accepted = replies.find((r) => r.accepted) ?? null;
  const helper = accepted ?? latest;
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-hairline bg-surface p-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs font-medium uppercase tracking-[0.06em] text-text-tertiary">
          Your open request
        </span>
        {request && <span className="h-2 w-2 rounded-full bg-text-secondary" aria-hidden />}
      </div>
      {!request ? (
        <p className="text-xs leading-4 text-text-tertiary">
          Nothing open. Stuck mid-battle? Hit Stuck? in the solve dock.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <p className="flex flex-wrap items-baseline gap-2">
              <span className="text-sm font-semibold leading-5 text-text-primary">
                {meta?.title ?? titleFromSlug(request.problem_slug)}
              </span>
              {meta?.question_id && (
                <span className="font-mono text-xs text-text-tertiary tnum">No. {meta.question_id}</span>
              )}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-xs border border-hairline bg-surface-raised px-2 py-0.5 text-xs font-medium leading-4 text-text-secondary">
                Rung {LEVEL_RANK[request.level]}: {LEVEL_LABEL[request.level]}
              </span>
              {helper ? (
                <span className="flex items-center gap-1 text-xs font-medium leading-4 text-text-secondary">
                  <Check className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                  {accepted ? "Unblocked by" : "Reply from"} @{helper.author?.username ?? "member"}
                </span>
              ) : (
                <span className="text-xs leading-4 text-text-tertiary">No replies yet</span>
              )}
            </div>
          </div>
          {helper && (
            <p className="rounded-md border border-hairline bg-well p-2.5 text-xs leading-4 text-text-secondary">
              <span className="line-clamp-2">&ldquo;{helper.body_md}&rdquo;</span>
            </p>
          )}
          <button
            type="button"
            onClick={onOpen}
            className="self-start text-xs font-medium leading-4 text-text-primary underline decoration-hairline-strong underline-offset-[3px] transition-colors hover:decoration-text-primary"
          >
            {helper ? "View replies" : "Open request"}
          </button>
        </>
      )}
    </section>
  );
}

function RequestCard({
  request,
  meta,
  mine,
  expanded,
  onToggle,
  squadId,
  onRefresh,
  onNotice,
}: {
  request: StuckRequest;
  meta: Problem | undefined;
  mine: boolean;
  expanded: boolean;
  onToggle: () => void;
  squadId: string | null;
  onRefresh: () => Promise<void>;
  onNotice: (s: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [replyLevel, setReplyLevel] = useState<StuckLevel>(request.level);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [sending, setSending] = useState(false);
  const levels = allowedReplyLevels(request.level);
  const anonymous = request.visibility === "anon";
  const asker = anonymous ? "Someone" : `@${request.author?.username ?? "member"}`;
  const askerName = anonymous ? "Someone in your squad" : (request.author?.username ?? "A squad mate");
  const title = meta?.title ?? request.problem_slug.replace(/-/g, " ");
  const pattern = patternTagOf(meta?.topics);
  const when = relativeDays(daysBetween(request.created_at));

  const reply = async () => {
    setError(null);
    setSending(true);
    const res = await replyToStuckRequest({
      requestId: request.id,
      level: replyLevel,
      bodyMd: draft,
    });
    setSending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setDraft("");
    onNotice("Reply posted.");
    await onRefresh();
  };

  const avatar = () =>
    anonymous ? (
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-hairline bg-well text-text-disabled"
        title="Anonymous"
      >
        <EyeOff className="h-5 w-5" strokeWidth={1.5} aria-hidden />
      </span>
    ) : (
      <Avatar
        name={askerName}
        src={request.author?.avatar_url}
        className="h-10 w-10 border border-hairline bg-well font-mono text-sm font-semibold text-text-primary"
      />
    );

  if (!expanded) {
    return (
      <div className="flex items-center justify-between gap-4 rounded-lg border border-hairline bg-surface p-4 transition-colors hover:border-hairline-strong">
        <div className="flex min-w-0 items-center gap-4">
          {avatar()}
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="truncate text-[15px] font-medium leading-6 text-text-primary md:text-lg md:leading-[26px]">
                {title}
              </span>
              {meta?.question_id && (
                <span className="font-mono text-sm text-text-tertiary tnum">No. {meta.question_id}</span>
              )}
              {meta && <DifficultyBadgeNew difficulty={meta.difficulty} size="sm" className="hidden sm:inline-flex" />}
              {pattern && <PatternChip label={pattern} className="hidden h-5 px-2 text-[11px] sm:inline-flex" />}
            </div>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-medium leading-4 text-text-secondary">
              <span>{anonymous ? "Someone in your squad" : asker}</span>
              <span className="text-text-disabled" aria-hidden>·</span>
              <span className="font-mono tnum">{when}</span>
              <span className="text-text-disabled" aria-hidden>·</span>
              <span className="font-mono text-xs text-pattern">
                Rung {LEVEL_RANK[request.level]}: {LEVEL_LABEL[request.level]}
              </span>
              {request.status !== "open" && (
                <>
                  <span className="text-text-disabled" aria-hidden>·</span>
                  <span className="text-text-tertiary">{request.status}</span>
                </>
              )}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex h-10 min-h-[44px] shrink-0 items-center gap-1.5 rounded-md border border-hairline bg-surface-raised px-4 text-sm font-medium leading-5 text-text-primary transition-colors hover:border-hairline-strong hover:bg-surface-overlay md:min-h-0"
        >
          {mine ? "Open" : "Help"}
          <ArrowRight className="h-4 w-4" strokeWidth={1.5} aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <article className="flex flex-col overflow-hidden rounded-lg border border-hairline-strong bg-surface">
      {/* Who asked, and the ceiling they set */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline bg-surface-raised/40 p-4 md:p-5">
        <div className="flex min-w-0 items-center gap-3">
          {avatar()}
          <div className="min-w-0">
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="truncate text-sm font-semibold leading-5 text-text-primary">
                {anonymous ? "Someone in your squad" : asker}
              </span>
              <span className="text-text-disabled" aria-hidden>·</span>
              <span className="font-mono text-xs font-medium text-text-tertiary tnum">{when}</span>
              {request.status !== "open" && (
                <span className="font-mono text-xs text-text-tertiary">· {request.status}</span>
              )}
            </p>
            <span className="mt-0.5 inline-flex rounded-full border border-hairline bg-surface px-2 py-0.5 text-[11px] font-medium leading-4 text-text-secondary">
              {visibilityChip(request.visibility)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-1" aria-hidden>
              {STUCK_LEVELS.map((l) => (
                <span
                  key={l}
                  className={cn(
                    "h-1.5 w-6 rounded-full",
                    LEVEL_RANK[l] <= LEVEL_RANK[request.level]
                      ? "bg-pattern"
                      : "border border-hairline bg-well"
                  )}
                />
              ))}
            </div>
            <span className="font-mono text-xs font-medium text-pattern">
              Requested: {LEVEL_LABEL[request.level]}
            </span>
          </div>
          <button
            type="button"
            onClick={onToggle}
            aria-label="Collapse"
            title="Collapse"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-raised hover:text-text-primary md:h-8 md:w-8"
          >
            <ChevronUp className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Problem strip */}
      <div className="flex flex-col gap-2 border-b border-hairline bg-surface-raised px-4 py-3 md:flex-row md:items-center md:justify-between md:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <CodeXml className="hidden h-5 w-5 shrink-0 text-text-tertiary md:block" strokeWidth={1.5} aria-hidden />
          <Link
            href={`/practice/${request.problem_slug}`}
            className="min-w-0 truncate text-[17px] font-semibold leading-6 text-text-primary hover:underline md:text-lg md:leading-[26px]"
          >
            {title}
          </Link>
          {meta?.question_id && (
            <span className="shrink-0 font-mono text-sm text-text-tertiary tnum">No. {meta.question_id}</span>
          )}
        </div>
        {(meta || pattern) && (
          <div className="flex flex-wrap items-center gap-2.5">
            {meta && <DifficultyBadgeNew difficulty={meta.difficulty} />}
            {pattern && <PatternChip label={pattern} className="border border-pattern/30" />}
          </div>
        )}
      </div>

      {(request.replies ?? []).length > 0 && (
        <div className="flex flex-col gap-2 p-4 md:p-5">
          <span className="font-mono text-xs font-medium uppercase tracking-[0.06em] text-text-tertiary">
            Replies
          </span>
          {(request.replies ?? []).map((r: StuckReply) => (
            <div key={r.id} className="rounded-lg border border-hairline bg-well p-4">
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium leading-4 text-text-primary">
                  @{r.author?.username ?? "member"}
                </span>
                <LevelTag level={r.level} />
                {r.accepted && (
                  <span className="inline-flex h-6 items-center gap-1 rounded-sm border border-hairline-strong px-2 text-xs font-medium leading-4 text-text-secondary">
                    <Check className="h-3 w-3" strokeWidth={1.5} />
                    Unblocked
                  </span>
                )}
              </div>
              <p className="whitespace-pre-wrap text-[15px] leading-6 text-text-secondary">
                {r.body_md}
              </p>
              {mine && !r.accepted && (
                <div className="mt-3">
                  <Button
                    variant="primary"
                    disabled={acting}
                    onClick={async () => {
                      setActing(true);
                      await acceptStuckReply(request.id, r.id);
                      track("stuck_resolved", { via: "accepted" });
                      onNotice("Marked as the one that helped.");
                      await onRefresh();
                      setActing(false);
                    }}
                    className="min-h-[44px] md:min-h-0"
                  >
                    This unblocked me
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {error && <p className="px-4 pt-3 text-xs leading-4 text-error md:px-5">{error}</p>}

      {/* The AI assistant sits on the asker's own request only, and is capped
          at the level that request asked for — it cannot be offered on
          somebody else's request, where the ladder would be somebody else's
          contract to set. */}
      {mine && request.status !== "resolved" && (
        <div className="border-t border-hairline p-4 md:p-5">
          <StuckAssistant
            squadId={squadId}
            problemSlug={request.problem_slug}
            requestedLevel={request.level}
          />
        </div>
      )}

      {mine ? (
        request.status !== "resolved" && (
          <div className="flex flex-col gap-2 border-t border-hairline p-4 sm:flex-row sm:items-center md:px-5">
            <Button
              variant="secondary"
              disabled={acting}
              onClick={async () => {
                setActing(true);
                await setStuckRequestStatus(request.id, "resolved");
                onNotice("Closed. Keep going.");
                await onRefresh();
                setActing(false);
              }}
              className="min-h-[44px] md:min-h-0"
            >
              I solved it
            </Button>
            <Button
              variant="ghost"
              disabled={acting}
              onClick={async () => {
                if (!window.confirm("Delete this request?")) return;
                setActing(true);
                await deleteStuckRequest(request.id);
                onNotice("Request deleted.");
                await onRefresh();
                setActing(false);
              }}
              className="min-h-[44px] md:min-h-0"
            >
              Delete request
            </Button>
          </div>
        )
      ) : (
        <div className="flex flex-col gap-4 border-t border-hairline bg-surface/50 p-4 md:p-5">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-semibold leading-5 text-text-primary">Respond to {asker}</span>
            <span className="text-xs text-text-tertiary" aria-hidden>·</span>
            <span className="text-xs font-medium leading-4 text-text-secondary">
              Maximum level allowed:{" "}
              <strong className="font-medium text-pattern">{LEVEL_LABEL[request.level]}</strong>
            </span>
          </p>

          {/* Only levels at or below the ask are offered — the ladder in the UI,
              enforced again by the database trigger. */}
          <div
            role="group"
            aria-label="Reply level"
            className="grid grid-cols-2 gap-1 rounded-md border border-hairline bg-well p-1 md:grid-cols-4"
          >
            {STUCK_LEVELS.map((l, i) => {
              const allowed = levels.includes(l);
              const selected = replyLevel === l;
              return (
                <button
                  key={l}
                  type="button"
                  disabled={!allowed}
                  title={
                    allowed
                      ? LEVEL_PROMISE[l]
                      : `${asker} asked for ${LEVEL_LABEL[request.level].toLowerCase()}`
                  }
                  onClick={() => setReplyLevel(l)}
                  aria-pressed={selected}
                  className={cn(
                    "flex min-h-[44px] items-center justify-center gap-1.5 whitespace-nowrap rounded-sm border px-3 py-1.5 text-xs font-medium leading-4 transition-colors md:min-h-0",
                    selected
                      ? "border-pattern/40 bg-pattern-tint font-semibold text-pattern shadow-sm"
                      : allowed
                        ? "border-transparent text-text-secondary hover:bg-surface-raised hover:text-text-primary"
                        : "cursor-not-allowed border-transparent text-text-disabled opacity-60"
                  )}
                >
                  {selected ? (
                    <CircleCheck className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                  ) : allowed ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-text-tertiary" aria-hidden />
                  ) : (
                    <Lock className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                  )}
                  {i + 1}. {LEVEL_LABEL[l]}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={`reply-${request.id}`} className="sr-only">
              Your {LEVEL_LABEL[replyLevel].toLowerCase()}
            </label>
            <textarea
              id={`reply-${request.id}`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={4}
              maxLength={4000}
              placeholder={replyPlaceholder(replyLevel)}
              className="w-full resize-y rounded-lg border border-hairline bg-well p-3.5 text-[15px] leading-6 text-text-primary placeholder:text-text-disabled focus:border-hairline-strong focus:outline-none"
            />
            <div className="flex items-start justify-between gap-3 px-1 font-mono text-xs font-medium text-text-tertiary">
              <span className="flex items-start gap-1.5">
                <Lightbulb className="mt-px h-3.5 w-3.5 shrink-0 text-pattern" strokeWidth={1.5} aria-hidden />
                {replyGuidance(replyLevel)}
              </span>
              <span className="shrink-0 tnum">{draft.trim().length}/4000</span>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              variant="primary"
              onClick={reply}
              disabled={!draft.trim() || sending}
              loading={sending}
              className="min-h-[44px] w-full font-semibold sm:w-auto md:min-h-0"
            >
              <Send className="h-4 w-4" strokeWidth={1.5} />
              Send hint
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}

// LeetCode tags lead with data structures ("Array", "Hash Table"); the chip
// should name the technique when the problem has one.
const DATA_STRUCTURE_TAGS = new Set(["Array", "String", "Hash Table", "Math", "Sorting", "Matrix"]);
function patternTagOf(topics: string[] | undefined): string | undefined {
  if (!topics?.length) return undefined;
  return topics.find((t) => !DATA_STRUCTURE_TAGS.has(t)) ?? topics[0];
}

function visibilityChip(v: StuckVisibility): string {
  switch (v) {
    case "squad":
      return "Visible to squad";
    case "public":
      return "Public";
    case "anon":
      return "Anonymous";
  }
}

function replyPlaceholder(level: StuckLevel): string {
  switch (level) {
    case "nudge":
      return "One observation that makes them think, not the answer…";
    case "pattern":
      return "Name the technique without walking through the steps…";
    case "direction":
      return "The shape of the solution, not the steps…";
    case "full":
      return "The complete walkthrough. They asked for it…";
  }
}

function replyGuidance(level: StuckLevel): string {
  switch (level) {
    case "nudge":
      return "A question beats a statement. No technique names.";
    case "pattern":
      return "Keep code out of pattern hints. Frame the mental model.";
    case "direction":
      return "Describe the approach in plain words. No code.";
    case "full":
      return "Full walkthrough. Suggest they re-solve it from scratch later.";
  }
}

function LevelTag({ level, prefix }: { level: StuckLevel; prefix?: string }) {
  return (
    <span className="inline-flex h-6 items-center rounded-full border border-pattern/30 bg-pattern-tint px-2.5 text-xs font-medium leading-4 text-pattern">
      {prefix ? `${prefix} ${LEVEL_LABEL[level].toLowerCase()}` : LEVEL_LABEL[level]}
    </span>
  );
}
