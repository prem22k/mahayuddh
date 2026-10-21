"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UserPlus, UserCheck } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { isFollowing, toggleFollow } from "@/lib/data/profile";
import { dataErrorMessage } from "@/lib/data/errors";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

/**
 * Follow button (§21).
 *
 * Reads its state on mount rather than taking it as a prop, so a profile page
 * that loads its data in one call does not need a second round trip just to get
 * this right.
 *
 * Renders nothing on your own profile. `follows` has
 * `check (follower_id <> followed_id)`, so a self-follow button is a button
 * that always fails — and on a pattern page where you are the only person who
 * teaches that pattern, it was the only button there was.
 *
 * Stitch: a neutral secondary button, never gold — the page's one gold action
 * belongs to the visitor close. With `signInHref`, a signed-out visitor gets a
 * link to sign in (carrying ?next=) instead of a button that can only fail.
 */
export function FollowButton({
  userId,
  username,
  signInHref,
  className,
}: {
  userId: string;
  username: string;
  /** Optional: where a signed-out visitor goes to follow. Off by default. */
  signInHref?: string;
  className?: string;
}) {
  const { user, loading } = useAuth();
  const [following, setFollowing] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSelf = user?.id === userId;

  useEffect(() => {
    if (isSelf) return;
    void isFollowing(userId)
      .then(setFollowing)
      .catch(() => setFollowing(false));
  }, [userId, isSelf]);

  if (isSelf) return null;

  const cls = cn(
    "inline-flex h-10 items-center justify-center gap-2 rounded-md border px-5 text-sm font-medium transition-colors disabled:opacity-50 max-md:h-9 max-md:min-h-[44px] max-md:px-3.5 max-md:text-xs",
    following
      ? "border-hairline-strong bg-transparent text-text-secondary hover:bg-surface-raised hover:text-text-primary"
      : "border-hairline bg-surface-overlay text-text-primary hover:bg-[#272830]",
    className
  );

  if (signInHref && !loading && !user) {
    return (
      <Link href={signInHref} className={cls} title={`Sign in to follow @${username}`}>
        <UserPlus className="h-4 w-4 text-text-secondary" strokeWidth={1.5} aria-hidden />
        Follow
      </Link>
    );
  }

  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      await toggleFollow(userId, !following);
      setFollowing(!following);
      track(following ? "user_unfollowed" : "user_followed", { via_username: username });
    } catch (err) {
      setError(dataErrorMessage(err, "Couldn't update."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={busy || following === null}
        aria-pressed={following === true}
        className={cls}
        title={
          following
            ? `Unfollow @${username}`
            : `Follow @${username} to see their teaching in Following`
        }
      >
        {following ? (
          <UserCheck className="h-4 w-4" strokeWidth={1.5} aria-hidden />
        ) : (
          <UserPlus className="h-4 w-4 text-text-secondary" strokeWidth={1.5} aria-hidden />
        )}
        {following ? "Following" : "Follow"}
      </button>
      {error && <span className="text-xs text-error">{error}</span>}
    </div>
  );
}
