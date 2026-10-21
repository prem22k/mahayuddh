"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Check, ChevronDown, CircleHelp, Plus, RefreshCw, TriangleAlert, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageLoader } from "@/components/ui/PageLoader";
import { useAuth } from "@/components/providers/AuthProvider";
import { dataErrorMessage } from "@/lib/data/errors";
import {
  getGateBoard,
  getTestStatus,
  getSquadsForValidation,
  listObservations,
  recordObservation,
  listTriage,
  addTriageFeature,
  decideTriage,
  Observation,
  SquadOption,
} from "@/lib/data/validation";
import {
  GateBoard,
  Gate,
  GateVerdict,
  ObservationCategory,
  OBSERVATION_CATEGORIES,
  OBSERVATION_DAYS,
  REVIEW_QUESTIONS,
  REVIEW_RULE,
  TestStatus,
  TRIAGE_FIELDS,
  TRIAGE_LABELS,
  TriageEntry,
  TriageLabel,
  triageCompleteness,
} from "@/lib/validation/gates";

/**
 * Stitch "Quality gates" (internal). A pass is a neutral check, not emerald:
 * emerald means a LeetCode-verified solve and nothing else. A fail is rose.
 * A gate with nothing to measure says so; it is never drawn as a pass.
 */
const VERDICT_STYLE: Record<GateVerdict, { cls: string; Icon: typeof Check; word: string }> = {
  pass: { cls: "border-hairline bg-surface-overlay text-text-primary", Icon: Check, word: "Pass" },
  fail: { cls: "border-error/20 bg-error-tint text-error", Icon: X, word: "Fail" },
  unknown: { cls: "border-hairline bg-well text-text-tertiary", Icon: CircleHelp, word: "No data" },
};

const cardCls = "rounded-xl border border-hairline bg-surface";
const sectionLabelCls = "font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-text-tertiary";
const inputCls =
  "w-full rounded-md border border-hairline bg-well px-3 text-sm text-text-primary placeholder:text-text-disabled transition-colors focus:border-hairline-strong focus:outline-none";
const selectCls = cn(inputCls, "h-11 appearance-none pr-9 md:h-10");
const secondaryBtn =
  "inline-flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-hairline bg-surface-overlay px-4 text-sm font-medium text-text-primary transition-colors hover:border-hairline-strong hover:bg-[#272830] disabled:cursor-not-allowed disabled:text-text-disabled md:h-10";

function VerdictBadge({ verdict }: { verdict: GateVerdict }) {
  const style = VERDICT_STYLE[verdict];
  return (
    <span
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xs border px-2.5 text-xs font-medium",
        style.cls
      )}
    >
      <style.Icon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
      {style.word}
    </span>
  );
}

function CardHeader({
  id,
  title,
  description,
  tag,
}: {
  id: string;
  title: string;
  description: string;
  tag: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-hairline pb-3">
      <div className="min-w-0">
        <h2 id={id} className="font-display text-base font-semibold tracking-tight text-text-primary">
          {title}
        </h2>
        <p className="mt-0.5 text-xs leading-5 text-text-tertiary">{description}</p>
      </div>
      <span className="shrink-0 rounded-xs border border-hairline bg-well px-2 py-0.5 font-mono text-[11px] text-text-tertiary">
        {tag}
      </span>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children,
  id,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  id: string;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-text-secondary">
        {label}
      </label>
      <div className="relative">
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={selectCls}>
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary"
          strokeWidth={1.5}
          aria-hidden
        />
      </div>
    </div>
  );
}

