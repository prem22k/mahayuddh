"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { X, Check, Trophy, BookOpen, Swords, LifeBuoy, FolderOpen, MessageCircle } from "lucide-react";
import { ModalShell } from "@/components/ui/ModalShell";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { VerifiedBadge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import {
  captionMetadata,
  getChallengeablePeople,
  getMyPublicTeaching,
  getMyShareableBattles,
  getMySolvedProblems,
  getMyVaultResources,
  shareSolvedBattle,
  shareTeaching,
  shareVaultResource,
  type PickablePerson,
  type PickableTeaching,
  type PickableBattle,
} from "@/lib/data/composer";
import { createSuggestion } from "@/lib/data/suggestions";
import { createStuckRequest } from "@/lib/data/stuck";
import { logFeedEvent } from "@/lib/data/feed";
import { useAuth } from "@/components/providers/AuthProvider";
import { dataErrorMessage } from "@/lib/data/errors";
import { formatDuration } from "@/lib/format";
import { track } from "@/lib/analytics";
import { LEVEL_LABEL, STUCK_LEVELS } from "@/lib/stuckLadder";

/**
 * The structured composer (Step 21, Bible §18, §64).
 *
 * Five tiles create something, one tile is Discuss. The plan says each tile
 * "creates correct underlying object + feed event", and the first version just
 * linked to wherever the object gets created — which asks the reader to
 * remember the shape of five different screens.
 *
 * Two rules the tiles follow:
 *
 *   - A tile never offers an object that would be published without consent. The
 *     Teach picker only lists public approaches and primers; the Challenge
 *     picker only lists your solved problems; Share resource only lists your own.
 *   - Ownership is re-checked at write time, not trusted from the picker. Ids
 *     arrive from the client, so "is this your battle?" is answered by the
 *     database at insert rather than by what the dropdown showed.
 */

type Tile = "solve" | "teach" | "challenge" | "stuck" | "resource" | "discuss";

const TILES: { id: Tile; label: string; icon: React.ReactNode }[] = [
  { id: "solve", label: "Share a solve", icon: <Trophy className="h-4 w-4" strokeWidth={1.5} /> },
  { id: "teach", label: "Teach", icon: <BookOpen className="h-4 w-4" strokeWidth={1.5} /> },
  { id: "challenge", label: "Challenge", icon: <Swords className="h-4 w-4" strokeWidth={1.5} /> },
  { id: "stuck", label: "Ask for help", icon: <LifeBuoy className="h-4 w-4" strokeWidth={1.5} /> },
  { id: "resource", label: "Share a resource", icon: <FolderOpen className="h-4 w-4" strokeWidth={1.5} /> },
  { id: "discuss", label: "Start a discussion", icon: <MessageCircle className="h-4 w-4" strokeWidth={1.5} /> },
];

const TILE_BLURB: Record<Exclude<Tile, "discuss">, string> = {
  solve: "Picks a battle you solved.",
  teach: "Puts a public approach or primer in the feed.",
  challenge: "Picks a squad-mate and a problem.",
  stuck: "A level, so nobody answers above it.",
  resource: "One of your vault items.",
};

export function FeedComposer({
  onClose,
  onPosted,
  onDiscuss,
}: {
  onClose: () => void;
  onPosted: () => void;
  /** Discuss has its own modal; the tile hands off rather than duplicating it. */
  onDiscuss: () => void;
}) {
  const { profile, user } = useAuth();
  const squadId = profile?.active_squad_id ?? null;

  const [tile, setTile] = useState<Tile>("solve");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [audience, setAudience] = useState<"squad" | "everyone">("squad");

  const [battles, setBattles] = useState<PickableBattle[]>([]);
  const [teaching, setTeaching] = useState<PickableTeaching[]>([]);
  const [people, setPeople] = useState<PickablePerson[]>([]);
  const [problems, setProblems] = useState<{ slug: string; title: string }[]>([]);
  const [resources, setResources] = useState<PickableTeaching[]>([]);

  // Per-tile form state.
  const [pickedBattle, setPickedBattle] = useState<string>("");
  const [pickedTeach, setPickedTeach] = useState<string>("");
  const [pickedPerson, setPickedPerson] = useState<string>("");
  const [pickedProblem, setPickedProblem] = useState<string>("");
  const [pickedResource, setPickedResource] = useState<string>("");
  const [level, setLevel] = useState<string>("nudge");
  const [myTimeSec, setMyTimeSec] = useState<string>("");

  // Loaded only for the tile that needs them. Five round trips on every open
  // would make the composer feel slow for no reason.
  useEffect(() => {
    const load = async () => {
      try {
        if (tile === "solve") setBattles(await getMyShareableBattles());
        if (tile === "teach") setTeaching(await getMyPublicTeaching());
        if (tile === "resource") setResources(await getMyVaultResources());
        if (tile === "challenge") {
          const [p, probs] = await Promise.all([
            getChallengeablePeople(squadId),
            getMySolvedProblems(),
          ]);
          setPeople(p);
          setProblems(probs);
        }
        if (tile === "stuck") setProblems(await getMySolvedProblems());
      } catch (err) {
        setError(dataErrorMessage(err, "Couldn't load your options."));
      }
    };
    void load();
  }, [tile, squadId]);

  // A callback rather than a plain function: the submit handlers are callbacks
  // too, and leaving this out of their deps is a lint warning rather than a
  // stated rule.
  const finish = useCallback(
    (message: string) => {
      setNote(message);
      track("composer_posted", { tile: tile ?? "unknown" });
      onPosted();
      setTimeout(onClose, 900);
    },
    [tile, onPosted, onClose]
  );

  const submitSolve = useCallback(async () => {
    const battle = battles.find((b) => b.id === pickedBattle);
    if (!battle) return;
    setBusy(true);
    setError(null);
    try {
      const res = await shareSolvedBattle(battle, caption);
      if (!res.ok) {
        setError(res.error ?? "Couldn't share that.");
        return;
      }
      finish(`Shared ${battle.problem_slug.replace(/-/g, " ")}.`);
    } finally {
      setBusy(false);
    }
  }, [battles, pickedBattle, caption, finish]);

  const submitTeach = useCallback(async () => {
    const item = teaching.find((t) => t.id === pickedTeach);
    if (!item) return;
    setBusy(true);
    setError(null);
    try {
      const res = await shareTeaching(item, audience === "squad" ? squadId : null, caption);
      if (!res.ok) {
        setError(res.error ?? "Couldn't share that.");
        return;
      }
      finish(`Shared ${item.label}.`);
    } finally {
      setBusy(false);
    }
  }, [teaching, pickedTeach, squadId, audience, caption, finish]);

  const submitChallenge = useCallback(async () => {
    const person = people.find((p) => p.id === pickedPerson);
    const problem = problems.find((p) => p.slug === pickedProblem);
    if (!person || !problem || !user) return;
    setBusy(true);
    setError(null);
    try {
      const secs = myTimeSec.trim() === "" ? null : Number(myTimeSec);
      const res = await createSuggestion({
        fromUser: user.id,
        toUser: person.id,
        problemSlug: problem.slug,
        problemTitle: problem.title,
        difficulty: "Medium",
        senderTimeSec: secs != null && Number.isFinite(secs) ? secs : null,
        beatTime: secs != null && Number.isFinite(secs),
      });
      if (!res.ok) {
        setError(
          res.reason === "duplicate"
            ? "There is already an open challenge on that problem between you two."
            : res.reason === "invalid"
              ? "That challenge wouldn't be valid — check the problem and your time."
              : "Couldn't send that challenge. Retry."
        );
        return;
      }
      // §64: the feed points at the challenge, it does not copy its text.
      await logFeedEvent({
        eventType: "challenge",
        squadId: audience === "squad" ? squadId : null,
        problemSlug: problem.slug,
        problemTitle: problem.title,
        objectType: "suggestion",
        objectId: res.suggestion?.id ?? null,
        metadata: captionMetadata({}, caption),
      });
      finish(`Challenged @${person.username} with ${problem.title}.`);
    } finally {
      setBusy(false);
    }
  }, [people, problems, pickedPerson, pickedProblem, myTimeSec, user, squadId, audience, caption, finish]);

  const submitStuck = useCallback(async () => {
    const problem = problems.find((p) => p.slug === pickedProblem);
    if (!problem) return;
    setBusy(true);
    setError(null);
    try {
      const res = await createStuckRequest({
        problemSlug: problem.slug,
        level: level as Parameters<typeof createStuckRequest>[0]["level"],
        visibility: audience === "squad" && squadId ? "squad" : "public",
        squadId: audience === "squad" ? squadId : null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      await logFeedEvent({
        eventType: "stuck",
        squadId: audience === "squad" ? squadId : null,
        problemSlug: problem.slug,
        problemTitle: problem.title,
        objectType: "stuck_request",
        objectId: res.request.id,
        metadata: captionMetadata({ level }, caption),
      });
      finish("Asked for help.");
    } finally {
      setBusy(false);
    }
  }, [problems, pickedProblem, level, squadId, audience, caption, finish]);

  const submitResource = useCallback(async () => {
    const item = resources.find((r) => r.id === pickedResource);
    if (!item) return;
    setBusy(true);
    setError(null);
    try {
      const res = await shareVaultResource(item, audience === "squad" ? squadId : null, caption);
      if (!res.ok) {
        setError(res.error ?? "Couldn't share that.");
        return;
      }
      finish(`Shared ${item.label}.`);
    } finally {
      setBusy(false);
    }
  }, [resources, pickedResource, squadId, audience, caption, finish]);

  const selectCls =
    "w-full min-h-[44px] rounded-md border border-hairline bg-well px-3 py-2 text-sm text-text-primary focus:border-hairline-strong focus:outline-none";

  const picker = useMemo(() => {
    const empty = (msg: string, cta?: { label: string; href: string }) => (
      <div className="rounded-md border border-hairline bg-well px-3 py-4 text-center">
        <p className="text-xs leading-5 text-text-secondary">{msg}</p>
        {cta && (
          <a
            href={cta.href}
            className="mt-2 inline-flex min-h-[44px] items-center rounded-md px-3 text-xs font-medium text-text-primary underline underline-offset-4"
          >
            {cta.label}
          </a>
        )}
      </div>
    );

    const radioRow = (
      id: string,
      selected: boolean,
      onPick: () => void,
      title: string,
      meta: string,
      badge?: React.ReactNode
    ) => (
      <button
        key={id}
        type="button"
        role="radio"
        aria-checked={selected}
        onClick={onPick}
        className={cn(
          "flex min-h-[44px] w-full cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-colors",
          selected
            ? "border-hairline-strong bg-surface-overlay"
            : "border-hairline bg-transparent hover:bg-surface-raised"
        )}
      >
        <span
          className={cn(
            "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
            selected ? "border-text-primary" : "border-hairline-strong"
          )}
        >
          {selected && <span className="h-2 w-2 rounded-full bg-text-primary" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-text-primary">{title}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-text-tertiary">
            {meta}
            {badge}
          </span>
        </span>
      </button>
    );

    if (tile === "solve") {
      if (battles.length === 0)
        return empty("No finished battles yet. Solve one and share it here.", {
          label: "Go to today's battle",
          href: "/home",
        });
      return (
        <div className="space-y-1.5" role="radiogroup" aria-label="Pick a battle">
          {battles.slice(0, 5).map((b) =>
            radioRow(
              b.id,
              pickedBattle === b.id,
              () => setPickedBattle(b.id),
              b.problem_slug.replace(/-/g, " "),
              `${b.duration_sec != null ? formatDuration(b.duration_sec) : "Solved"}`,
              b.evidence === "leetcode" ? <VerifiedBadge /> : undefined
            )
          )}
        </div>
      );
    }

    if (tile === "teach") {
      if (teaching.length === 0) {
        return empty("No public approaches or primers yet. Only public ones can be shared.");
      }
      return (
        <div className="space-y-1.5" role="radiogroup" aria-label="Pick something you wrote">
          {teaching.map((t) =>
            radioRow(
              `${t.kind}:${t.id}`,
              pickedTeach === t.id,
              () => setPickedTeach(t.id),
              t.label,
              t.sublabel
            )
          )}
        </div>
      );
    }

    if (tile === "challenge") {
      if (people.length === 0) return empty("Nobody to challenge. This needs a squad with at least one other member.");
      if (problems.length === 0) return empty("No solved problems to challenge with.");
      return (
        <div className="space-y-2">
          <select value={pickedPerson} onChange={(e) => setPickedPerson(e.target.value)} className={selectCls} aria-label="Pick a squad mate">
            <option value="">Pick a squad-mate…</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>@{p.username}</option>
            ))}
          </select>
          <select value={pickedProblem} onChange={(e) => setPickedProblem(e.target.value)} className={selectCls} aria-label="Pick a problem">
            <option value="">Pick a problem…</option>
            {problems.map((p) => (
              <option key={p.slug} value={p.slug}>{p.title}</option>
            ))}
          </select>
          <input
            value={myTimeSec}
            onChange={(e) => setMyTimeSec(e.target.value.replace(/[^0-9]/g, ""))}
            inputMode="numeric"
            placeholder="Your time in seconds (optional)"
            className={cn(selectCls, "font-mono")}
          />
        </div>
      );
    }

    if (tile === "stuck") {
      if (problems.length === 0) return empty("Ask about a problem you have already logged a solve for.");
      return (
        <div className="space-y-2">
          <select value={pickedProblem} onChange={(e) => setPickedProblem(e.target.value)} className={selectCls} aria-label="Pick a problem">
            <option value="">Pick a problem…</option>
            {problems.map((p) => (
              <option key={p.slug} value={p.slug}>{p.title}</option>
            ))}
          </select>
          <select value={level} onChange={(e) => setLevel(e.target.value)} className={selectCls} aria-label="Help level">
            {STUCK_LEVELS.map((l) => (
              <option key={l} value={l}>{LEVEL_LABEL[l]}</option>
            ))}
          </select>
          <p className="text-xs leading-5 text-text-tertiary">
            The level is a contract: nobody may answer above it.
          </p>
        </div>
      );
    }

    if (tile === "resource") {
      if (resources.length === 0) return empty("No vault items yet.");
      return (
        <div className="space-y-1.5" role="radiogroup" aria-label="Pick a resource">
          {resources.map((r) =>
            radioRow(`${r.id}`, pickedResource === r.id, () => setPickedResource(r.id), r.label, r.sublabel)
          )}
        </div>
      );
    }

    return null;
  }, [tile, battles, teaching, people, problems, resources, pickedBattle, pickedTeach, pickedPerson, pickedProblem, pickedResource, myTimeSec, level, selectCls]);

  const canSubmit =
    (tile === "solve" && pickedBattle !== "") ||
    (tile === "teach" && pickedTeach !== "") ||
    (tile === "challenge" && pickedPerson !== "" && pickedProblem !== "") ||
    (tile === "stuck" && pickedProblem !== "") ||
    (tile === "resource" && pickedResource !== "");

  const doSubmit = () => {
    if (tile === "solve") return submitSolve();
    if (tile === "teach") return submitTeach();
    if (tile === "challenge") return submitChallenge();
    if (tile === "stuck") return submitStuck();
    if (tile === "resource") return submitResource();
  };

  const pickedBattleRow = battles.find((b) => b.id === pickedBattle);

  return (
    <ModalShell label="Post to feed" onClose={onClose} maxWidthClass="max-w-[560px]">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-2xl font-semibold tracking-tight">Post to feed</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-md text-text-secondary hover:bg-surface-overlay hover:text-text-primary"
          >
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Post type">
          {TILES.map((t) => {
            const active = tile === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => {
                  if (t.id === "discuss") {
                    onClose();
                    onDiscuss();
                    return;
                  }
                  setTile(t.id);
                  setError(null);
                }}
                className={cn(
                  "flex min-h-[44px] cursor-pointer flex-col items-center justify-center gap-1 rounded-md border px-2 py-2.5 text-xs font-medium transition-colors",
                  active
                    ? "border-hairline-strong bg-surface-overlay text-text-primary"
                    : "border-hairline bg-transparent text-text-secondary hover:bg-surface-raised hover:text-text-primary"
                )}
              >
                {t.icon}
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-sm font-medium text-text-secondary">
              {tile === "solve" && "Pick a battle"}
              {tile === "teach" && "Pick something you wrote"}
              {tile === "challenge" && "Pick a squad mate and a problem"}
              {tile === "stuck" && "Pick a problem and a level"}
              {tile === "resource" && "Pick a vault item"}
            </p>
            {picker}
          </div>

          {tile !== "discuss" && (
            <div>
              <div className="flex items-baseline justify-between">
                <label htmlFor="composer-caption" className="mb-1.5 block text-sm font-medium text-text-secondary">
                  Add a line (optional)
                </label>
                <span className="font-mono text-xs text-text-tertiary">{caption.length}/280</span>
              </div>
              <textarea
                id="composer-caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value.slice(0, 280))}
                rows={2}
                placeholder="Finally saw why the loop order matters."
                className="w-full resize-y rounded-md border border-hairline bg-well px-3 py-2.5 text-sm text-text-primary placeholder:text-text-disabled focus:border-hairline-strong focus:outline-none"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <p className="text-sm font-medium text-text-secondary">Audience</p>
            <SegmentedControl
              label="Who sees this post"
              value={audience}
              onChange={setAudience}
              options={[
                { value: "squad", label: "Squad" },
                { value: "everyone", label: "Everyone" },
              ]}
            />
          </div>

          {tile === "solve" && pickedBattleRow && (
            <div className="rounded-md border border-hairline bg-well p-3">
              <p className="mb-1.5 text-xs text-text-tertiary">Preview</p>
              <p className="text-sm leading-6 text-text-primary">
                You solved {pickedBattleRow.problem_slug.replace(/-/g, " ")}
                {pickedBattleRow.duration_sec != null && (
                  <> in <span className="font-mono">{formatDuration(pickedBattleRow.duration_sec)}</span></>
                )}
              </p>
              {caption.trim() && (
                <p className="mt-1 text-sm leading-6 text-text-secondary">“{caption.trim()}”</p>
              )}
            </div>
          )}

          {note && (
            <p className="flex items-center gap-1.5 text-xs leading-5 text-verified">
              <Check className="h-3.5 w-3.5" strokeWidth={1.5} />
              {note}
            </p>
          )}
          {error && (
            <div role="alert" className="rounded-md border border-error/30 bg-error-tint px-3 py-2 text-xs leading-5 text-error">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-hairline pt-4">
          <Button variant="ghost" onClick={onClose} className="min-h-[44px]">
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => void doSubmit()}
            disabled={!canSubmit || busy}
            loading={busy}
            className="min-h-[44px]"
          >
            {!busy && "Post"}
          </Button>
        </div>
        {tile !== "solve" && tile !== "discuss" && (
          <p className="text-xs leading-5 text-text-tertiary">{TILE_BLURB[tile]}</p>
        )}
      </div>
    </ModalShell>
  );
}
