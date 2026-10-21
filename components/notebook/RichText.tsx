import React from "react";
import { CodeBlock } from "@/components/approach/CodeBlock";
import { cn } from "@/lib/utils";

/**
 * Inline markdown for knowledge surfaces: `code` spans and **bold** only.
 * Anything else renders as typed. No HTML is ever interpreted.
 */
export function InlineText({ text }: { text: string }) {
  const parts = text.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.length > 2 && part.startsWith("`") && part.endsWith("`")) {
          return (
            <code
              key={i}
              className="rounded-xs border border-hairline bg-well px-1.5 py-0.5 font-mono text-[13px] text-text-primary"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        if (part.length > 4 && part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-medium text-text-primary">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}

/**
 * Minimal markdown rendering for note bodies: paragraphs, bullets, headings,
 * code fences. Fences render as the Stitch code artifact with Copy.
 */
export function NoteBody({ md, className }: { md: string; className?: string }) {
  const parts = md.split("```");
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {parts.map((part, i) => {
        if (i % 2 === 1) {
          const lang = part.match(/^(\w+)\n/)?.[1] ?? null;
          const code = part.replace(/^\w*\n/, "").replace(/\n$/, "");
          return <CodeBlock key={i} code={code} label={lang ?? "snippet"} lineNumbers={false} />;
        }
        const blocks = part.split(/\n{2,}/);
        return (
          <React.Fragment key={i}>
            {blocks.map((block, j) => {
              const lines = block.split("\n").filter((l) => l.trim());
              if (lines.length === 0) return null;
              if (lines.every((l) => /^[-*]\s+/.test(l))) {
                return (
                  <ul key={j} className="flex flex-col gap-2.5 text-[15px] leading-6 text-text-secondary">
                    {lines.map((l, k) => (
                      <li key={k} className="flex items-start gap-2.5">
                        <span aria-hidden className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-text-tertiary" />
                        <span className="min-w-0">
                          <InlineText text={l.replace(/^[-*]\s+/, "")} />
                        </span>
                      </li>
                    ))}
                  </ul>
                );
              }
              if (lines.length === 1 && /^#{1,3}\s+/.test(lines[0])) {
                return (
                  <h3
                    key={j}
                    className="pt-2 font-display text-lg font-semibold leading-[26px] tracking-[-0.01em] text-text-primary"
                  >
                    {lines[0].replace(/^#{1,3}\s+/, "")}
                  </h3>
                );
              }
              return (
                <p key={j} className="whitespace-pre-wrap text-[15px] leading-6 text-text-secondary">
                  <InlineText text={block.trim()} />
                </p>
              );
            })}
          </React.Fragment>
        );
      })}
    </div>
  );
}