export default function ValidationPage() {
  const { user } = useAuth();
  const [board, setBoard] = useState<GateBoard | null>(null);
  const [status, setStatus] = useState<TestStatus | null>(null);
  const [squads, setSquads] = useState<SquadOption[]>([]);
  const [squadId, setSquadId] = useState<string>("");
  const [observations, setObservations] = useState<Observation[]>([]);
  const [triage, setTriage] = useState<TriageEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [readAt, setReadAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const scope = squadId || null;
      const [b, st, o, t] = await Promise.all([
        getGateBoard(scope),
        getTestStatus(scope),
        listObservations(scope),
        listTriage(),
      ]);
      setBoard(b);
      setStatus(st);
      setObservations(o);
      setTriage(t);
      setReadAt(new Date());
    } catch (e) {
      setError(dataErrorMessage(e, "Something went wrong. Retry."));
    } finally {
      setLoading(false);
    }
  }, [squadId]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    getSquadsForValidation()
      .then(setSquads)
      .catch((e) => setError(dataErrorMessage(e, "Couldn't load squads. Retry.")))
      .finally(() => void load());
  }, [user, load]);

  if (!user) {
    return (
      <div className="mx-auto max-w-reading space-y-3 py-6">
        <h1 className="type-display-md text-text-primary">Quality gates</h1>
        <p className="text-sm leading-6 text-text-secondary">
          Step 27&apos;s gates are read from the database, so this needs an account.{" "}
          <Link href="/login" className="text-text-primary underline decoration-hairline-strong underline-offset-4 hover:decoration-text-primary">
            Sign in
          </Link>
          .
        </p>
      </div>
    );
  }

  // First read shows the loader; a refresh keeps the board on screen.
  const firstLoad = loading && !board;

  return (
    <div className="space-y-8 pb-8 md:space-y-10 md:pb-12">
      <header className="flex flex-col gap-3 border-b border-hairline pb-4 md:flex-row md:items-end md:justify-between md:gap-6">
        <div className="min-w-0 space-y-1">
          <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.02em] text-text-primary md:text-[32px]">
            Quality gates
          </h1>
          <p className="text-sm leading-6 text-text-secondary">
            Live quality gates, observations, triage, and review — read from the database.
          </p>
          <p className="text-xs leading-5 text-text-tertiary">
            These gates do not replace two weeks with real squads. They make the answers that
            period produces checkable instead of remembered.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 md:pb-1">
          {readAt && (
            <span className="font-mono text-xs text-text-tertiary tnum">
              Read{" "}
              {readAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            aria-label="Read the gates again"
            title="Read the gates again"
            className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface hover:text-text-primary disabled:cursor-wait md:h-8 md:w-8"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} strokeWidth={1.5} />
          </button>
        </div>
      </header>

      <div className="flex flex-col gap-3 md:flex-row md:items-start">
        <ScopePicker squads={squads} value={squadId} onChange={setSquadId} />
        <div className="min-w-0 flex-1">
          <StatusBanner status={status} />
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-lg border border-error/30 bg-error-tint p-3 text-sm text-error"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void load()}
            className="min-h-[44px] shrink-0 cursor-pointer text-xs font-medium underline underline-offset-2 hover:text-text-primary md:min-h-0"
          >
            Retry
          </button>
        </div>
      )}

      {firstLoad ? (
        <PageLoader label="Reading the gates…" />
      ) : (
        <>
          <GateSection board={board} />
          <ReviewSection board={board} />
          <div className="grid items-start gap-6 lg:grid-cols-2 lg:gap-8">
            <ObservationSection
              observations={observations}
              squads={squads}
              squadId={squadId}
              onSaved={load}
            />
            <TriageSection triage={triage} onChanged={load} />
          </div>
        </>
      )}
    </div>
  );
}

function StatusBanner({ status }: { status: TestStatus | null }) {
  if (!status) return null;
  const rehearsal = !status.started && status.members > 0;
  return (
    <p
      role="status"
      className={cn(
        "flex items-start gap-2.5 rounded-lg border p-3 text-sm leading-6",
        rehearsal
          ? "border-hairline-strong bg-surface-raised text-text-primary"
          : "border-hairline bg-surface text-text-secondary"
      )}
    >
      {rehearsal && (
        <TriangleAlert className="mt-1 h-4 w-4 shrink-0 text-text-secondary" strokeWidth={1.5} aria-hidden />
      )}
      <span>{status.sentence}</span>
    </p>
  );
}

