"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ModalShell } from "@/components/ui/ModalShell";
import { Spinner } from "@/components/ui/Spinner";
import {
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

const TILE_COPY: Record<Tile, { title: string; blurb: string }> = {
  solve: { title: "Share a solve", blurb: "Picks a battle you solved." },
  teach: { title: "Teach", blurb: "Puts a public approach or primer in the feed." },
  challenge: { title: "Challenge", blurb: "Picks a squad-mate and a problem." },
  stuck: { title: "Ask help", blurb: "A level, so nobody answers above it." },
  resource: { title: "Share resource", blurb: "One of your vault items." },
  discuss: { title: "Discuss", blurb: "Problem-linked, pattern-linked, gated." },
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

  const [tile, setTile] = useState<Tile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

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
    if (!tile) return;
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
      const res = await shareSolvedBattle(battle);
      if (!res.ok) {
        setError(res.error ?? "Couldn't share that.");
        return;
      }
      finish(`Shared ${battle.problem_slug.replace(/-/g, " ")}.`);
    } finally {
      setBusy(false);
    }
  }, [battles, pickedBattle, finish]);

  const submitTeach = useCallback(async () => {
    const item = teaching.find((t) => t.id === pickedTeach);
    if (!item) return;
    setBusy(true);
    setError(null);
    try {
      const res = await shareTeaching(item, squadId);
      if (!res.ok) {
        setError(res.error ?? "Couldn't share that.");
        return;
      }
      finish(`Shared ${item.label}.`);
    } finally {
      setBusy(false);
    }
  }, [teaching, pickedTeach, squadId, finish]);

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
        squadId,
        problemSlug: problem.slug,
        problemTitle: problem.title,
        objectType: "suggestion",
        objectId: res.suggestion?.id ?? null,
      });
      finish(`Challenged @${person.username} with ${problem.title}.`);
    } finally {
      setBusy(false);
    }
  }, [people, problems, pickedPerson, pickedProblem, myTimeSec, user, squadId, finish]);

  const submitStuck = useCallback(async () => {
    const problem = problems.find((p) => p.slug === pickedProblem);
    if (!problem) return;
    setBusy(true);
    setError(null);
    try {
      const res = await createStuckRequest({
        problemSlug: problem.slug,
        level: level as Parameters<typeof createStuckRequest>[0]["level"],
        visibility: squadId ? "squad" : "public",
        squadId,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      await logFeedEvent({
        eventType: "stuck",
        squadId,
        problemSlug: problem.slug,
        problemTitle: problem.title,
        objectType: "stuck_request",
        objectId: res.request.id,
        metadata: { level },
      });
      finish("Asked for help.");
    } finally {
      setBusy(false);
    }
  }, [problems, pickedProblem, level, squadId, finish]);

  const submitResource = useCallback(async () => {
    const item = resources.find((r) => r.id === pickedResource);
    if (!item) return;
    setBusy(true);
    setError(null);
    try {
      const res = await shareVaultResource(item, squadId);
      if (!res.ok) {
        setError(res.error ?? "Couldn't share that.");
        return;
      }
      finish(`Shared ${item.label}.`);
    } finally {
      setBusy(false);
    }
  }, [resources, pickedResource, squadId, finish]);

  const picker = useMemo(() => {
    const cls = "w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-white/20";
    const empty = (msg: string) => (
      <p className="text-[11px] text-white/35">{msg}</p>
    );

    if (tile === "solve") {
      if (battles.length === 0) return empty("No solved battles yet. Solve something first, then come back.");
      return (
        <select value={pickedBattle} onChange={(e) => setPickedBattle(e.target.value)} className={cls}>
          <option value="">Pick a battle…</option>
          {battles.map((b) => (
            <option key={b.id} value={b.id}>
              {b.problem_slug.replace(/-/g, " ")}
              {b.duration_sec != null ? ` · ${formatDuration(b.duration_sec)}` : ""}
              {b.evidence === "leetcode" ? " · verified" : ""}
            </option>
          ))}
        </select>
      );
    }

    if (tile === "teach") {
      if (teaching.length === 0) {
        return empty("No public approaches or primers yet. Only public ones can be shared — make one public first.");
      }
      return (
        <select value={pickedTeach} onChange={(e) => setPickedTeach(e.target.value)} className={cls}>
          <option value="">Pick something you wrote…</option>
          {teaching.map((t) => (
            <option key={`${t.kind}:${t.id}`} value={t.id}>
              {t.label} · {t.sublabel}
            </option>
          ))}
        </select>
      );
    }

    if (tile === "challenge") {
      if (people.length === 0) return empty("Nobody to challenge. This needs a squad with at least one other member.");
      if (problems.length === 0) return empty("No solved problems to challenge with.");
      return (
        <div className="space-y-2">
          <select value={pickedPerson} onChange={(e) => setPickedPerson(e.target.value)} className={cls}>
            <option value="">Pick a squad-mate…</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>@{p.username}</option>
            ))}
          </select>
          <select value={pickedProblem} onChange={(e) => setPickedProblem(e.target.value)} className={cls}>
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
            className={cls}
          />
        </div>
      );
    }

    if (tile === "stuck") {
      if (problems.length === 0) return empty("Ask about a problem you have already logged a solve for.");
      return (
        <div className="space-y-2">
          <select value={pickedProblem} onChange={(e) => setPickedProblem(e.target.value)} className={cls}>
            <option value="">Pick a problem…</option>
            {problems.map((p) => (
              <option key={p.slug} value={p.slug}>{p.title}</option>
            ))}
          </select>
          <select value={level} onChange={(e) => setLevel(e.target.value)} className={cls}>
            {STUCK_LEVELS.map((l) => (
              <option key={l} value={l}>{LEVEL_LABEL[l]}</option>
            ))}
          </select>
          <p className="text-[10px] text-white/30">
            The level is a contract: nobody may answer above it.
          </p>
        </div>
      );
    }

    if (tile === "resource") {
      if (resources.length === 0) return empty("No vault items yet.");
      return (
        <select value={pickedResource} onChange={(e) => setPickedResource(e.target.value)} className={cls}>
          <option value="">Pick a resource…</option>
          {resources.map((r) => (
            <option key={r.id} value={r.id}>{r.label} · {r.sublabel}</option>
          ))}
        </select>
      );
    }

    return null;
  }, [tile, battles, teaching, people, problems, resources, level, pickedBattle, pickedTeach, pickedPerson, pickedProblem, pickedResource, myTimeSec]);

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

  return (
    <ModalShell label="Post something" onClose={onClose} alignTop>
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-white">Post something</h2>
          <p className="text-[11px] text-white/40 mt-1">
            Structured, not a blank box. Each one creates a real thing.
          </p>
        </div>

        {!tile ? (
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(TILE_COPY) as Tile[]).map((t) => (
              <button
                key={t}
                onClick={() => {
                  if (t === "discuss") {
                    onClose();
                    onDiscuss();
                    return;
                  }
                  setTile(t);
                }}
                className="p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] text-left transition-all cursor-pointer"
              >
                <div className="text-[11px] font-bold text-white/80">{TILE_COPY[t].title}</div>
                <div className="text-[10px] text-white/30 mt-0.5">{TILE_COPY[t].blurb}</div>
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setTile(null);
                  setError(null);
                }}
                className="text-[11px] font-bold text-white/35 hover:text-white cursor-pointer"
              >
                ← All tiles
              </button>
              <span className="text-sm font-bold text-white">{TILE_COPY[tile].title}</span>
            </div>

            <p className="text-[11px] text-white/35">{TILE_COPY[tile].blurb}</p>
            {picker}

            {note && <p className="text-[11px] text-[#30d158]">{note}</p>}
            {error && (
              <div role="alert" className="text-[11px] text-[#ff453a]">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-full text-xs font-bold text-white/50 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => void doSubmit()}
                disabled={!canSubmit || busy}
                className="px-5 py-2 rounded-full bg-[#fa586a] text-white text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {busy && <Spinner size="xs" tone="inverse" />}
                Post
              </button>
            </div>
          </>
        )}

        <p className="text-[10px] text-white/20 pt-2 border-t border-white/[0.06]">
          Not sure where something goes?{" "}
          <Link href="/notebook" className="underline">
            Notebook
          </Link>{" "}
          ·{" "}
          <Link href="/challenges" className="underline">
            Challenges
          </Link>{" "}
          ·{" "}
          <Link href="/vault" className="underline">
            Vault
          </Link>
        </p>
      </div>
    </ModalShell>
  );
}