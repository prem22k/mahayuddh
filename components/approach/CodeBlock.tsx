"use client";

import React, { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import hljs from "highlight.js/lib/core";
import cpp from "highlight.js/lib/languages/cpp";
import java from "highlight.js/lib/languages/java";
import python from "highlight.js/lib/languages/python";
import { copyText } from "@/lib/clipboard";
import { cn } from "@/lib/utils";

hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("java", java);
hljs.registerLanguage("python", python);

export type CodeLanguage = "cpp" | "java" | "python";

/**
 * highlight.js returns one HTML string; a token can span lines (a block
 * comment, a docstring). Split it into lines and re-open whatever spans were
 * open, so every line is valid HTML and keeps its colour.
 */
function highlightLines(code: string, language: CodeLanguage): string[] {
  const html = hljs.highlight(code, { language, ignoreIllegals: true }).value;
  const lines: string[] = [];
  const open: string[] = [];
  let line = "";
  for (const part of html.split(/(<span[^>]*>|<\/span>|\n)/)) {
    if (part === "\n") {
      lines.push(line + "</span>".repeat(open.length));
      line = open.join("");
    } else {
      if (part.startsWith("<span")) open.push(part);
      else if (part === "</span>") open.pop();
      line += part;
    }
  }
  lines.push(line);
  return lines;
}

/**
 * Stitch code artifact: a well-colored block with a hairline header bar
 * (file label left, Copy right) and the code in JetBrains Mono 14/22.
 *
 * With a `language`, code is syntax-coloured from the --color-code-* tokens:
 * soft pastels chosen to stay clear of gold/emerald/indigo, which carry
 * meaning here (action, proof, knowledge). Without one it stays monochrome
 * and only whole-line comments are quieted.
 */
export function CodeBlock({
  code,
  label,
  lineNumbers = true,
  copyLabel = "Copy",
  onCopied,
  className,
  language,
}: {
  code: string;
  /** Colour the code for this language; omit for plain text. */
  language?: CodeLanguage;
  /** Header text on the left, e.g. "template" or "solution". */
  label?: React.ReactNode;
  lineNumbers?: boolean;
  copyLabel?: string;
  onCopied?: () => void;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const lines = code.replace(/\n$/, "").split("\n");
  // highlight.js escapes the code it's given, so its spans are safe to inject.
  const colored = useMemo(
    () => (language ? highlightLines(code.replace(/\n$/, ""), language) : null),
    [code, language]
  );

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
      <pre className={cn("overflow-x-auto p-4 font-mono text-sm leading-[22px] text-text-primary", colored && "code-hl")}>
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
                {colored ? (
                  <span className="whitespace-pre" dangerouslySetInnerHTML={{ __html: colored[i] || " " }} />
                ) : (
                  <span className={cn("whitespace-pre", comment && "text-text-tertiary")}>
                    {line || " "}
                  </span>
                )}
              </span>
            );
          })}
        </code>
      </pre>
    </div>
  );
}