// ── §76 ──────────────────────────────────────────────────────────────────────

function ReviewSection({ board }: { board: GateBoard | null }) {
  if (!board) return null;
  const verdictFor = (gate: ReviewQuestionGate): GateVerdict => {
    if (gate === "qualitative") return "unknown";
    return board.gates.find((g) => g.id === gate)?.verdict ?? "unknown";
  };

  return (
    <section aria-labelledby="review-h" className="max-w-[760px] space-y-3">
      <h2 id="review-h" className={sectionLabelCls}>
        §76 — what this iteration has to answer
      </h2>
      <ul className={cn(cardCls, "divide-y divide-hairline overflow-hidden")}>
        {REVIEW_QUESTIONS.map((q) => {
          const v = verdictFor(q.gate);
          return (
            <li key={q.id} className="flex items-start justify-between gap-3 p-4 transition-colors hover:bg-surface-raised">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text-primary">{q.question}</p>
                <p className="mt-0.5 text-xs leading-5 text-text-tertiary">{q.note}</p>
              </div>
              <VerdictBadge verdict={v} />
            </li>
          );
        })}
      </ul>
      <p className="flex items-start gap-2 text-xs leading-5 text-text-tertiary">
        <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden />
        {REVIEW_RULE}
      </p>
    </section>
  );
}

type ReviewQuestionGate = (typeof REVIEW_QUESTIONS)[number]["gate"];

// ── §58 ──────────────────────────────────────────────────────────────────────

function GateSection({ board }: { board: GateBoard | null }) {
  if (!board) return null;

  return (
    <section aria-labelledby="gates-h" className="max-w-[760px] space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="gates-h" className={sectionLabelCls}>
          §58 — gates
        </h2>
        {!board.empty && (
          <p className="font-mono text-xs text-text-tertiary tnum">
            {board.passed} pass · {board.failed} fail · {board.unknown} no data
          </p>
        )}
      </div>

      {board.empty && (
        <div className={cn(cardCls, "flex items-start gap-3 p-4")}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hairline bg-well text-text-tertiary">
            <CircleHelp className="h-4 w-4" strokeWidth={1.5} aria-hidden />
          </span>
          <p className="text-sm leading-6 text-text-secondary">
            No squad has members yet, so there is nothing to measure. This is the honest
            &ldquo;not started&rdquo; state — it is deliberately not showing five failures.
          </p>
        </div>
      )}

      <ul className={cn(cardCls, "divide-y divide-hairline overflow-hidden")}>
        {board.gates.map((g) => (
          <GateCard key={g.id} gate={g} />
        ))}

        {/* The qualitative gate, carried explicitly so its absence from the
            numbers is a decision rather than an oversight. */}
        <li className="bg-well/40 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text-primary">{board.qualitative.label}</p>
              <p className="mt-0.5 text-xs leading-5 text-text-secondary">{board.qualitative.question}</p>
            </div>
            <span className="inline-flex h-7 shrink-0 items-center whitespace-nowrap rounded-xs border border-dashed border-hairline-strong px-2.5 text-xs font-medium text-text-tertiary">
              Human only
            </span>
          </div>
          <p className="mt-2 text-xs leading-5 text-text-tertiary">{board.qualitative.reason}</p>
        </li>
      </ul>
    </section>
  );
}

function GateCard({ gate }: { gate: Gate }) {
  return (
    <li className="p-4 transition-colors hover:bg-surface-raised">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text-primary">{gate.label}</p>
          <p className="mt-0.5 text-xs leading-5 text-text-secondary">{gate.question}</p>
        </div>
        <div className="flex shrink-0 items-start gap-6">
          <p
            className={cn(
              "hidden max-w-[260px] pt-1 text-right font-mono text-sm font-medium md:block",
              gate.measured ? "text-text-primary" : "text-text-tertiary"
            )}
          >
            {gate.measured ?? "—"}
          </p>
          <VerdictBadge verdict={gate.verdict} />
        </div>
      </div>
      <p
        className={cn(
          "mt-2 font-mono text-sm font-medium md:hidden",
          gate.measured ? "text-text-primary" : "text-text-tertiary"
        )}
      >
        {gate.measured ?? "—"}
      </p>
      <p className="mt-2 text-xs leading-5 text-text-tertiary">{gate.cannotTell}</p>
    </li>
  );
}

