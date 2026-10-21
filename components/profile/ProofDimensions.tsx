import type { Dimension, TeacherStats } from "@/lib/reputation";

/**
 * "Proof of practice": the five §22 dimensions as one divided list (Stitch
 * public profile, zone 2). Each value says what it counts in its own words —
 * there is no blended score to show, by design (lib/reputation.ts) — and each
 * row keeps its definition visible, so the number cannot drift from its
 * meaning. The only chip is one the data can back: every logged solve has
 * LeetCode evidence.
 */
const UNIT: Record<Dimension["id"], [one: string, many: string]> = {
  solving: ["verified solve", "verified solves"],
  teaching: ["published", "published"],
  helpfulness: ["challenge or reply", "challenges + replies"],
  consistency: ["active day", "active days"],
  impact: ["fork or improvement", "forks + improvements"],
};

function valueLabel(d: Dimension): string {
  const [one, many] = UNIT[d.id];
  return `${d.value} ${d.value === 1 ? one : many}`;
}

export function ProofDimensions({
  dimensions,
  stats,
}: {
  dimensions: Dimension[];
  stats: TeacherStats;
}) {
  const allVerified = stats.verified_solves > 0 && stats.logged_solves === stats.verified_solves;
  return (
    <section aria-labelledby="proof-of-practice" className="space-y-3 md:space-y-4">
      <div className="flex items-baseline justify-between gap-3 border-b border-hairline pb-2.5">
        <h2
          id="proof-of-practice"
          className="font-display text-lg font-semibold tracking-[-0.01em] text-text-primary md:text-xl"
        >
          Proof of practice
        </h2>
        <span className="font-mono text-[11px] text-text-tertiary tnum md:text-xs">
          {dimensions.length} dimensions
        </span>
      </div>
      <ul className="divide-y divide-hairline overflow-hidden rounded-xl border border-hairline bg-surface">
        {dimensions.map((d) => (
          <li
            key={d.id}
            className="flex flex-col gap-1 p-3.5 md:flex-row md:items-center md:justify-between md:gap-4 md:p-5"
          >
            <div className="min-w-0 space-y-1 md:max-w-xl">
              <div className="flex items-center justify-between gap-3 md:justify-start md:gap-2">
                <span className="text-xs font-medium text-text-primary md:text-sm">{d.label}</span>
                {d.id === "solving" && allVerified && (
                  <span className="hidden rounded-xs bg-verified-tint px-1.5 py-0.5 font-mono text-[11px] font-medium text-verified md:inline">
                    All verified
                  </span>
                )}
                <span className="shrink-0 font-mono text-xs font-medium text-text-primary tnum md:hidden">
                  {valueLabel(d)}
                </span>
              </div>
              {d.note && <p className="text-[11px] leading-4 text-text-secondary md:text-xs">{d.note}</p>}
              <p className="text-[11px] leading-4 text-text-tertiary md:text-xs">{d.definition}</p>
            </div>
            <span className="hidden shrink-0 font-mono text-lg font-medium text-text-primary tnum md:block">
              {valueLabel(d)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
