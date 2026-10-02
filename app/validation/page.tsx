"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AlertTriangle, Check, X, HelpCircle, Plus, Users } from "lucide-react";
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

const VERDICT_STYLE: Record<GateVerdict, { cls: string; Icon: typeof Check; word: string }> = {
  pass: { cls: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10", Icon: Check, word: "pass" },
  fail: { cls: "text-rose-400 border-rose-500/40 bg-rose-500/10", Icon: X, word: "fail" },
  unknown: { cls: "text-slate-400 border-slate-600/60 bg-slate-800/40", Icon: HelpCircle, word: "no data" },
};

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
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-xl font-semibold">Validation</h1>
        <p className="mt-3 text-slate-400">
          Step 27&apos;s gates are read from the database, so this needs an account.{" "}
          <Link href="/login" className="text-indigo-400 underline">
            Sign in
          </Link>
          .
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl space-y-10 px-4 py-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Validation</h1>
        <p className="text-sm text-slate-400">
          Step 27 · Bible §58 gates, §59 observations, §60 triage, §76 review.
        </p>
        <p className="text-sm text-slate-500">
          These gates do not replace two weeks with real squads. They make the answers that
          period produces checkable instead of remembered.
        </p>
      </header>

      <ScopePicker squads={squads} value={squadId} onChange={setSquadId} />

      {error && (
        <p role="alert" className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-300">
          {error}
        </p>
      )}

      {loading ? (
        <PageLoader label="Reading the gates…" />
      ) : (
        <>
          <StatusBanner status={status} />
          <ReviewSection board={board} />
          <GateSection board={board} />
          <ObservationSection
            observations={observations}
            squads={squads}
            squadId={squadId}
            onSaved={load}
          />
          <TriageSection triage={triage} onChanged={load} />
        </>
      )}
    </main>
  );
}

