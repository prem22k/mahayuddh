import Link from "next/link";
import type { Approach, Primer } from "@/types/database";

/**
 * A person's public teaching (§21, §22).
 *
 * Split into a server component deliberately: this content is public and does
 * not depend on the viewer, so it does not need to be in the client bundle. It
 * is also the part that justifies following somebody — §21's whole premise is
 * "useful to learn from", so it sits above the fold rather than behind a tab.
 */
export function PublicProfileBody({
  approaches,
  primers,
}: {
  approaches: Approach[];
  primers: Primer[];
}) {
  if (approaches.length === 0 && primers.length === 0) {
    return (
      <section className="space-y-2">
        <h2 className="text-lg font-bold">Public teaching</h2>
        <p className="text-xs text-white/40">
          Nothing published yet. An approach or a primer shared publicly shows up
          here — that is what makes somebody worth following.
        </p>
      </section>
    );
  }

  return (
    <>
      {primers.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-bold">Primers</h2>
          <div className="space-y-2">
            {primers.map((p) => (
              <Link
                key={p.id}
                href={`/primers/${p.slug}`}
                className="block p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] transition-all space-y-1"
              >
                <div className="text-sm font-bold text-white">{p.title}</div>
                <div className="text-[10px] uppercase tracking-wider text-[#ffd60a]/70">
                  {p.pattern}
                </div>
                {p.recognize_when?.length > 0 && (
                  <p className="text-[11px] text-white/40 truncate">
                    Recognise it when: {p.recognize_when[0]}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {approaches.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-bold">Approaches</h2>
          <div className="space-y-2">
            {approaches.map((a) => (
              <Link
                key={a.id}
                href={`/approach/${a.id}`}
                className="block p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] transition-all space-y-1"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-white/80">
                    {a.problem_slug.replace(/-/g, " ")}
                  </span>
                  {a.pattern && (
                    <span className="text-[10px] text-white/35">{a.pattern}</span>
                  )}
                </div>
                <p className="text-[11px] text-white/45 line-clamp-2">{a.core_idea}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}