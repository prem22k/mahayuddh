import type { NotificationKind } from "@/types/database";

export interface NotificationPrefs {
  push_enabled: boolean;
  challenge: boolean;
  squad: boolean;
  practice: boolean;
  contests: boolean;
}

export const DEFAULT_PREFS: NotificationPrefs = {
  push_enabled: true,
  challenge: true,
  squad: true,
  practice: true,
  contests: true,
};

export type NotificationCategory = Exclude<keyof NotificationPrefs, "push_enabled">;

/** Map each stored notification to the matching user-facing category toggle. */
export function preferenceCategoryForNotification(
  kind: NotificationKind,
  dedupeKey?: string | null
): NotificationCategory {
  switch (kind) {
    case "challenge":
    case "challenge_completed":
      return "challenge";
    case "goal":
    case "recap":
      return "squad";
    case "contest":
      return "contests";
    case "revenge":
      return "practice";
    case "nudge":
      // The daily growth digest has two kinds of content. The dedupe subtype
      // keeps a squad activity nudge under the squad switch; streak/lapsed
      // reminders follow the practice switch.
      return dedupeKey?.startsWith("nudge:squad-without-you:") ? "squad" : "practice";
  }
}

export function isNotificationCategoryEnabled(
  prefs: NotificationPrefs,
  kind: NotificationKind,
  dedupeKey?: string | null
): boolean {
  return prefs[preferenceCategoryForNotification(kind, dedupeKey)];
}
