"use client";

import React from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { PassField } from "@/components/pass/Pass";

/**
 * Live preview of the pass the recipient will get, beside the composer. A
 * compact landscape pass on every size (the phone sheet keeps the stub on the
 * right, as in the frame). Every field mirrors the form; nothing is sample data.
 */
export function ChallengePassPreview({
  fromHandle,
  toHandle,
  title,
  number,
  difficulty,
  beat,
  note,
  noteHidden,
  dueStub,
}: {
  /** `@demo_prem`, or null when the sender's profile hasn't loaded. */
  fromHandle: string | null;
  toHandle: string | null;
  title: string;
  number: string | null;
  difficulty: string;
  /** `16:05` when there is a time to beat. */
  beat: string | null;
  note: string;
  noteHidden: boolean;
  /** `19 OCT`, or null for no deadline. */
  dueStub: string | null;
}) {
  return (
    <div
      role="group"
      aria-label="Preview of the challenge pass they will get"
      className="relative flex overflow-hidden rounded-lg border border-hairline-strong bg-surface"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2 border-b border-hairline pb-2">
          <span className="min-w-0 break-words text-xs font-medium leading-4 text-text-primary">
            {fromHandle ?? "A squad mate"} challenged you
          </span>
          <span className="shrink-0 font-mono text-[10px] font-medium uppercase leading-4 tracking-[0.06em] text-text-disabled">
            1v1
          </span>
        </div>

        <div>
          <p
            className={cn(
              "break-words font-display text-[19px] font-semibold leading-snug tracking-[-0.015em]",
              title ? "text-text-primary" : "text-text-disabled"
            )}
          >
            {title || "Pick a problem"}
          </p>
          <p className="mt-1 font-mono text-[11px] font-medium leading-4 tracking-[0.04em] text-text-secondary tnum">
            {[number ? `No. ${number}` : null, difficulty].filter(Boolean).join(" · ")}
          </p>
        </div>

        <div className="flex flex-col items-center rounded-md border border-hairline bg-well px-2.5 py-3 text-center">
          <span className="font-mono text-[10px] font-medium uppercase leading-4 tracking-[0.1em] text-text-tertiary">
            Target objective
          </span>
          <span className="mt-1 font-mono text-[26px] font-semibold uppercase leading-[1.1] tracking-[-0.02em] text-text-primary tnum md:text-[28px]">
            {beat ? `Beat ${beat}` : "Solve it"}
          </span>
        </div>

        {noteHidden ? (
          <p className="flex items-center gap-1.5 rounded-sm border border-hairline bg-well/70 px-2.5 py-2 text-xs leading-4 text-text-tertiary">
            <Lock className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden />
            A note is hidden until you finish.
          </p>
        ) : note ? (
          <p className="break-words rounded-sm border border-hairline bg-well/70 px-2.5 py-2 text-xs italic leading-4 text-text-secondary">
            &ldquo;{note}&rdquo;
          </p>
        ) : null}

        {/* What the recipient's buttons will read; not interactive here. */}
        <div aria-hidden className="hidden gap-2 border-t border-hairline pt-3 md:flex">
          <span className="flex-1 rounded-sm border border-hairline bg-surface-overlay px-2 py-1.5 text-center text-xs font-medium text-text-primary">
            Accept
          </span>
          <span className="rounded-sm border border-hairline px-2 py-1.5 text-center text-xs text-text-secondary">
            Pass it on
          </span>
        </div>
      </div>

      <div className="relative flex w-[116px] shrink-0 flex-col justify-between gap-3 border-l border-dashed border-hairline-strong bg-surface-raised p-3">
        {/* Perforation notches, cut to the modal's own surface. */}
        <span aria-hidden className="absolute -left-2 -top-2 h-4 w-4 rounded-full border border-hairline-strong bg-surface-raised" />
        <span aria-hidden className="absolute -bottom-2 -left-2 h-4 w-4 rounded-full border border-hairline-strong bg-surface-raised" />
        {/* Handles wrap rather than truncate: the stub is narrow and @names are not. */}
        <div className="flex flex-col gap-2.5 pt-1 [&_span:last-child]:whitespace-normal [&_span:last-child]:break-all">
          <PassField label="From">{fromHandle ?? "You"}</PassField>
          <PassField label="To">{toHandle ?? "—"}</PassField>
          <PassField label="Due">{dueStub ?? "None"}</PassField>
        </div>
        <PassField label="Status" className="border-t border-hairline pt-2.5">
          Open
        </PassField>
      </div>
    </div>
  );
}