// ── §59 ──────────────────────────────────────────────────────────────────────

function ObservationSection({
  observations,
  squads,
  squadId,
  onSaved,
}: {
  observations: Observation[];
  squads: SquadOption[];
  squadId: string;
  onSaved: () => Promise<void>;
}) {
  const [category, setCategory] = useState<ObservationCategory>("hesitation");
  const [text, setText] = useState("");
  const [day, setDay] = useState<string>("");
  const [target, setTarget] = useState<string>(squadId);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => setTarget(squadId), [squadId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    setErr(null);
    try {
      await recordObservation({
        squad_id: target || null,
        day_number: day ? Number(day) : null,
        category,
        observation: text,
      });
      setText("");
      setMsg("Recorded.");
      await onSaved();
    } catch (e2) {
      setErr(dataErrorMessage(e2, "Something went wrong. Retry."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby="obs-h" className={cn(cardCls, "space-y-5 p-4 md:p-6")}>
      <CardHeader
        id="obs-h"
        title="Log an observation"
        description="§59 — what the test depends on. Where people stall, what they ignore, what they ask for."
        tag="§59"
      />

      <ul className="grid grid-cols-2 gap-2">
        {OBSERVATION_DAYS.map((d) => (
          <li key={d.day} className="rounded-lg border border-hairline bg-well p-2.5">
            <p className="font-mono text-[11px] font-medium text-text-tertiary">Day {d.day}</p>
            <p className="mt-0.5 text-xs leading-5 text-text-secondary">{d.question}</p>
          </li>
        ))}
      </ul>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <span id="obs-kind" className="mb-1.5 block text-xs font-medium text-text-secondary">
            Kind
          </span>
          <div
            role="radiogroup"
            aria-labelledby="obs-kind"
            className="grid grid-cols-3 gap-1 rounded-md border border-hairline bg-well p-1"
          >
            {OBSERVATION_CATEGORIES.map((c) => {
              const on = category === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setCategory(c.id)}
                  className={cn(
                    "min-h-[44px] cursor-pointer rounded-xs px-2 py-1.5 text-xs font-medium transition-colors md:min-h-0",
                    on
                      ? "bg-surface-overlay text-text-primary shadow-sm"
                      : "text-text-secondary hover:text-text-primary"
                  )}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[11px] leading-4 text-text-tertiary">
            {OBSERVATION_CATEGORIES.find((c) => c.id === category)?.hint}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField id="obs-day" label="Day" value={day} onChange={setDay}>
            <option value="">—</option>
            {OBSERVATION_DAYS.map((d) => (
              <option key={d.day} value={d.day}>
                Day {d.day}
              </option>
            ))}
          </SelectField>
          <SelectField id="obs-squad" label="Squad" value={target} onChange={setTarget}>
            <option value="">Product-level</option>
            {squads.map((s) => (
              <option key={s.squad_id} value={s.squad_id}>
                {s.name}
              </option>
            ))}
          </SelectField>
        </div>

        <div>
          <label htmlFor="obs-text" className="mb-1.5 block text-xs font-medium text-text-secondary">
            What happened
          </label>
          <textarea
            id="obs-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Where they stalled, what they ignored, what they asked for twice…"
            className={cn(inputCls, "resize-none py-2.5")}
          />
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-mono text-[11px] text-text-tertiary">Appends to the §59 log</span>
          <button type="submit" disabled={saving || text.trim().length === 0} className={secondaryBtn}>
            {saving ? "Saving…" : "Record observation"}
          </button>
        </div>
        {msg && (
          <p role="status" className="text-xs text-text-secondary">
            {msg}
          </p>
        )}
        {err && (
          <p role="alert" className="text-xs text-error">
            {err}
          </p>
        )}
      </form>

      <div className="space-y-2.5 border-t border-hairline pt-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-text-secondary">Recent observations</span>
          <span className="font-mono text-[11px] text-text-tertiary tnum">
            {observations.length} recorded
          </span>
        </div>
        {observations.length === 0 ? (
          <p className="rounded-lg border border-hairline bg-well p-3 text-xs leading-5 text-text-tertiary">
            Nothing recorded yet. §59 exists because user behaviour outranks founder
            imagination, and nothing has been observed yet.
          </p>
        ) : (
          <ul className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
            {observations.map((o) => {
              const cat = OBSERVATION_CATEGORIES.find((c) => c.id === o.category);
              return (
                <li key={o.id} className="space-y-1 rounded-lg border border-hairline bg-well p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-xs border px-1.5 py-0.5 text-[10px] font-medium",
                        o.category === "blocker"
                          ? "border-error/20 bg-error-tint text-error"
                          : "border-hairline bg-surface-overlay text-text-secondary"
                      )}
                    >
                      {cat?.label ?? o.category}
                    </span>
                    <span className="flex items-center gap-2 font-mono text-[10px] text-text-tertiary tnum">
                      {o.day_number && <span>Day {o.day_number}</span>}
                      <time dateTime={o.created_at}>
                        {new Date(o.created_at).toLocaleDateString()}
                      </time>
                    </span>
                  </div>
                  <p className="text-xs leading-5 text-text-secondary">{o.observation}</p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

// ── §60 ──────────────────────────────────────────────────────────────────────

function TriageSection({
  triage,
  onChanged,
}: {
  triage: TriageEntry[];
  onChanged: () => Promise<void>;
}) {
  const [feature, setFeature] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await addTriageFeature(feature);
      setFeature("");
      await onChanged();
    } catch (e2) {
      setErr(dataErrorMessage(e2, "Something went wrong. Retry."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="triage-h" className={cn(cardCls, "space-y-5 p-4 md:p-6")}>
      <CardHeader
        id="triage-h"
        title="Feature triage"
        description="§60 — every feature gets a label and nine fields."
        tag="§60"
      />
      <div className="space-y-2">
        <p className="text-xs leading-5 text-text-secondary">
          A decision that lives in a wiki gets re-litigated in a meeting instead of being
          read. CORE strengthens the loop · SUPPORT is infrastructure · EXPERIMENT is worth
          testing · FUTURE waits for core validation · KILL adds cost without user value ·
          DUPLICATE is already solved.
        </p>
        <p className="text-[11px] leading-4 text-text-tertiary">
          Anyone signed in can propose a feature. Assigning the label and the nine fields is
          admin-only, and the save will tell you so rather than appearing to work — a label is
          a commitment, and it is kept in the database so it cannot be skipped around the app.
        </p>
      </div>

      <form onSubmit={add} className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <label htmlFor="triage-new" className="mb-1.5 block text-xs font-medium text-text-secondary">
            Add a proposed feature
          </label>
          <input
            id="triage-new"
            value={feature}
            onChange={(e) => setFeature(e.target.value)}
            maxLength={120}
            className={cn(inputCls, "h-11 md:h-10")}
          />
        </div>
        <button type="submit" disabled={busy || feature.trim().length === 0} className={secondaryBtn}>
          <Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden />
          {busy ? "Adding…" : "Add"}
        </button>
      </form>
      {err && (
        <p role="alert" className="text-xs text-error">
          {err}
        </p>
      )}

      {triage.length === 0 ? (
        <p className="rounded-lg border border-hairline bg-well p-3 text-xs leading-5 text-text-tertiary">
          The queue is empty. §60 applies to every proposed feature, so an empty queue
          means nothing is currently being argued about.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {triage.map((entry) => (
            <TriageRow key={entry.feature} entry={entry} onChanged={onChanged} />
          ))}
        </ul>
      )}
    </section>
  );
}

function TriageRow({
  entry,
  onChanged,
}: {
  entry: TriageEntry;
  onChanged: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<TriageEntry>(entry);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const completeness = triageCompleteness(draft);

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      await decideTriage(draft);
      await onChanged();
    } catch (e) {
      setErr(dataErrorMessage(e, "Something went wrong. Retry."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="space-y-3 rounded-lg border border-hairline bg-well p-3.5 transition-colors hover:border-hairline-strong">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-text-primary">{entry.feature}</p>
          <p className="mt-0.5 text-xs leading-5 text-text-tertiary">
            {draft.label ? TRIAGE_LABELS[draft.label] : "No label yet."}
          </p>
        </div>
        <label className="relative shrink-0">
          <span className="sr-only">Label for {entry.feature}</span>
          <select
            value={draft.label ?? ""}
            onChange={(e) =>
              setDraft({ ...draft, label: (e.target.value || null) as TriageLabel | null })
            }
            className="h-11 cursor-pointer appearance-none rounded-md border border-hairline bg-surface-raised pl-2.5 pr-7 text-xs font-medium text-text-primary transition-colors focus:border-hairline-strong focus:outline-none md:h-8"
          >
            <option value="">undecided</option>
            {(Object.keys(TRIAGE_LABELS) as TriageLabel[]).map((l) => (
              <option key={l} value={l} title={TRIAGE_LABELS[l]}>
                {l}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary"
            strokeWidth={1.5}
            aria-hidden
          />
        </label>
      </div>

      <details className="group">
        <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-text-primary md:min-h-0 [&::-webkit-details-marker]:hidden">
          <ChevronDown
            className="h-3.5 w-3.5 -rotate-90 transition-transform group-open:rotate-0"
            strokeWidth={1.5}
            aria-hidden
          />
          Fields
          <span className={cn("font-mono tnum", completeness.ready ? "text-text-primary" : "text-text-tertiary")}>
            {completeness.filled}/{completeness.total}
          </span>
        </summary>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {TRIAGE_FIELDS.map((f) => (
            <label key={f} className="block text-xs">
              <span className="text-text-secondary">{f}</span>
              <input
                value={(draft as unknown as Record<string, string | null>)[fieldKey(f)] ?? ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    [fieldKey(f)]: e.target.value || null,
                  } as unknown as TriageEntry)
                }
                className={cn(inputCls, "mt-1 h-11 bg-surface text-xs md:h-8")}
              />
            </label>
          ))}
        </div>
      </details>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex h-11 cursor-pointer items-center rounded-md border border-hairline px-3 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary disabled:cursor-wait md:h-8"
        >
          {saving ? "Saving…" : "Save decision"}
        </button>
        {err && <span role="alert" className="text-xs text-error">{err}</span>}
      </div>
    </li>
  );
}

const FIELD_KEYS: Record<(typeof TRIAGE_FIELDS)[number], keyof TriageEntry> = {
  Problem: "problem",
  User: "target_user",
  Behavior: "behaviour",
  "Core-loop link": "core_loop_link",
  Alternative: "alternative",
  Cost: "cost",
  Risk: "risk",
  "Success metric": "success_metric",
  Decision: "decision",
};

function fieldKey(field: (typeof TRIAGE_FIELDS)[number]): keyof TriageEntry {
  return FIELD_KEYS[field];
}

function ScopePicker({
  squads,
  value,
  onChange,
}: {
  squads: SquadOption[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative shrink-0 md:w-[240px]">
      <Users
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary"
        strokeWidth={1.5}
        aria-hidden
      />
      <label className="sr-only" htmlFor="scope">
        Which squads to read
      </label>
      <select
        id="scope"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(selectCls, "pl-9")}
      >
        <option value="">All squads</option>
        {squads.map((s) => (
          <option key={s.squad_id} value={s.squad_id}>
            {s.name}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary"
        strokeWidth={1.5}
        aria-hidden
      />
    </div>
  );
}
