"use client";

import Link from "next/link";
import { useState } from "react";
import type { Approach, Primer } from "@/types/database";
import { PatternChip } from "@/components/ui/Badge";
import { UnderlineTabs } from "@/components/ui/ProblemRow";

/**
 * A person's public teaching (§21, §22).
 *
 * Public rows only. Tabs switch views of the same teaching, so a segmented
 * underline pair fits: Approaches | Primers.
 */
export function PublicProfileBody({
  approaches,
  primers,
}: {
  approaches: Approach[];
  primers: Primer[];
}) {
  const [tab, setTab] = useState<"Approaches" | "Primers">("Approaches");

  if (approaches.length === 0 && primers.length === 0) {
    return (
      <section className="space-y-2">
        <h2 className="text-lg font-semibold leading-[26px]">Public teaching</h2>
        <div className="rounded-xl border border-hairline bg-surface p-6 text-center">
          <p className="text-sm font-medium text-text-primary">Nothing published yet</p>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            An approach or a primer shared publicly shows up here.
          </p>
        </div>
      </section>
    );
  }

  const tabs = [
    `Approaches ${approaches.length}`,
    `Primers ${primers.length}`,
  ] as const;

  return (
    <section className="space-y-3">
      <UnderlineTabs
        tabs={tabs}
        value={tab === "Approaches" ? tabs[0] : tabs[1]}
        onChange={(v) => setTab(v.startsWith("Approaches") ? "Approaches" : "Primers")}
      />
      {tab === "Approaches" ? (
        approaches.length === 0 ? (
          <p className="text-sm leading-6 text-text-secondary">No public approaches yet.</p>
        ) : (
          <ul className="space-y-2">
            {approaches.map((a) => (
              <li key={a.id}>
                {/* Public rows only (the page query filters visibility=public),
                    so the public projection is the honest target — the authed
                    /approach/[id] page would bounce a logged-out visitor. */}
                <Link
                  href={`/a/${a.id}`}
                  className="block rounded-xl border border-hairline bg-surface p-4 transition-colors hover:bg-surface-raised"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium capitalize text-text-primary">
                      {a.problem_slug.replace(/-/g, " ")}
                    </span>
                    {a.pattern && <PatternChip label={a.pattern} />}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-text-secondary">
                    {a.core_idea}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : primers.length === 0 ? (
        <p className="text-sm leading-6 text-text-secondary">No public primers yet.</p>
      ) : (
        <ul className="space-y-2">
          {primers.map((p) => (
            <li key={p.id}>
              <Link
                href={`/primers/${p.slug}`}
                className="block rounded-xl border border-hairline bg-surface p-4 transition-colors hover:bg-surface-raised"
              >
                <p className="text-sm font-medium text-text-primary">{p.title}</p>
                <div className="mt-1.5">
                  <PatternChip label={p.pattern} />
                </div>
                {p.recognize_when?.length > 0 && (
                  <p className="mt-1 truncate text-xs leading-5 text-text-secondary">
                    {p.recognize_when[0]}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
