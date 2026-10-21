"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  X,
  Check,
  ArrowRight,
  BadgeCheck,
  GraduationCap,
  Swords,
  CircleQuestionMark,
  BookOpen,
  MessagesSquare,
  Shield,
  Globe,
  Lock,
  SquarePen,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ModalShell } from "@/components/ui/ModalShell";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Avatar } from "@/components/ui/Avatar";
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
import { formatDuration, titleFromSlug } from "@/lib/format";
import { getCatalogBySlugs } from "@/lib/data/problems";
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

const TILES: { id: Tile; label: string; icon: LucideIcon }[] = [
  { id: "solve", label: "Share a solve", icon: BadgeCheck },
  { id: "teach", label: "Teach", icon: GraduationCap },
  { id: "challenge", label: "Challenge", icon: Swords },
  { id: "stuck", label: "Ask for help", icon: CircleQuestionMark },
  { id: "resource", label: "Share a resource", icon: BookOpen },
  { id: "discuss", label: "Start a discussion", icon: MessagesSquare },
];

const TILE_BLURB: Record<Exclude<Tile, "discuss">, string> = {
  solve: "Picks a battle you solved.",
  teach: "Puts a public approach or primer in the feed.",
  challenge: "Picks a squad-mate and a problem.",
  stuck: "A level, so nobody answers above it.",
  resource: "One of your vault items.",
};

/** "today" / "yesterday" / "Sat" / "12 Oct" for a battle's start. */
function dayLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(new Date()) - startOf(d)) / 86_400_000);
  if (diff <= 0) return "today";
  if (diff === 1) return "yesterday";
  if (diff < 7) return d.toLocaleDateString("en-GB", { weekday: "short" });
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** Section label: a quiet sans label on desktop, a mono caps caption on phones. */
const sectionLabelCls =
  "text-sm font-medium text-text-primary max-md:font-mono max-md:text-xs max-md:uppercase max-md:tracking-[0.06em] max-md:text-text-tertiary";

