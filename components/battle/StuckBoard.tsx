"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { HelpCircle, Check, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageLoader } from "@/components/ui/PageLoader";
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
  LEVEL_LABEL,
  LEVEL_CLASS,
  LEVEL_PROMISE,
  allowedReplyLevels,
  isSpoilerLevel,
} from "@/lib/stuckLadder";
import { relativeDays, daysBetween } from "@/lib/format";
import { getCatalogBySlugs } from "@/lib/data/problems";
import type { StuckRequest, StuckReply, StuckLevel, Problem } from "@/types/database";

/**
 * Stuck request surface (Step 18).
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
      setLoadError(dataErrorMessage(err, "Couldn't load stuck requests. Retry."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <PageLoader label="Loading requests..." className="h-40" />;

  if (loadError) {
    return (
      <div
        role="alert"
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-5 rounded-2xl bg-[#ff453a]/10 border border-[#ff453a]/30"
      >
        <span className="text-xs text-[#ff453a]">{loadError}</span>
        <button
          onClick={load}
          className="px-4 py-1.5 rounded-full bg-[#ff453a]/15 border border-[#ff453a]/30 text-[#ff453a] text-xs font-bold cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  const rows = tab === "open" ? open : mine;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 p-1 bg-white/[0.04] rounded-full border border-white/[0.06] w-fit">
        {([
          { key: "open", label: `Help someone (${open.length})` },
          { key: "mine", label: `My requests (${mine.length})` },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-4 py-1.5 rounded-full text-[11px] font-bold transition-all cursor-pointer",
              tab === t.key ? "bg-white/[0.12] text-white" : "text-white/55 hover:text-white/70"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {notice && (
        <p role="status" className="px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/60 text-xs">
          {notice}
        </p>
      )}

      {rows.length === 0 ? (
        <div className="p-10 text-center space-y-3 rounded-3xl bg-white/[0.02] border border-white/[0.06]">
          <HelpCircle className="w-6 h-6 text-white/20 mx-auto" />
          <p className="text-xs text-white/60">
            {tab === "open"
              ? "Nobody in your squad is stuck right now. That is a good sign."
              : "You haven't asked for help. When you do, ask for the smallest amount that unsticks you."}
          </p>
          {tab === "open" ? (
            <Link
              href="/practice"
              className="inline-block px-4 py-2 rounded-full bg-white/[0.06] border border-white/[0.1] text-white text-xs font-bold"
            >
              Start a battle
            </Link>
          ) : (
            <p className="text-[11px] text-white/50">
              Press <span className="text-white/50 font-semibold">Stuck?</span> in the dock while
              solving.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <RequestCard
              key={r.id}
              request={r}
              title={titles.get(r.problem_slug)?.title ?? r.problem_slug}
              mine={tab === "mine"}
              busy={false}
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

function RequestCard({
  request,
  title,
  mine,
  busy,
  squadId,
  onRefresh,
  onNotice,
}: {
  request: StuckRequest;
  title: string;
  mine: boolean;
  busy: boolean;
  squadId: string | null;
  onRefresh: () => Promise<void>;
  onNotice: (s: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [replyLevel, setReplyLevel] = useState<StuckLevel>(request.level);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const levels = allowedReplyLevels(request.level);
  const anonymous = request.visibility === "anon";

  const reply = async () => {
    setError(null);
    const res = await replyToStuckRequest({
      requestId: request.id,
      level: replyLevel,
      bodyMd: draft,
    });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setDraft("");
    onNotice("Reply posted.");
    await onRefresh();
  };

  return (
    <div className="p-5 rounded-3xl bg-white/[0.02] border border-white/[0.06] space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {/* anon: no name, no avatar. The author must not be inferable. */}
            <span className="text-xs font-bold text-white">
              {anonymous ? "Someone in your squad" : `@${request.author?.username ?? "member"}`}
            </span>
            <span
              className={cn(
                "px-2 py-0.5 rounded-full border text-[10px] font-bold",
                LEVEL_CLASS[request.level]
              )}
            >
              wants {LEVEL_LABEL[request.level].toLowerCase()}
            </span>
            {request.status !== "open" && (
              <span className="px-2 py-0.5 rounded-full border border-white/[0.12] text-[10px] font-bold text-white/50">
                {request.status}
              </span>
            )}
            <span className="text-[10px] text-white/50 font-mono">
              {relativeDays(daysBetween(request.created_at))}
            </span>
          </div>
          <Link
            href={`/practice/${request.problem_slug}`}
            className="block mt-1 text-sm font-bold text-white hover:text-[#fa586a] transition-colors truncate"
          >
            {title}
          </Link>
        </div>
      </div>

      <p className="text-[11px] text-white/55">{LEVEL_PROMISE[request.level]}</p>

      {(request.replies ?? []).length > 0 && (
        <div className="space-y-2">
          {(request.replies ?? []).map((r: StuckReply) => (
            <div
              key={r.id}
              className={cn(
                "p-3 rounded-2xl border",
                r.accepted
                  ? "bg-[#30d158]/[0.07] border-[#30d158]/25"
                  : "bg-white/[0.03] border-white/[0.06]"
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-bold text-white/80">
                  @{r.author?.username ?? "member"}
                </span>
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded-full border text-[9px] font-bold",
                    LEVEL_CLASS[r.level]
                  )}
                >
                  {LEVEL_LABEL[r.level]}
                </span>
                {r.accepted && (
                  <span className="text-[10px] text-[#30d158] font-bold flex items-center gap-1">
                    <Check className="w-3 h-3" /> accepted
                  </span>
                )}
              </div>
              <p className="text-xs text-white/70 leading-relaxed whitespace-pre-wrap">
                {r.body_md}
              </p>
              {mine && !r.accepted && (
                <button
                  onClick={async () => {
                    setActing(true);
                    await acceptStuckReply(request.id, r.id);
                    track("stuck_resolved", { via: "accepted" });
                    onNotice("Marked as the one that helped.");
                    await onRefresh();
                    setActing(false);
                  }}
                  className="mt-2 text-[10px] font-bold text-[#30d158] hover:underline cursor-pointer"
                >
                  This unblocked me
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-[11px] text-[#ff453a]">{error}</p>}

      {/* The AI assistant sits on the asker's own request only, and is capped
          at the level that request asked for. §45's stuck assistant is "the
          same ladder as Step 18, never jumps to full" — so it cannot be offered
          on somebody else's request, where the ladder would be somebody else's
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
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <button
              onClick={async () => {
                setActing(true);
                await setStuckRequestStatus(request.id, "resolved");
                onNotice("Closed. Keep going.");
                await onRefresh();
                setActing(false);
              }}
              disabled={busy || acting}
              className="px-3 py-1.5 rounded-full bg-[#30d158]/15 border border-[#30d158]/30 text-[#30d158] text-[11px] font-bold hover:bg-[#30d158]/25 transition-all disabled:opacity-40 cursor-pointer"
            >
              I solved it
            </button>
            <button
              onClick={async () => {
                if (!window.confirm("Delete this request?")) return;
                setActing(true);
                await deleteStuckRequest(request.id);
                onNotice("Request deleted.");
                await onRefresh();
                setActing(false);
              }}
              disabled={busy || acting}
              className="px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-white/55 hover:text-white text-[11px] font-bold transition-all disabled:opacity-40 cursor-pointer"
            >
              Delete
            </button>
          </div>
        )
      ) : (
        <div className="space-y-2 pt-1 border-t border-white/[0.06]">
          {/* Only levels at or below the ask are offered — the ladder in the UI,
              enforced again by the database trigger. */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-white/55 uppercase tracking-wider">Answer at</span>
            {levels.map((l) => (
              <button
                key={l}
                onClick={() => setReplyLevel(l)}
                className={cn(
                  "px-2.5 py-1 rounded-full border text-[10px] font-bold transition-all cursor-pointer",
                  replyLevel === l
                    ? LEVEL_CLASS[l]
                    : "bg-white/[0.04] border-white/[0.08] text-white/55 hover:text-white/70"
                )}
              >
                {LEVEL_LABEL[l]}
              </button>
            ))}
            {isSpoilerLevel(replyLevel) && (
              <span className="text-[10px] text-[#bf5af2]">spoiler — they asked for it</span>
            )}
          </div>

          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            maxLength={4000}
            placeholder={
              replyLevel === "nudge"
                ? "One observation that makes them think. Not the answer."
                : replyLevel === "full"
                  ? "They asked for the full walkthrough."
                  : "Point at the shape of the solution, not the solution."
            }
            className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl p-2.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-[#ff9f0a]/60 resize-y"
          />

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={reply}
              disabled={busy || !draft.trim()}
              className="px-4 py-1.5 rounded-full bg-white text-black text-[11px] font-bold transition-all disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
            >
              <Send className="w-3 h-3" />
              Reply
            </button>
            <span className="text-[10px] text-white/50">
              {draft.trim().length}/4000
            </span>
          </div>
        </div>
      )}
    </div>
  );
}