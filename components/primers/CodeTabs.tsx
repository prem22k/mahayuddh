"use client";

import React, { useEffect, useState } from "react";
import { CodeBlock } from "@/components/approach/CodeBlock";
import { cn } from "@/lib/utils";
import type { PrimerCode, PrimerCodeLang } from "@/types/database";

const LANGS: { id: PrimerCodeLang; label: string }[] = [
  { id: "cpp", label: "C++" },
  { id: "java", label: "Java" },
  { id: "python", label: "Python" },
];

// The reader's language, remembered across primers so they don't switch every
// page. Storage can be missing or throw (private mode); then it's per-visit.
const KEY = "mahayuddh_code_lang";
const EVENT = "mahayuddh:code-lang";

function readLang(): PrimerCodeLang | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "cpp" || v === "java" || v === "python" ? v : null;
  } catch {
    return null;
  }
}

/** One snippet in C++, Java and Python, with tabs; every block on the page follows the last choice. */
export function CodeTabs({ code, label }: { code: PrimerCode; label?: string }) {
  const [lang, setLang] = useState<PrimerCodeLang>("cpp");

  useEffect(() => {
    const saved = readLang();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- storage is only readable after mount
    if (saved) setLang(saved);
    const onChange = (e: Event) => setLang((e as CustomEvent<PrimerCodeLang>).detail);
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);

  const choose = (next: PrimerCodeLang) => {
    setLang(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Not remembered; still switches this page.
    }
    window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
  };

  return (
    <div className="flex flex-col gap-2">
      <div role="tablist" aria-label="Language" className="flex items-center gap-1">
        {LANGS.map((l) => (
          <button
            key={l.id}
            type="button"
            role="tab"
            aria-selected={lang === l.id}
            onClick={() => choose(l.id)}
            className={cn(
              "inline-flex h-8 min-h-[44px] items-center rounded-md border px-3 font-mono text-xs font-medium transition-colors md:min-h-0",
              lang === l.id
                ? "border-hairline-strong bg-surface-overlay text-text-primary"
                : "border-transparent text-text-secondary hover:bg-surface-raised hover:text-text-primary"
            )}
          >
            {l.label}
          </button>
        ))}
      </div>
      <CodeBlock code={code[lang]} label={label} lineNumbers={false} />
    </div>
  );
}
