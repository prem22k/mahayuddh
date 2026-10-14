"use client";

import { useEffect, useState } from "react";
import { UserPlus, UserCheck } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { isFollowing, toggleFollow } from "@/lib/data/profile";
import { dataErrorMessage } from "@/lib/data/errors";
import { track } from "@/lib/analytics";

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
 */
export function FollowButton({ userId, username }: { userId: string; username: string }) {
  const { user } = useAuth();
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
        onClick={() => void toggle()}
        disabled={busy || following === null}
        className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 ${
          following
            ? "bg-surface-overlay border border-hairline text-text-primary"
            : "bg-primary text-on-primary hover:bg-primary-hover"
        }`}
        title={
          following
            ? `Unfollow @${username}`
            : `Follow @${username} to see their teaching in Following`
        }
      >
        {following ? <UserCheck className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
        {following ? "Following" : "Follow"}
      </button>
      {error && <span className="text-[10px] text-error">{error}</span>}
    </div>
  );
}