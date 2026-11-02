"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, BellRing, ChevronRight } from "lucide-react";
import {
  getNotifications,
  getUnreadCount,
  markAllRead,
  markRead,
} from "@/lib/data/notifications";
import { requestPushPermission } from "@/lib/pushPermission";
import { track } from "@/lib/analytics";
import type { Notification } from "@/types/database";
import { Skeleton } from "@/components/ui/States";
import { groupNotifications, shortAgo } from "@/components/notifications/notificationMeta";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCachedQuery, useInvalidate } from "@/lib/cache/query";

const NO_NOTIFICATIONS: Notification[] = [];

/**
 * Notification bell (§37).
 *
 * The bell is an inbox of what is still unread, grouped as Challenges, Squad,
 * Practice and Contests (DESIGN.md). Opening it changes nothing; clicking an
 * item or "Mark all read" marks it read and takes it out of the bell. Every
 * notification, read or not, stays on /notifications.
 *
 * Push delivery lives here too, on purpose. The database triggers write rows;
 * a Postgres trigger cannot call lib/push.ts, and inventing an HTTP extension
 * for six notification kinds would be a lot of machinery to avoid a round trip.
 * The row is the queue: unread rows are the unit of work.
 *
 * Push *permission* lives here as well, for the same reason it used to be a
 * second bell-shaped button in the header: a separate "Alerts" pill beside a
 * real bell is two controls for one concept, and mounted as a fixed overlay in
 * the same corner the two were drawn on top of each other.
 */
