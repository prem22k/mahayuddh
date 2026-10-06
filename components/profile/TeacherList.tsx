"use client";

import { profileHref } from "@/lib/profiles/username";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getTeachersForPattern, type Teacher } from "@/lib/data/profile";
import { FollowButton } from "@/components/profile/FollowButton";

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
 */
export function TeacherList({ pattern }: { pattern: string }) {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getTeachersForPattern(pattern, 8)
      .then((rows) => {
        if (!cancelled) setTeachers(rows);
      })
      // An empty list is the honest answer for a pattern nobody teaches yet.
      .catch(() => {
        if (!cancelled) setTeachers([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pattern]);

  if (loading) {
    return <p className="text-xs text-white/25">Looking for teachers…</p>;
  }

  if (teachers.length === 0) {
    return (
      <p className="text-xs text-white/50">
        Nobody has published for this pattern yet. If you have solved one, your
        approach is the thing that would go here.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {teachers.map((t) => {
        const used = t.note_forks + t.primer_forks;
        return (
          <div
            key={t.user_id}
            className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.06]"
          >
            <div className="w-8 h-8 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center font-bold text-[11px] text-white shrink-0 overflow-hidden">
              {t.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.avatar_url} alt={t.username} className="w-full h-full object-cover" />
              ) : (
                t.username.charAt(0).toUpperCase()
              )}
            </div>
            <div className="flex-1 min-w-0">
              <Link
                href={profileHref(t.username)}
                className="text-xs font-bold text-white hover:text-[#fa586a] transition-colors"
              >
                @{t.username}
              </Link>
              <p className="text-[10px] text-white/50">
                {/* Why this person is here, in downstream actions only. */}
                {used > 0
                  ? `${used} ${used === 1 ? "copy" : "copies"} of their writing`
                  : t.challenge_completions > 0
                    ? `${t.challenge_completions} challenges completed`
                    : `${t.approaches + t.primers} published, nothing copied yet`}
              </p>
            </div>
            <FollowButton userId={t.user_id} username={t.username} />
          </div>
        );
      })}
      <p className="text-[10px] text-white/25 pt-1">
        Ordered by copies and completed challenges. Not by followers, and not by a
        single score.
      </p>
    </div>
  );
}