function StatusBanner({ status }: { status: TestStatus | null }) {
  if (!status) return null;
  const rehearsal = !status.started && status.members > 0;
  return (
    <p
      role="status"
      className={cn(
        "rounded-xl border p-4 text-sm",
        rehearsal
          ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
          : "border-slate-800 bg-slate-900/40 text-slate-400"
      )}
    >
      {status.sentence}
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
    <section aria-labelledby="review-h" className="space-y-3">
      <h2 id="review-h" className="text-lg font-semibold">
        §76 — what this iteration has to answer
      </h2>
      <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800">
        {REVIEW_QUESTIONS.map((q) => {
          const v = verdictFor(q.gate);
          const style = VERDICT_STYLE[v];
          return (
            <li key={q.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{q.question}</p>
                <p className="mt-1 text-xs text-slate-500">{q.note}</p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                  style.cls
                )}
              >
                {style.word}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="flex items-start gap-2 text-xs text-slate-500">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
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
    <section aria-labelledby="gates-h" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="gates-h" className="text-lg font-semibold">
          §58 — gates
        </h2>
        {!board.empty && (
          <p className="text-xs text-slate-500">
            {board.passed} pass · {board.failed} fail · {board.unknown} no data
          </p>
        )}
      </div>

      {board.empty && (
        <p className="rounded-xl border border-slate-700 bg-slate-800/40 p-4 text-sm text-slate-300">
          No squad has members yet, so there is nothing to measure. This is the honest
          &ldquo;not started&rdquo; state — it is deliberately not showing five failures.
        </p>
      )}

      <ul className="space-y-3">
        {board.gates.map((g) => (
          <GateCard key={g.id} gate={g} />
        ))}

        {/* The qualitative gate, carried explicitly so its absence from the
            numbers is a decision rather than an oversight. */}
        <li className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{board.qualitative.label}</p>
              <p className="mt-1 text-sm text-slate-400">{board.qualitative.question}</p>
            </div>
            <span className="shrink-0 rounded-full border border-slate-600/60 bg-slate-800/40 px-2.5 py-0.5 text-xs font-medium text-slate-400">
              human only
            </span>
          </div>
          <p className="mt-3 text-xs text-slate-500">{board.qualitative.reason}</p>
        </li>
      </ul>
    </section>
  );
}

function GateCard({ gate }: { gate: Gate }) {
  const style = VERDICT_STYLE[gate.verdict];
  return (
    <li className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{gate.label}</p>
          <p className="mt-1 text-sm text-slate-400">{gate.question}</p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium",
            style.cls
          )}
        >
          {style.word}
        </span>
      </div>
      {gate.measured && (
        <p className="mt-3 text-sm text-slate-200">{gate.measured}</p>
      )}
      <p className="mt-2 text-xs leading-relaxed text-slate-500">{gate.cannotTell}</p>
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
    <section aria-labelledby="obs-h" className="space-y-4">
      <h2 id="obs-h" className="text-lg font-semibold">
        §59 — what the test depends on
      </h2>

      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {OBSERVATION_DAYS.map((d) => (
          <li key={d.day} className="rounded-lg border border-slate-800 p-3">
            <p className="text-xs font-medium text-slate-400">Day {d.day}</p>
            <p className="mt-1 text-sm">{d.question}</p>
          </li>
        ))}
      </ul>

      <form onSubmit={submit} className="space-y-3 rounded-xl border border-slate-800 p-4">
        <label className="block text-sm">
          <span className="text-slate-400">What happened</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Where they stalled, what they ignored, what they asked for twice…"
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-sm"
          />
        </label>

        <div className="flex flex-wrap gap-3">
          <label className="block text-sm">
            <span className="text-slate-400">Category</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ObservationCategory)}
              className="mt-1 block rounded-lg border border-slate-700 bg-slate-900 p-2 text-sm"
            >
              {OBSERVATION_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="text-slate-400">Day</span>
            <select
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className="mt-1 block rounded-lg border border-slate-700 bg-slate-900 p-2 text-sm"
            >
              <option value="">—</option>
              {OBSERVATION_DAYS.map((d) => (
                <option key={d.day} value={d.day}>
                  Day {d.day}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="text-slate-400">Squad</span>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="mt-1 block rounded-lg border border-slate-700 bg-slate-900 p-2 text-sm"
            >
              <option value="">Product-level</option>
              {squads.map((s) => (
                <option key={s.squad_id} value={s.squad_id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="text-xs text-slate-500">
          {OBSERVATION_CATEGORIES.find((c) => c.id === category)?.hint}
        </p>

        <button
          type="submit"
          disabled={saving || text.trim().length === 0}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          {saving ? "Saving…" : "Record observation"}
        </button>
        {msg && <p className="text-sm text-emerald-400">{msg}</p>}
        {err && <p role="alert" className="text-sm text-rose-400">{err}</p>}
      </form>

      <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800">
        {observations.length === 0 ? (
          <li className="p-4 text-sm text-slate-500">
            Nothing recorded yet. §59 exists because user behaviour outranks founder
            imagination, and nothing has been observed yet.
          </li>
        ) : (
          observations.map((o) => {
            const cat = OBSERVATION_CATEGORIES.find((c) => c.id === o.category);
            return (
              <li key={o.id} className="p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="rounded-full border border-slate-700 px-2 py-0.5">
                    {cat?.label ?? o.category}
                  </span>
                  {o.day_number && <span>Day {o.day_number}</span>}
                  <time dateTime={o.created_at}>
                    {new Date(o.created_at).toLocaleDateString()}
                  </time>
                </div>
                <p className="mt-2 text-sm">{o.observation}</p>
              </li>
            );
          })
        )}
      </ul>
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
    <section aria-labelledby="triage-h" className="space-y-4">
      <h2 id="triage-h" className="text-lg font-semibold">
        §60 — every feature gets a label and nine fields
      </h2>
      <p className="text-sm text-slate-400">
        A decision that lives in a wiki gets re-litigated in a meeting instead of being
        read. CORE strengthens the loop · SUPPORT is infrastructure · EXPERIMENT is worth
        testing · FUTURE waits for core validation · KILL adds cost without user value ·
        DUPLICATE is already solved.
      </p>
      <p className="text-xs text-slate-500">
        Anyone signed in can propose a feature. Assigning the label and the nine fields is
        admin-only, and the save will tell you so rather than appearing to work — a label is
        a commitment, and it is kept in the database so it cannot be skipped around the app.
      </p>

      <form onSubmit={add} className="flex flex-wrap items-end gap-3">
        <label className="block flex-1 text-sm">
          <span className="text-slate-400">Add a proposed feature</span>
          <input
            value={feature}
            onChange={(e) => setFeature(e.target.value)}
            maxLength={120}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={busy || feature.trim().length === 0}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          <Plus className="mr-1 inline h-3.5 w-3.5" aria-hidden />
          {busy ? "Adding…" : "Add"}
        </button>
      </form>
      {err && <p role="alert" className="text-sm text-rose-400">{err}</p>}

      {triage.length === 0 ? (
        <p className="rounded-xl border border-slate-800 p-4 text-sm text-slate-500">
          The queue is empty. §60 applies to every proposed feature, so an empty queue
          means nothing is currently being argued about.
        </p>
      ) : (
        <ul className="space-y-3">
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
    <li className="space-y-3 rounded-xl border border-slate-800 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="min-w-0 flex-1 text-sm font-medium">{entry.feature}</p>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-xs",
              completeness.ready ? "text-emerald-400" : "text-slate-500"
            )}
          >
            {completeness.filled}/{completeness.total}
          </span>
          <label className="text-xs">
            <span className="sr-only">Label for {entry.feature}</span>
            <select
              value={draft.label ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, label: (e.target.value || null) as TriageLabel | null })
              }
              className="rounded-lg border border-slate-700 bg-slate-900 p-1.5 text-xs"
            >
              <option value="">undecided</option>
              {(Object.keys(TRIAGE_LABELS) as TriageLabel[]).map((l) => (
                <option key={l} value={l} title={TRIAGE_LABELS[l]}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {draft.label && (
        <p className="text-xs text-slate-500">{TRIAGE_LABELS[draft.label]}</p>
      )}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {TRIAGE_FIELDS.map((f) => (
          <label key={f} className="block text-xs">
            <span className="text-slate-400">{f}</span>
            <input
              value={(draft as unknown as Record<string, string | null>)[fieldKey(f)] ?? ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  [fieldKey(f)]: e.target.value || null,
                } as unknown as TriageEntry)
              }
              className="mt-1 w-full rounded border border-slate-800 bg-slate-900 p-1.5"
            />
          </label>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg border border-slate-700 px-3 py-1 text-xs disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save decision"}
        </button>
        {err && <span className="text-xs text-rose-400">{err}</span>}
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
    <div className="flex items-center gap-2 text-sm">
      <Users className="h-4 w-4 text-slate-500" aria-hidden />
      <label className="sr-only" htmlFor="scope">
        Which squads to read
      </label>
      <select
        id="scope"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-slate-700 bg-slate-900 p-2 text-sm"
      >
        <option value="">All squads</option>
        {squads.map((s) => (
          <option key={s.squad_id} value={s.squad_id}>
            {s.name}
          </option>
        ))}
      </select>
    </div>
  );
}