export function FeedComposer({
  onClose,
  onPosted,
  onDiscuss,
  squadName = null,
}: {
  onClose: () => void;
  onPosted: () => void;
  /** Discuss has its own modal; the tile hands off rather than duplicating it. */
  onDiscuss: () => void;
  /** Active squad's display name, for the audience note. */
  squadName?: string | null;
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

  // Catalog title and number for the battles on screen. The battle row only
  // has a slug; a failed lookup falls back to a title made from it.
  const [battleMeta, setBattleMeta] = useState<Map<string, { title: string; number: string | null }>>(
    new Map()
  );
  useEffect(() => {
    const slugs = Array.from(new Set(battles.slice(0, 5).map((b) => b.problem_slug)));
    if (slugs.length === 0) return;
    let cancelled = false;
    getCatalogBySlugs(slugs)
      .then((rows) => {
        if (cancelled) return;
        setBattleMeta(
          new Map(
            rows.map((r) => [r.title_slug, { title: r.title, number: r.question_id ? String(r.question_id) : null }])
          )
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [battles]);
  const battleTitle = useCallback(
    (slug: string) => battleMeta.get(slug)?.title ?? titleFromSlug(slug),
    [battleMeta]
  );

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
    "w-full min-h-[44px] rounded-md border border-hairline bg-well px-3 py-2 text-sm text-text-primary focus:border-hairline-strong focus:outline-none md:min-h-10";

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
      meta: React.ReactNode,
      opts: { badge?: React.ReactNode; number?: string | null; aside?: string } = {}
    ) => (
      <button
        key={id}
        type="button"
        role="radio"
        aria-checked={selected}
        onClick={onPick}
        className={cn(
          "flex min-h-[44px] w-full cursor-pointer items-center gap-3 rounded-md border p-3 text-left transition-colors max-md:rounded-lg max-md:p-2.5",
          selected
            ? "border-hairline-strong bg-surface-overlay max-md:border-primary/60 max-md:bg-well"
            : "border-hairline bg-surface hover:bg-surface-raised"
        )}
      >
        <span
          className={cn(
            "flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
            selected ? "border-2 border-primary" : "border border-text-disabled"
          )}
        >
          {selected && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                "truncate text-sm text-text-primary",
                selected ? "font-semibold" : "font-medium"
              )}
            >
              {title}
            </span>
            {opts.number && (
              <span className="hidden shrink-0 font-mono text-xs font-medium tracking-[0.06em] text-text-tertiary tnum md:inline">
                No. {opts.number}
              </span>
            )}
            {opts.badge && <span className="shrink-0 md:hidden">{opts.badge}</span>}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-text-tertiary">
            {opts.badge && <span className="hidden md:inline-flex">{opts.badge}</span>}
            {meta}
          </span>
        </span>
        {opts.aside && (
          <span className="shrink-0 font-mono text-xs font-medium tracking-[0.06em] text-text-tertiary max-md:rounded-xs max-md:border max-md:border-hairline max-md:bg-surface max-md:px-1.5 max-md:py-0.5">
            {opts.aside}
          </span>
        )}
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
          {battles.slice(0, 5).map((b) => {
            const selected = pickedBattle === b.id;
            const time = b.duration_sec != null ? formatDuration(b.duration_sec) : null;
            return radioRow(
              b.id,
              selected,
              () => setPickedBattle(b.id),
              battleTitle(b.problem_slug),
              <span
                className={cn(
                  "font-mono tnum",
                  time ? (selected ? "max-md:text-primary" : "max-md:text-text-secondary") : ""
                )}
              >
                {time ?? "Solved"}
              </span>,
              {
                number: battleMeta.get(b.problem_slug)?.number ?? null,
                badge:
                  b.evidence === "leetcode" ? (
                    <VerifiedBadge className="h-5 gap-0.5 border border-verified/30 px-1.5 font-mono text-[11px]" />
                  ) : undefined,
                aside: dayLabel(b.started_at),
              }
            );
          })}
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
            aria-label="Your time in seconds (optional)"
            className={cn(selectCls, "font-mono placeholder:text-text-disabled")}
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
  }, [tile, battles, teaching, people, problems, resources, pickedBattle, pickedTeach, pickedPerson, pickedProblem, pickedResource, myTimeSec, level, selectCls, battleMeta, battleTitle]);

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
  const activeTile = TILES.find((t) => t.id === tile);
  const audienceNote =
    audience === "squad" ? `Visible to ${squadName ? `${squadName} squad` : "your squad"}` : "Visible to everyone";

  return (
    <ModalShell
      label="Post to feed"
      onClose={onClose}
      variant="sheet"
      zIndexClass="z-[300]"
      maxWidthClass="max-w-[560px]"
      panelClassName="flex max-h-[92dvh] flex-col overflow-hidden p-0 md:max-h-[calc(100dvh-32px)]"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-hairline px-4 pb-2.5 pt-6 md:px-6 md:pb-3">
        <div className="flex min-w-0 items-center gap-2 md:gap-3">
          <SquarePen className="h-5 w-5 shrink-0 text-primary md:hidden" strokeWidth={1.5} aria-hidden />
          <h2 className="text-lg font-semibold leading-[26px] tracking-[-0.01em] text-text-primary">
            Post to feed
          </h2>
          {activeTile && (
            <span className="hidden h-6 items-center rounded-xs border border-primary/30 bg-primary-tint px-2 font-mono text-xs font-medium tracking-[0.06em] text-primary md:inline-flex">
              {activeTile.label}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="-mr-2 inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-overlay hover:text-text-primary md:mr-0 md:h-8 md:w-8"
        >
          <X className="h-5 w-5" strokeWidth={1.5} />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3 md:space-y-6 md:px-6 md:py-4">
        <section className="space-y-1.5 md:space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-text-tertiary max-md:font-mono max-md:uppercase max-md:tracking-[0.06em]">
              Select intent
            </span>
            {activeTile && (
              <span className="rounded-xs border border-hairline bg-primary-tint px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-primary md:hidden">
                {activeTile.label}
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-1.5 md:gap-2" role="radiogroup" aria-label="Post type">
            {TILES.map((t) => {
              const active = tile === t.id;
              const Icon = t.icon;
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
                    "group flex min-h-16 cursor-pointer flex-col items-start justify-between gap-1 rounded-md border p-2 text-left transition-colors md:min-h-0 md:justify-start md:p-2.5",
                    active
                      ? "border-primary bg-surface-overlay text-text-primary ring-1 ring-primary/40 max-md:border-primary/50 max-md:bg-primary-tint max-md:ring-0"
                      : "border-hairline bg-surface text-text-secondary hover:border-hairline-strong hover:bg-surface-overlay hover:text-text-primary"
                  )}
                >
                  <span className="flex w-full items-center justify-between">
                    <Icon
                      className={cn(
                        "h-[18px] w-[18px]",
                        active ? "text-primary" : "text-text-tertiary group-hover:text-text-primary"
                      )}
                      strokeWidth={1.5}
                      aria-hidden
                    />
                    {active && <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />}
                  </span>
                  <span className="text-xs font-medium leading-tight md:text-[13px]">{t.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className={sectionLabelCls}>
              {tile === "solve" && "Pick a battle"}
              {tile === "teach" && "Pick something you wrote"}
              {tile === "challenge" && "Pick a squad mate and a problem"}
              {tile === "stuck" && "Pick a problem and a level"}
              {tile === "resource" && "Pick a vault item"}
            </p>
            {tile === "solve" && battles.length > 0 && (
              <span className="font-mono text-xs font-medium tracking-[0.06em] text-text-tertiary tnum">
                {Math.min(battles.length, 5)} recent {Math.min(battles.length, 5) === 1 ? "solve" : "solves"}
              </span>
            )}
          </div>
          {tile !== "solve" && tile !== "discuss" && (
            <p className="text-xs leading-5 text-text-tertiary">{TILE_BLURB[tile]}</p>
          )}
          {picker}
        </section>

        {tile !== "discuss" && (
          <section className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="composer-caption" className={sectionLabelCls}>
                Add a line (optional)
              </label>
              <span className="font-mono text-xs font-medium tracking-[0.06em] text-text-tertiary tnum">
                {caption.length}/280
              </span>
            </div>
            <textarea
              id="composer-caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, 280))}
              rows={2}
              placeholder="Finally saw why the loop order matters."
              className="w-full resize-y rounded-md border border-hairline bg-well px-3 py-2.5 text-[15px] leading-6 text-text-primary placeholder:text-text-disabled focus:border-hairline-strong focus:outline-none max-md:rounded-lg max-md:text-sm"
            />
          </section>
        )}

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-text-tertiary max-md:font-mono max-md:uppercase max-md:tracking-[0.06em]">
              Audience
            </span>
            <SegmentedControl
              label="Who sees this post"
              value={audience}
              onChange={setAudience}
              className="max-md:h-auto [&>button]:whitespace-nowrap"
              options={[
                { value: "squad", label: "Squad" },
                { value: "everyone", label: "Everyone" },
              ]}
            />
          </div>

          {tile === "solve" && pickedBattleRow && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-text-tertiary">Preview as it will appear</span>
                <span className="flex items-center gap-1 font-mono text-xs font-medium tracking-[0.06em] text-text-tertiary">
                  {audience === "squad" ? (
                    <Lock className="h-3.5 w-3.5 text-primary" strokeWidth={1.5} aria-hidden />
                  ) : (
                    <Globe className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                  )}
                  {audience === "squad" ? "Squad-only" : "Everyone"}
                </span>
              </div>
              <div className="space-y-2 rounded-md border border-hairline bg-surface p-3 md:p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Avatar
                      name={profile?.username ?? "You"}
                      src={profile?.avatar_url}
                      size="md"
                      className="ring-1 ring-primary/30"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-text-primary">
                          {profile?.username ?? "You"}
                        </span>
                        {pickedBattleRow.evidence === "leetcode" && (
                          <VerifiedBadge className="h-5 border border-verified/30 px-1.5 font-mono text-[10px]" />
                        )}
                      </div>
                      <p className="text-[13px] leading-snug text-text-secondary">
                        Solved{" "}
                        <span className="font-medium text-text-primary">
                          {battleTitle(pickedBattleRow.problem_slug)}
                        </span>
                        {pickedBattleRow.duration_sec != null && (
                          <>
                            {" "}in{" "}
                            <span className="font-mono text-text-primary tnum">
                              {formatDuration(pickedBattleRow.duration_sec)}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 font-mono text-xs font-medium tracking-[0.06em] text-text-tertiary">
                    Just now
                  </span>
                </div>
                {caption.trim() && (
                  <blockquote className="border-l-2 border-primary/40 pl-2.5 text-sm italic text-text-primary">
                    “{caption.trim()}”
                  </blockquote>
                )}
              </div>
            </div>
          )}
        </section>

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

      <div className="flex shrink-0 items-center gap-3 border-t border-hairline bg-surface-raised p-4 pb-[calc(16px+env(safe-area-inset-bottom))] md:justify-between md:bg-surface md:px-6 md:pb-4">
        <p className="hidden min-w-0 items-center gap-2 text-xs font-medium text-text-tertiary md:flex">
          {audience === "squad" ? (
            <Shield className="h-4 w-4 shrink-0 text-primary" strokeWidth={1.5} aria-hidden />
          ) : (
            <Globe className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden />
          )}
          <span className="truncate">{audienceNote}</span>
        </p>
        <div className="flex w-full items-center gap-3 md:w-auto">
          <Button
            variant="ghost"
            onClick={onClose}
            className="h-11 flex-1 border border-hairline bg-surface md:h-10 md:flex-none md:border-transparent md:bg-transparent"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => void doSubmit()}
            disabled={!canSubmit || busy}
            loading={busy}
            className="h-11 flex-[2] font-semibold md:h-10 md:flex-none md:px-6 md:font-medium"
          >
            {!busy && (
              <>
                <span className="md:hidden">Post to Feed</span>
                <span className="hidden md:inline">Post</span>
                <ArrowRight className="h-[18px] w-[18px] md:hidden" strokeWidth={1.75} aria-hidden />
              </>
            )}
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}
