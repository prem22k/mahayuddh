"use client";

import React, { useState } from "react";
import { Code, Eye, EyeOff } from "lucide-react";
import { CodeBlock } from "@/components/approach/CodeBlock";

/**
 * Stitch reveal-code panel. With `spoiler` the code stays collapsed until the
 * reader opts in (Bible §12: learning is not short-circuited by a peek); the
 * public projection passes spoiler={false} because a shared approach is meant
 * to be read.
 */
export function ApproachCode({
  code,
  spoiler,
  unattempted = false,
}: {
  code: string;
  spoiler: boolean;
  /** Reader has no status row for this problem: say so beside the spoiler. */
  unattempted?: boolean;
}) {
  const [revealed, setRevealed] = useState(!spoiler);
  const lines = code.split("\n").length;

  return (
    <section aria-label="Code" className="overflow-hidden rounded-xl border border-hairline bg-well">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface/40 p-3 md:p-4">
        <span className="inline-flex items-center gap-1.5 rounded-xs border border-hairline bg-well px-2 py-0.5 font-mono text-xs font-medium leading-4 text-text-secondary tnum">
          <Code className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
          Code · {lines} {lines === 1 ? "line" : "lines"}
        </span>
        {spoiler && (
          <button
            type="button"
            aria-expanded={revealed}
            onClick={() => setRevealed((r) => !r)}
            className="inline-flex h-8 min-h-[44px] items-center gap-1.5 rounded-md border border-hairline bg-surface-overlay px-3 text-sm font-medium leading-5 text-text-primary transition-colors hover:bg-surface-raised md:min-h-0"
          >
            {revealed ? (
              <EyeOff className="h-4 w-4" strokeWidth={1.5} aria-hidden />
            ) : (
              <Eye className="h-4 w-4" strokeWidth={1.5} aria-hidden />
            )}
            {revealed ? "Hide code" : "Reveal code"}
          </button>
        )}
      </div>
      {revealed ? (
        <CodeBlock
          code={code}
          label="solution"
          copyLabel="Copy code"
          className="rounded-none border-0 border-t border-hairline"
        />
      ) : (
        <p className="border-t border-hairline px-3 py-3 text-sm leading-6 text-text-tertiary md:px-4">
          Hidden so you solve it first. Read it after your own attempt.
          {unattempted && " You have not attempted this yet."}
        </p>
      )}
    </section>
  );
}
