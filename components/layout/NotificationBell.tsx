"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, BellRing } from "lucide-react";
import {
  getNotifications,
  getUnreadCount,
  markAllRead,
  markRead,
} from "@/lib/data/notifications";
import { track } from "@/lib/analytics";
import type { Notification } from "@/types/database";

/**
 * Notification bell (§37).
 *
 * §37 asks for action-oriented notifications and a low-noise default. This
 * component is where "low-noise" becomes visible: it shows what is unread, it
 * marks read on open rather than on click-through, and it refuses to grow past
 * a small number of items.
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
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pushGranted, setPushGranted] = useState(false);
  // Push must fire once per notification, ever. A ref rather than state: this
  // runs in an effect and a state write there would loop.
  const pushed = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, count] = await Promise.all([getNotifications(10), getUnreadCount()]);
      setItems(rows);
      setUnread(count);

      // Deliver push for anything new, once.
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
    } finally {
      setLoading(false);
    }
  }, []);

  // The permission can be granted or revoked outside the page (browser
  // settings), so read it on mount rather than assuming a default.
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setPushGranted(Notification.permission === "granted");
  }, []);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 60_000);
    return () => clearInterval(t);
  }, [refresh]);

  const onOpen = async () => {
    const next = !open;
    setOpen(next);
    if (!next) return;
    track("notification_bell_opened", { unread });
    // Opened, not clicked: the unread state clears when you look at the list.
    const rows = await getNotifications(10);
    const ids = rows.filter((r) => !r.read_at).map((r) => r.id);
    if (ids.length > 0) {
      await Promise.all(ids.map((id) => markRead(id)));
      await refresh();
    }
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
    const permission = await Notification.requestPermission();
    setPushGranted(permission === "granted");
    track("notification_push_toggled", { granted: permission === "granted" });
  };

  return (
    <div className="relative">
      <button
        onClick={() => void onOpen()}
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
        aria-expanded={open}
        className="relative w-11 h-11 md:w-10 md:h-10 rounded-full text-white/50 hover:text-white transition-colors cursor-pointer flex items-center justify-center"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[14px] h-[14px] px-1 rounded-full bg-[#fa586a] text-white text-[9px] font-black flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
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
          <div className="absolute right-0 top-full mt-1 z-20 w-[20rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-white/[0.08] bg-[#0e0e0e] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/35">
                Notifications
              </span>
              {unread > 0 && (
                <button
                  onClick={() => void markAllRead().then(refresh)}
                  className="text-[10px] font-bold text-white/35 hover:text-white cursor-pointer"
                >
                  Mark all read
                </button>
              )}
            </div>

            {loading && items.length === 0 ? (
              <p className="px-4 py-6 text-[11px] text-white/30 text-center">Loading…</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-6 text-[11px] text-white/30 text-center">
                Nothing here. Notifications only arrive when there is something to do.
              </p>
            ) : (
              <ul className="max-h-96 overflow-y-auto divide-y divide-white/[0.04]">
                {items.map((n) => (
                  <li key={n.id}>
                    <Link
                      href={n.deep_link ?? "#"}
                      onClick={() => {
                        track("notification_clicked", { kind: n.kind });
                        void markRead(n.id);
                        setOpen(false);
                      }}
                      className={`block px-4 py-3 hover:bg-white/[0.04] transition-all ${
                        n.read_at ? "opacity-60" : ""
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {!n.read_at && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#fa586a] mt-1.5 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold text-white">{n.title}</p>
                          {n.body && <p className="text-[11px] text-white/45 mt-0.5">{n.body}</p>}
                          <p className="text-[10px] text-white/25 mt-1">
                            {new Date(n.created_at).toLocaleDateString()} · {n.kind}
                          </p>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            {/* Push permission, with the bell. One concept, one control. */}
            <div className="border-t border-white/[0.06] px-4 py-2.5 flex items-center justify-between gap-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/35">
                Push alerts
              </span>
              <button
                onClick={() => void togglePush()}
                aria-pressed={pushGranted}
                className={
                  pushGranted
                    ? "flex items-center gap-1.5 text-[10px] font-bold text-[#fa586a] hover:opacity-80 transition-opacity cursor-pointer"
                    : "text-[10px] font-bold text-white/35 hover:text-white transition-colors cursor-pointer"
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