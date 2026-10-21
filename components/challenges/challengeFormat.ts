import { chainState } from "@/lib/chains";
import { formatDuration } from "@/lib/format";
import type { Profile, Suggestion } from "@/types/database";

/** `1497` -> `"24:57"`; null when there is no measured time. */
export function fmtClock(sec: number | null | undefined): string | null {
  return formatDuration(sec);
}

/** Signed gap between two measured times: `-244` -> `"-4m 04s"`. */
export function fmtDelta(sec: number): string {
  const sign = sec < 0 ? "-" : "+";
  const abs = Math.abs(Math.trunc(sec));
  return `${sign}${Math.floor(abs / 60)}m ${String(abs % 60).padStart(2, "0")}s`;
}

/** `@demo_sneha`, or a neutral fallback when the profile didn't load. */
export function handleOf(p: Pick<Profile, "username"> | null | undefined, fallback = "a squad mate"): string {
  return p?.username ? `@${p.username}` : fallback;
}

/**
 * Short ticket number for the stub, taken from the challenge's own id (the
 * same id the /c/ link carries). Never a sequence we don't have.
 */
export function ticketOf(id: string): string {
  return `#${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

export type ChallengeStatusKey = "open" | "accepted" | "solved" | "expired" | "declined";

/**
 * Open / Accepted / Solved / Expired / Declined. "Solved", not "Beaten":
 * completing a challenge requires a solve, not a faster time, so the app
 * can't honestly claim the time was beaten.
 */
export function challengeStatus(
  item: Pick<Suggestion, "status" | "deadline_at" | "accepted_at">,
  now: Date = new Date()
): { key: ChallengeStatusKey; label: string } {
  const state = chainState(item, now);
  if (state === "completed") return { key: "solved", label: "Solved" };
  if (state === "broken") return { key: "declined", label: "Declined" };
  if (state === "timed_out") return { key: "expired", label: "Expired" };
  if (item.accepted_at) return { key: "accepted", label: "Accepted" };
  return { key: "open", label: "Open" };
}

/** Deadline in the shapes the pass and rows need. Null when there is none. */
export function dueParts(iso: string | null, now: Date = new Date()) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const dayMonth = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const long = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const msAhead = d.getTime() - now.getTime();
  // Within the coming week a weekday reads faster than a date ("due Fri").
  const rel =
    msAhead > 0 && msAhead < 6 * 86_400_000
      ? d.toLocaleDateString("en-GB", { weekday: "short" })
      : dayMonth;
  return {
    /** `18 OCT` for the stub. */
    stub: dayMonth.toUpperCase(),
    /** `Sun, 18 Oct`. */
    long: long.replace(/^(\w+)\s/, "$1, "),
    /** `23:59`. */
    time,
    /** `Fri` within the week, else `18 Oct`. */
    rel,
  };
}

/** `12 Oct` for "sent" lines. */
export function shortDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
