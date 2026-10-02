"use client";

import { useEffect, useState } from "react";
import { UserPlus, UserCheck } from "lucide-react";
import { isFollowing, toggleFollow } from "@/lib/data/profile";
import { dataErrorMessage } from "@/lib/data/errors";
import { track } from "@/lib/analytics";

/**
 * Follow button (§21).
 *
 * Reads its state on mount rather than taking it as a prop, so a profile page
 * that loads its data in one call does not need a second round trip just to get
 * this right. Following yourself is not offered: the table refuses it, and a
 * button that always fails is worse than no button.
 */
export function FollowButton({ userId, username }: { userId: string; username: string }) {
  const [following, setFollowing] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void isFollowing(userId)
      .then(setFollowing)
      .catch(() => setFollowing(false));
  }, [userId]);

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
            ? "bg-white/[0.08] border border-white/[0.1] text-white"
            : "bg-[#fa586a] text-white hover:bg-[#fa586a]/90"
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
      {error && <span className="text-[10px] text-[#ff453a]">{error}</span>}
    </div>
  );
}