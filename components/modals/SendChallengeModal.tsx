"use client";

import React, { useState } from "react";
import { X } from "lucide-react";
import confetti from "canvas-confetti";
import { ModalShell } from "@/components/ui/ModalShell";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { DifficultyBadgeNew } from "@/components/ui/Badge";
import { Pass, PassSerial } from "@/components/pass/Pass";
import { slugifyTitle } from "@/lib/slug";
import { createSuggestion } from "@/lib/data/suggestions";
import { logFeedEvent } from "@/lib/data/feed";
import { notify } from "@/lib/data/notifications";
import { useAuth } from "@/components/providers/AuthProvider";
import type { Difficulty, Profile, Suggestion } from "@/types/database";
import { track } from "@/lib/analytics";

function parseMmSs(v: string): number | null {
  const m = v.trim().match(/^(?:(\d+):)?([0-5]?\d)$/);
  if (!m) return null;
  const mins = m[1] ? parseInt(m[1], 10) : 0;
  return mins * 60 + parseInt(m[2], 10);
}

function fmtTime(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

export function SendChallengeModal({
  profiles,
  initialTo,
  initialProblem,
  initialBeatSec,
  passParent,
  onClose,
  onSent,
}: {
  profiles: Profile[];
  initialTo?: string;
  initialProblem?: { slug: string; title: string; difficulty: Difficulty };
  initialBeatSec?: number | null;
  passParent?: Suggestion | null;
  onClose: () => void;
  onSent: (s: Suggestion) => void;
}) {
  const { user, profile } = useAuth();
  const others = profiles.filter((p) => p.id !== user?.id);

  const [targetUserId, setTargetUserId] = useState(
    initialTo ?? others[0]?.id ?? profiles[0]?.id ?? ""
  );
  const [problemTitle, setProblemTitle] = useState(
    passParent?.problem_title ?? initialProblem?.title ?? ""
  );
  const [problemSlug] = useState(
    passParent?.problem_slug ?? initialProblem?.slug ?? ""
  );
  const [difficulty, setDifficulty] = useState<Difficulty>(
    passParent?.difficulty ?? initialProblem?.difficulty ?? "Medium"
  );
  const [beatTime, setBeatTime] = useState(initialBeatSec != null);
  const [myTime, setMyTime] = useState(
    initialBeatSec != null ? fmtTime(initialBeatSec) : ""
  );
  const [note, setNote] = useState(passParent?.message ?? passParent?.note ?? "");
  const [hideNote, setHideNote] = useState(false);
  const [deadline, setDeadline] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const target = profiles.find((p) => p.id === targetUserId);
  const senderSecs = beatTime ? parseMmSs(myTime) : null;
  const dueLabel = deadline
    ? new Date(deadline + "T12:00:00").toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
      })
    : "19 Oct";

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!problemTitle.trim() || !user) return;
    if (!targetUserId) {
      setCreateError("Pick a squad member to challenge.");
      return;
    }
    if (targetUserId === user.id) {
      setCreateError("Challenge a squad mate, not yourself.");
      return;
    }
    setSubmitting(true);
    setCreateError(null);
    try {
      const slug = (problemSlug.trim().toLowerCase() || slugifyTitle(problemTitle)).slice(0, 80);
      if (beatTime && senderSecs == null) {
        setCreateError("Enter your solve time as m:ss (or turn off “Beat my time”).");
        setSubmitting(false);
        return;
      }
      const res = await createSuggestion({
        fromUser: user.id,
        toUser: targetUserId,
        problemTitle: problemTitle.trim(),
        problemSlug: slug,
        difficulty,
        message: note.trim(),
        senderTimeSec: senderSecs,
        beatTime,
        deadlineAt: deadline ? new Date(deadline + "T23:59:59").toISOString() : null,
        parentId: passParent?.id ?? null,
        spoiler: hideNote,
      });

      if (res.ok) {
        track("challenge_sent", { problem_slug: slug, beat_time: beatTime, pass: !!passParent });
        notify({
          userId: targetUserId,
          kind: "challenge",
          title: `${profile ? `@${profile.username}` : "A squad mate"} challenged you`,
          body: `${problemTitle.trim()} · ${difficulty}`,
          deepLink: `/c/${res.suggestion.id}`,
          actorId: user.id,
          urgent: true,
        }).catch(() => {});
        logFeedEvent({
          eventType: "challenge",
          squadId: profile?.active_squad_id ?? null,
          problemTitle: problemTitle.trim(),
          problemSlug: slug,
          difficulty,
          objectId: res.suggestion.id,
          metadata: passParent ? { parent_id: passParent.id } : {},
        }).catch(() => {});
        onSent(res.suggestion);
        onClose();
        confetti({
          particleCount: 60,
          spread: 60,
          origin: { y: 0.8 },
          colors: ["#F5B83D", "#3DDC97", "#8B91F7", "#EDEDEF"],
        });
      } else if (res.reason === "duplicate") {
        setCreateError("This squad mate already has a pending challenge for that problem.");
      } else if (res.reason === "invalid") {
        setCreateError("Check the problem slug (lowercase letters, numbers, dashes) and keep hints under 2000 characters.");
      } else {
        setCreateError("Couldn't send the challenge. Please try again.");
      }
    } catch {
      setCreateError("Couldn't send the challenge. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls =
    "w-full min-h-[44px] rounded-md border border-hairline bg-well px-3 py-2.5 text-sm text-text-primary placeholder:text-text-disabled focus:border-hairline-strong focus:outline-none";
  const labelCls = "mb-1.5 block text-sm font-medium text-text-secondary";

  return (
    <ModalShell
      label={passParent ? "Pass it on" : "Challenge someone"}
      onClose={onClose}
      maxWidthClass="max-w-[720px]"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          {passParent ? "Pass it on" : "Challenge someone"}
        </h2>
        <button
          onClick={onClose}
          aria-label="Close"
          className="inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-md text-text-secondary hover:bg-surface-overlay hover:text-text-primary"
        >
          <X className="h-5 w-5" strokeWidth={1.5} />
        </button>
      </div>

      <form onSubmit={send} className="mt-4 grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          {createError && (
            <div role="alert" className="rounded-md border border-error/30 bg-error-tint px-3 py-2 text-xs leading-5 text-error">
              {createError}
            </div>
          )}

          <div>
            <label htmlFor="ch-to" className={labelCls}>To</label>
            <select
              id="ch-to"
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
              className={inputCls}
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id} className="bg-surface-raised text-text-primary">
                  @{p.username}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="ch-problem" className={labelCls}>Problem</label>
            <div className="flex items-center gap-2">
              <input
                id="ch-problem"
                type="text"
                value={problemTitle}
                onChange={(e) => setProblemTitle(e.target.value)}
                placeholder="e.g. Coin Change II"
                disabled={!!passParent}
                className={inputCls}
                required
              />
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <DifficultyBadgeNew difficulty={difficulty} />
              {!passParent && (
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                  className="min-h-[44px] rounded-md border border-hairline bg-well px-2 text-xs text-text-secondary focus:outline-none"
                  aria-label="Difficulty"
                >
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="ch-time" className={labelCls}>Time to beat</label>
              <button
                type="button"
                role="switch"
                aria-checked={beatTime}
                onClick={() => setBeatTime((b) => !b)}
                className="inline-flex min-h-[44px] items-center gap-2 text-xs font-medium text-text-secondary"
              >
                <span
                  className={`inline-flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${beatTime ? "bg-primary" : "bg-surface-overlay"}`}
                >
                  <span
                    className={`h-4 w-4 rounded-full bg-canvas transition-transform ${beatTime ? "translate-x-4" : ""}`}
                  />
                </span>
                Beat my time
              </button>
            </div>
            <input
              id="ch-time"
              type="text"
              value={myTime}
              onChange={(e) => setMyTime(e.target.value)}
              placeholder="16:05"
              disabled={!beatTime}
              className={`${inputCls} font-mono disabled:opacity-40`}
            />
            <p className="mt-1 text-xs leading-5 text-text-tertiary">Your latest on this problem</p>
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <label htmlFor="ch-note" className={labelCls}>Note (optional)</label>
              <span className="font-mono text-xs text-text-tertiary">{note.length}/349</span>
            </div>
            <textarea
              id="ch-note"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 349))}
              rows={3}
              placeholder="Hint, encouragement, or nothing."
              className="w-full resize-none rounded-md border border-hairline bg-well px-3 py-2.5 text-sm text-text-primary placeholder:text-text-disabled focus:border-hairline-strong focus:outline-none"
            />
            <label className="mt-2 flex cursor-pointer items-start gap-2.5 text-xs leading-5 text-text-secondary">
              <input
                type="checkbox"
                checked={hideNote}
                onChange={(e) => setHideNote(e.target.checked)}
                className="mt-1 h-4 w-4 accent-[#F5B83D]"
              />
              Hide the note until they finish
            </label>
          </div>

          <div>
            <label htmlFor="ch-due" className={labelCls}>Due</label>
            <input
              id="ch-due"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-text-secondary">Preview</p>
          <Pass
            body={
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <Avatar name={profile?.username ?? "You"} src={profile?.avatar_url} size="md" />
                  <p className="font-display text-xl font-semibold tracking-tight">
                    {profile ? `@${profile.username} challenged you` : "You were challenged"}
                  </p>
                </div>
                <p className="text-sm font-medium capitalize text-text-primary">
                  {problemTitle.trim() || "Pick a problem"}
                </p>
                <p className="font-mono text-4xl font-medium tracking-tight">
                  {beatTime && senderSecs != null ? `Beat ${fmtTime(senderSecs)}` : "Solve it"}
                </p>
                {hideNote ? (
                  <p className="text-xs leading-5 text-text-tertiary">
                    A note is hidden until you finish.
                  </p>
                ) : note.trim() ? (
                  <p className="text-sm leading-6 text-text-secondary">“{note.trim()}”</p>
                ) : null}
                <p className="text-xs leading-5 text-text-tertiary">Due {dueLabel}</p>
              </div>
            }
            stub={
              <>
                <PassSerial>From @{profile?.username ?? "you"}</PassSerial>
                <PassSerial>To @{target?.username ?? "them"}</PassSerial>
                <PassSerial>Due {dueLabel}</PassSerial>
                <PassSerial>Open</PassSerial>
              </>
            }
          />
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-hairline pt-4 md:col-span-2">
          <Button variant="ghost" type="button" onClick={onClose} className="min-h-[44px]">
            Cancel
          </Button>
          <Button variant="primary" type="submit" loading={submitting} className="min-h-[44px]">
            {!submitting && "Send challenge"}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}