export function NotificationBell() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const invalidate = useInvalidate();

  const [open, setOpen] = useState(false);
  const [pushGranted, setPushGranted] = useState(false);
  // Push must fire once per notification, ever. A ref rather than state: this
  // runs in an effect and a state write there would loop.
  const pushed = useRef<Set<string>>(new Set());

  const notificationsQuery = useCachedQuery(
    userId ? ["notifications", 20, true] : null,
    () => getNotifications(20, { unreadOnly: true }),
    // New notifications arrive while the user sits on a page: poll once a
    // minute while the tab is visible (as before the cache), paused when hidden.
    { freshForMs: 10_000, pollEveryMs: 60_000 }
  );

  const unreadCountQuery = useCachedQuery(
    userId ? ["unread-count"] : null,
    getUnreadCount,
    { freshForMs: 10_000, pollEveryMs: 60_000 }
  );

  const items = notificationsQuery.data ?? NO_NOTIFICATIONS;
  const unread = unreadCountQuery.data ?? 0;
  const loading = notificationsQuery.isLoading || unreadCountQuery.isLoading;

  // Deliver push for anything new, once.
  useEffect(() => {
    const rows = notificationsQuery.data;
    if (!rows) return;
    for (const n of rows) {
      if (n.read_at || pushed.current.has(n.id)) continue;
      pushed.current.add(n.id);
      // Server-side because it needs the service key and the VAPID private
      // key. The route takes a notification id rather than arbitrary text, so
      // it cannot be used as a push relay for content that is not already the
      // caller's own notification.
      void fetch("/api/push/deliver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: n.id }),
      }).catch(() => {
        // A failed push is not worth surfacing. The row is still there and
        // the bell still shows it.
      });
      track("notification_delivered", { kind: n.kind, via: "push" });
    }
  }, [notificationsQuery.data]);

  // The permission can be granted or revoked outside the page (browser
  // settings), so read it on mount rather than assuming a default.
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setPushGranted(Notification.permission === "granted");
  }, []);

  useEffect(() => {
    // The history page marks things read too; keep the dot in step with it.
    const onChanged = () => {
      void notificationsQuery.refresh();
      void unreadCountQuery.refresh();
    };
    window.addEventListener("notifications-changed", onChanged);
    return () => {
      window.removeEventListener("notifications-changed", onChanged);
    };
  }, [notificationsQuery.refresh, unreadCountQuery.refresh]);

  const onOpen = () => {
    const next = !open;
    setOpen(next);
    if (next) track("notification_bell_opened", { unread });
  };

  const onItem = (n: Notification) => {
    track("notification_clicked", { kind: n.kind, from: "bell" });
    // Read now leaves the bell; the history page still has it.
    void notificationsQuery.setData((prev) => (prev ?? []).filter((x) => x.id !== n.id));
    void unreadCountQuery.setData((u) => Math.max(0, (u ?? 1) - 1));
    setOpen(false);
    // Refetch only after the write lands (success or failure), or the refetch
    // reads the row as still unread and the item comes back.
    void markRead(n.id).finally(() => {
      void notificationsQuery.refresh();
      void unreadCountQuery.refresh();
      void invalidate("notification-history");
    });
  };

  const onMarkAll = async () => {
    track("notification_mark_all_read", { from: "bell", count: unread });
    void notificationsQuery.setData(NO_NOTIFICATIONS);
    void unreadCountQuery.setData(0);
    await markAllRead();
    void notificationsQuery.refresh();
    void unreadCountQuery.refresh();
    void invalidate("notification-history");
  };

  const togglePush = async () => {
    if (!("Notification" in window)) return;
    if (pushGranted) {
      // The browser gives no API to revoke permission programmatically, so say
      // where the switch is instead of pretending a click turned it off.
      track("notification_push_manage_opened", { from: "bell" });
      window.open("https://support.google.com/chrome/answer/3223642", "_blank", "noopener");
      return;
    }
    const granted = await requestPushPermission();
    setPushGranted(granted);
  };

  const groups = groupNotifications(items);

  return (
    <div className="relative">
      <button
        onClick={onOpen}
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
        aria-expanded={open}
        className="relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary md:h-8 md:w-8 md:border md:border-hairline md:hover:border-hairline-strong"
      >
        <Bell className="h-4 w-4" strokeWidth={1.5} />
        {unread > 0 && (
          <span
            aria-hidden
            className="absolute right-3 top-3 h-1.5 w-1.5 rounded-full bg-primary md:right-1.5 md:top-1.5"
          />
        )}
      </button>

      {open && (
        <>
          <button
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div className="absolute right-0 top-full mt-1 z-20 w-[20rem] max-w-[calc(100vw-2rem)] popover-panel overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-hairline">
              <span className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">
                Notifications
              </span>
              {items.length > 0 && (
                <button
                  onClick={() => void onMarkAll()}
                  className="text-[10px] font-bold text-text-tertiary hover:text-text-primary cursor-pointer"
                >
                  Mark all read
                </button>
              )}
            </div>

            {loading && items.length === 0 && unread > 0 ? (
              <ul className="divide-y divide-hairline" aria-label="Loading notifications">
                {[0, 1, 2].map((i) => (
                  <li key={i} className="px-4 py-3" aria-hidden>
                    <Skeleton className="h-3 w-2/3 rounded-xs" />
                    <Skeleton className="mt-1.5 h-3 w-full rounded-xs" />
                    <Skeleton className="mt-2 h-2.5 w-24 rounded-xs" />
                  </li>
                ))}
              </ul>
            ) : items.length === 0 ? (
              <p className="px-4 py-6 text-[11px] text-text-tertiary text-center">
                You&apos;re all caught up. Notifications only arrive when there is something to do.
              </p>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                {groups.map((g) => (
                  <section key={g.group} aria-label={g.group}>
                    <h3 className="bg-surface px-4 pb-1 pt-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-text-tertiary">
                      {g.group}
                    </h3>
                    <ul className="divide-y divide-hairline">
                      {g.items.map((n) => (
                        <li key={n.id}>
                          <Link
                            href={n.deep_link ?? "/notifications"}
                            onClick={() => onItem(n)}
                            className="block px-4 py-3 hover:bg-surface-overlay transition-colors"
                          >
                            <div className="flex items-start gap-2">
                              <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-[11px] font-bold text-text-primary">{n.title}</p>
                                {n.body && <p className="text-[11px] text-text-secondary mt-0.5">{n.body}</p>}
                                <p className="font-mono text-[10px] text-text-disabled mt-1 tnum">{shortAgo(n.created_at)}</p>
                              </div>
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}

            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between border-t border-hairline px-4 py-2.5 text-[11px] font-medium text-text-secondary transition-colors hover:bg-surface-overlay hover:text-text-primary"
            >
              Notification history
              <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
            </Link>

            {/* Push permission, with the bell. One concept, one control. */}
            <div className="border-t border-hairline px-4 py-2.5 flex items-center justify-between gap-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">
                Push alerts
              </span>
              <button
                onClick={() => void togglePush()}
                aria-pressed={pushGranted}
                className={
                  pushGranted
                    ? "flex items-center gap-1.5 text-[10px] font-bold text-primary hover:opacity-80 transition-opacity cursor-pointer"
                    : "text-[10px] font-bold text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
                }
              >
                {pushGranted ? (
                  <>
                    <BellRing className="w-3 h-3" />
                    On
                  </>
                ) : (
                  "Turn on"
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
