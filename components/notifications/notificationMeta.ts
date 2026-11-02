import { CalendarClock, LucideIcon, RotateCcw, Swords, Users } from "lucide-react";
import type { Notification, NotificationKind } from "@/types/database";

/**
 * How notifications are grouped and dated, shared by the bell and the
 * /notifications history page (DESIGN.md: Challenges, Squad, Practice,
 * Contests).
 */
export type NotificationGroup = "Challenges" | "Squad" | "Practice" | "Contests";

export const GROUP_ORDER: NotificationGroup[] = ["Challenges", "Squad", "Practice", "Contests"];

const GROUP_OF: Record<NotificationKind, NotificationGroup> = {
  challenge: "Challenges",
  challenge_completed: "Challenges",
  goal: "Squad",
  recap: "Squad",
  revenge: "Practice",
  // Streak-at-risk and the lapsed digest are about your own practice.
  nudge: "Practice",
  contest: "Contests",
};

export const GROUP_ICON: Record<NotificationGroup, LucideIcon> = {
  Challenges: Swords,
  Squad: Users,
  Practice: RotateCcw,
  Contests: CalendarClock,
};

export function groupOf(kind: NotificationKind): NotificationGroup {
  return GROUP_OF[kind] ?? "Practice";
}

/** Items bucketed by group, in display order, empty groups dropped. */
export function groupNotifications(items: Notification[]): { group: NotificationGroup; items: Notification[] }[] {
  return GROUP_ORDER.map((group) => ({ group, items: items.filter((n) => groupOf(n.kind) === group) })).filter(
    (g) => g.items.length > 0
  );
}

/** "now", "5m", "3h", "2d", then a date. */
export function shortAgo(iso: string, now = Date.now()): string {
  const mins = Math.floor((now - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** Day heading for the history list: Today, Yesterday, or "Mon 28 Oct". */
export function dayLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(now) - startOf(d)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
}
