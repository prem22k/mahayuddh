"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageLoader } from "@/components/ui/PageLoader";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorCard } from "@/components/ui/States";
import { UnderlineTabs } from "@/components/ui/ProblemRow";
import { Avatar } from "@/components/ui/Avatar";
import { DifficultyBadgeNew } from "@/components/ui/Badge";
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
import { relativeDays, daysBetween } from "@/lib/format";
import { getCatalogBySlugs } from "@/lib/data/problems";
import type { StuckRequest, StuckReply, StuckLevel, Problem } from "@/types/database";

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

  const tabs = [`Help someone ${open.length}`, `My requests ${mine.length}`] as const;
  const activeTab = tab === "open" ? tabs[0] : tabs[1];
  const rows = tab === "open" ? open : mine;
  // One expanded card at a time: the oldest open request leads, and with it
  // the view's single primary action.
  const expandedId = manualExpanded ?? rows[0]?.id ?? null;

  return (
    <div className="space-y-6">
      <UnderlineTabs
        tabs={tabs}
        value={activeTab}
        onChange={(v) => {
          setTab(v.startsWith("Help") ? "open" : "mine");
          setManualExpanded(null);
        }}
      />

      <LadderStrip />

      {notice && (
        <p role="status" className="rounded-xl border border-hairline bg-surface px-4 py-2.5 text-xs leading-4 text-text-secondary">
          {notice}
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
        <div className="space-y-3">
          {rows.map((r) => (
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
          ))}
        </div>
      )}
    </div>
  );
}

