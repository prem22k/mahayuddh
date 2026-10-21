"use client";

import { profileHref } from "@/lib/profiles/username";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getTeachersForPattern, type Teacher } from "@/lib/data/profile";
import { Avatar } from "@/components/ui/Avatar";
import { dataErrorMessage } from "@/lib/data/errors";

/**
 * "People who teach it" (§22).
 *
 * Sorted by forks and completed challenges — what other developers did with
 * their writing. Explicitly not by followers: §21 asks for "useful to learn
 * from" over "most followers", and a list ordered by popularity is how you get
 * the most-followed person rather than the most useful one.
 *
 * The sort happens in SQL (public.teachers_for_pattern). Ordering here would
 * need a fetch of everybody and then a guess.
 *
 * Stitch (pattern hub rail): divided rows inside the caller's card — avatar,
 * name, "N approaches · copied N times", chevron. No card of its own; Follow
 * lives on the profile each row opens.
 */
function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function TeacherList({ pattern }: { pattern: string }) {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getTeachersForPattern(pattern, 8)
      .then((rows) => {
        if (!cancelled) setTeachers(rows);
      })
      // A failed read is not "nobody teaches this": say so and offer a retry,
      // rather than showing the empty state as if it were the answer.
      .catch((err) => {
        if (!cancelled) {
          setTeachers([]);
          setError(dataErrorMessage(err, "Couldn't load teachers. Retry."));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pattern, attempt]);

  if (loading) {
    return <p className="text-xs text-text-tertiary">Looking for teachers…</p>;
  }

  if (error) {
    return (
      <div className="flex items-center justify-between gap-3 text-sm leading-6 text-text-secondary">
        <span>{error}</span>
        <button
          type="button"
          onClick={() => setAttempt((n) => n + 1)}
          className="inline-flex min-h-[44px] shrink-0 items-center rounded-md border border-hairline bg-surface-overlay px-3 text-xs font-medium text-text-primary transition-colors hover:bg-surface-raised md:h-8 md:min-h-0"
        >
          Retry
        </button>
      </div>
    );
  }

  if (teachers.length === 0) {
    return (
      <p className="text-sm leading-6 text-text-secondary">
        Nobody has published for this pattern yet. If you have solved one, your
        approach is the thing that would go here.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y divide-hairline">
        {teachers.map((t) => {
          const used = t.note_forks + t.primer_forks;
          // Why this person is here, in downstream actions only.
          const why =
            used > 0
              ? `copied ${plural(used, "time")}`
              : t.challenge_completions > 0
                ? `${plural(t.challenge_completions, "challenge")} completed`
                : "nothing copied yet";
          const wrote = plural(t.approaches, "approach", "approaches");
          return (
            <li key={t.user_id} className="py-3 first:pt-0 last:pb-0">
              <Link
                href={profileHref(t.username)}
                className="group flex min-h-[44px] items-center justify-between gap-3 md:min-h-0"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <Avatar
                    name={t.username}
                    src={t.avatar_url}
                    className="border border-hairline-strong bg-surface-raised font-mono"
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium text-text-primary underline-offset-4 group-hover:underline">
                      @{t.username}
                    </span>
                    <span className="text-xs font-medium text-text-tertiary">
                      {wrote} · {why}
                    </span>
                  </span>
                </span>
                <ChevronRight
                  className="h-[18px] w-[18px] shrink-0 text-text-tertiary transition-transform group-hover:translate-x-0.5 group-hover:text-text-primary"
                  strokeWidth={1.5}
                  aria-hidden
                />
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="text-xs leading-5 text-text-tertiary">
        Ordered by copies and completed challenges. Not by followers, and not by a
        single score.
      </p>
    </div>
  );
}
