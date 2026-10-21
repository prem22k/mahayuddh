"use client";

import React, { useState } from "react";
import { Check, Copy } from "lucide-react";
import { copyText } from "@/lib/clipboard";
import { cn } from "@/lib/utils";

/**
 * Stitch code artifact: a well-colored block with a hairline header bar
 * (file label left, Copy right) and the code in JetBrains Mono 14/22.
 *
 * Monochrome on purpose. The frames tint keywords gold/emerald/indigo, but
 * those hues carry meaning here (action, proof, knowledge), so code stays
 * text-primary and only whole-line comments are quieted.
 */
export function CodeBlock({
  code,
  label,
  lineNumbers = true,
  copyLabel = "Copy",
  onCopied,
  className,
}: {
  code: string;
  /** Header text on the left, e.g. "template" or "solution". */
  label?: React.ReactNode;
  lineNumbers?: boolean;
  copyLabel?: string;
  onCopied?: () => void;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const lines = code.replace(/\n$/, "").split("\n");

  return (
    <div className={cn("overflow-hidden rounded-lg border border-hairline bg-well", className)}>
      <div className="flex min-h-[44px] items-center justify-between gap-3 border-b border-hairline bg-surface pl-4 pr-2 md:min-h-10">
        <span className="min-w-0 truncate font-mono text-xs font-medium leading-4 text-text-secondary">
          {label}
        </span>
        <button
          type="button"
          onClick={async () => {
            if (await copyText(code)) {
              setCopied(true);
              onCopied?.();
              setTimeout(() => setCopied(false), 2000);
            }
          }}
          className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-sm px-2 font-mono text-xs font-medium leading-4 text-text-tertiary transition-colors hover:bg-surface-raised hover:text-text-primary md:min-h-8"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-verified" strokeWidth={1.5} />
          ) : (
            <Copy className="h-3.5 w-3.5" strokeWidth={1.5} />
          )}
          {copied ? "Copied" : copyLabel}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-sm leading-[22px] text-text-primary">
        <code className="block min-w-fit">
          {lines.map((line, i) => {
            const comment = /^\s*(#|\/\/)/.test(line);
            return (
              <span key={i} className="flex">
                {lineNumbers && (
                  <span
                    aria-hidden
                    className="w-8 shrink-0 select-none pr-4 text-right text-xs leading-[22px] text-text-tertiary tnum"
                  >
                    {i + 1}
                  </span>
                )}
                <span className={cn("whitespace-pre", comment && "text-text-tertiary")}>
                  {line || " "}
                </span>
              </span>
            );
          })}
        </code>
      </pre>
    </div>
  );
}