function LadderStrip() {
  return (
    <section aria-label="The help ladder" className="card p-4 sm:p-5">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {STUCK_LEVELS.map((level, i) => (
          <div
            key={level}
            className="rounded-lg border border-hairline bg-well px-3 py-2.5"
          >
            <p className="flex items-baseline gap-2">
              <span className="font-mono text-xs text-text-tertiary tnum">{i + 1}</span>
              <span className="text-sm font-medium leading-5 text-text-primary">
                {LEVEL_LABEL[level]}
              </span>
            </p>
            <p className="mt-0.5 text-xs leading-4 text-text-tertiary">
              {LEVEL_PROMISE[level]}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs leading-4 text-text-tertiary">
        Answer at or below the requested rung, never above.
      </p>
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

  if (!expanded) {
    return (
      <div className="flex min-h-[48px] items-center gap-3 rounded-xl border border-hairline bg-surface px-4 py-2.5">
        <Avatar name={askerName} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-5 text-text-primary">
            {asker} · {meta?.title ?? request.problem_slug.replace(/-/g, " ")}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs leading-4 text-text-tertiary">
            <LevelTag level={request.level} prefix="Wants" />
            <span className="font-mono tnum">{relativeDays(daysBetween(request.created_at))}</span>
          </p>
        </div>
        <Button variant="secondary" onClick={onToggle} className="min-h-[44px] shrink-0 md:min-h-0">
          Help
        </Button>
      </div>
    );
  }

  return (
    <article className="card space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={askerName} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium leading-5 text-text-primary">
              {asker}
            </p>
            <p className="mt-0.5 font-mono text-xs text-text-tertiary tnum">
              {relativeDays(daysBetween(request.created_at))}
              {request.status !== "open" && <span> · {request.status}</span>}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex h-10 min-h-[44px] shrink-0 items-center rounded-md px-3 text-sm font-medium leading-5 text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary md:min-h-0"
        >
          Collapse
        </button>
      </div>

      <div>
        <Link
          href={`/practice/${request.problem_slug}`}
          className="block truncate text-[15px] font-medium leading-6 text-text-primary hover:underline"
        >
          {meta?.title ?? request.problem_slug.replace(/-/g, " ")}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {meta && (
            <span className="font-mono text-xs text-text-tertiary tnum">
              No. {meta.question_id}
            </span>
          )}
          {meta && <DifficultyBadgeNew difficulty={meta.difficulty} />}
        </div>
      </div>

      {/* The rung they asked for, shown as a mini-ladder. */}
      <div>
        <div className="flex flex-wrap gap-1.5" aria-label={`Requested level: ${LEVEL_LABEL[request.level]}`}>
          {STUCK_LEVELS.map((l) => {
            const active = LEVEL_RANK[l] <= LEVEL_RANK[request.level];
            return (
              <span
                key={l}
                className={cn(
                  "inline-flex h-6 items-center rounded-full border px-2.5 text-xs font-medium leading-4",
                  active
                    ? "border-pattern/30 bg-pattern-tint text-pattern"
                    : "border-hairline text-text-disabled"
                )}
              >
                {LEVEL_LABEL[l]}
              </span>
            );
          })}
        </div>
        <p className="mt-1.5 text-xs leading-4 text-text-tertiary">
          Requested · {LEVEL_LABEL[request.level]} — {LEVEL_PROMISE[request.level]}
        </p>
      </div>

      {(request.replies ?? []).length > 0 && (
        <div className="space-y-2">
          {(request.replies ?? []).map((r: StuckReply) => (
            <div
              key={r.id}
              className="rounded-lg border border-hairline bg-well p-3"
            >
              <div className="mb-1 flex flex-wrap items-center gap-2">
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
              <p className="whitespace-pre-wrap text-sm leading-6 text-text-secondary">
                {r.body_md}
              </p>
              {mine && !r.accepted && (
                <div className="mt-2">
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

      {error && <p className="text-xs leading-4 text-error">{error}</p>}

      {/* The AI assistant sits on the asker's own request only, and is capped
          at the level that request asked for — it cannot be offered on
          somebody else's request, where the ladder would be somebody else's
          contract to set. */}
      {mine && request.status !== "resolved" && (
        <StuckAssistant
          squadId={squadId}
          problemSlug={request.problem_slug}
          requestedLevel={request.level}
        />
      )}

      {mine ? (
        request.status !== "resolved" && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
        <div className="space-y-3 border-t border-hairline pt-4">
          {/* Only levels at or below the ask are offered — the ladder in the UI,
              enforced again by the database trigger. */}
          <div>
            <p className="text-xs font-medium leading-4 text-text-secondary">
              Answer at
            </p>
            <div
              role="group"
              aria-label="Reply level"
              className="mt-1.5 flex h-auto flex-wrap items-center gap-1 rounded-md bg-well p-1"
            >
              {STUCK_LEVELS.map((l) => {
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
                      "flex min-h-[44px] flex-1 items-center justify-center whitespace-nowrap rounded-sm px-3 py-2 text-xs font-medium transition-colors md:min-h-0",
                      selected
                        ? "bg-surface-overlay text-text-primary"
                        : allowed
                          ? "text-text-secondary hover:text-text-primary"
                          : "cursor-not-allowed text-text-disabled"
                    )}
                  >
                    {LEVEL_LABEL[l]}
                  </button>
                );
              })}
            </div>
          </div>

          <label htmlFor={`reply-${request.id}`} className="sr-only">
            Your {LEVEL_LABEL[replyLevel].toLowerCase()}
          </label>
          <textarea
            id={`reply-${request.id}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            maxLength={4000}
            placeholder={replyPlaceholder(replyLevel)}
            className="w-full resize-y rounded-md border border-hairline bg-well p-3 text-[15px] leading-6 text-text-primary placeholder:text-text-tertiary focus:border-hairline-strong focus:outline-none"
          />

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              variant="primary"
              onClick={reply}
              disabled={!draft.trim() || sending}
              loading={sending}
              className="min-h-[44px] md:min-h-0"
            >
              <Send className="h-3.5 w-3.5" strokeWidth={1.5} />
              Send hint
            </Button>
            <span className="font-mono text-xs text-text-tertiary tnum">
              {draft.trim().length}/4000
            </span>
          </div>
        </div>
      )}
    </article>
  );
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

function LevelTag({ level, prefix }: { level: StuckLevel; prefix?: string }) {
  return (
    <span className="inline-flex h-6 items-center rounded-full border border-pattern/30 bg-pattern-tint px-2.5 text-xs font-medium leading-4 text-pattern">
      {prefix ? `${prefix} ${LEVEL_LABEL[level].toLowerCase()}` : LEVEL_LABEL[level]}
    </span>
  );
}
