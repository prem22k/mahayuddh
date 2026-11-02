"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCheck, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorCard } from "@/components/ui/States";
import { NotificationRowsSkeleton, NotificationsSkeleton } from "@/components/skeletons/NotificationsSkeleton";
import { getNotificationHistory, markAllRead, markRead } from "@/lib/data/notifications";
import { dataErrorMessage } from "@/lib/data/errors";
import { track } from "@/lib/analytics";
import { GROUP_ICON, dayLabel, groupOf, shortAgo } from "@/components/notifications/notificationMeta";
import type { Notification } from "@/types/database";

const PAGE = 30;

/** Tell the header bell to re-read its unread list after a change here. */
function announceChange() {
  window.dispatchEvent(new Event("notifications-changed"));
}

/**
 * Notification history. The bell only holds what is still unread: reading an
 * item or "Mark all read" takes it out of the bell. Everything stays here,
 * newest first, grouped by day.
 */
export default function NotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await getNotificationHistory(PAGE);
      setItems(rows);
      setHasMore(rows.length === PAGE);
    } catch (err) {
      setError(dataErrorMessage(err, "Couldn't load your notifications. Retry."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;
    void load();
  }, [authLoading, user, load]);

  const loadOlder = async () => {
    const oldest = items[items.length - 1]?.created_at;
    if (!oldest) return;
    setLoadingOlder(true);
    try {
      const rows = await getNotificationHistory(PAGE, oldest);
      setItems((prev) => [...prev, ...rows]);
      setHasMore(rows.length === PAGE);
    } catch (err) {
      setError(dataErrorMessage(err, "Couldn't load older notifications. Retry."));
    } finally {
      setLoadingOlder(false);
    }
  };

  const unreadCount = items.filter((n) => !n.read_at).length;

  const onMarkAll = async () => {
    setMarking(true);
    const now = new Date().toISOString();
    try {
      await markAllRead();
      setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
      track("notification_mark_all_read", { from: "history", count: unreadCount });
      announceChange();
    } finally {
      setMarking(false);
    }
  };

  const onOpenItem = (n: Notification) => {
    track("notification_clicked", { kind: n.kind, from: "history" });
    if (n.read_at) return;
    const now = new Date().toISOString();
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: now } : x)));
    void markRead(n.id).then(announceChange);
  };

  const days = useMemo(() => {
    const out: { label: string; items: Notification[] }[] = [];
    for (const n of items) {
      const label = dayLabel(n.created_at);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(n);
      else out.push({ label, items: [n] });
    }
    return out;
  }, [items]);

  if (authLoading || (loading && items.length === 0 && !error)) return <NotificationsSkeleton />;

  return (
    <div className="mx-auto flex w-full max-w-reading flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="type-display-md text-text-primary">Notifications</h1>
          <p className="text-[15px] leading-6 text-text-secondary">
            Everything that reached your bell, read or not.
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="secondary"
            onClick={() => void onMarkAll()}
            loading={marking}
            className="h-10 shrink-0 border border-hairline"
          >
            <CheckCheck className="h-4 w-4" strokeWidth={1.5} aria-hidden />
            Mark all read
          </Button>
        )}
      </div>

      {error && <ErrorCard message={error} onRetry={() => void load()} />}

      {!error && items.length === 0 ? (
        <EmptyState
          heading="No notifications yet"
          body="Challenges, squad goals, revenge reminders and contests land here when there is something to do."
          action={
            <Link
              href="/challenges"
              className="inline-flex h-10 items-center justify-center rounded-md bg-surface-overlay px-4 text-sm font-medium leading-5 text-text-primary transition-colors hover:bg-[#272830]"
            >
              Send a challenge
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          {days.map((day) => (
            <section key={day.label} aria-label={day.label} className="flex flex-col gap-2">
              <h2 className="font-mono text-xs font-medium uppercase tracking-[0.06em] text-text-tertiary">
                {day.label}
              </h2>
              <ul className="divide-y divide-hairline overflow-hidden rounded-lg border border-hairline bg-surface">
                {day.items.map((n) => (
                  <li key={n.id}>
                    <NotificationRow n={n} onOpen={() => onOpenItem(n)} />
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {loadingOlder && <NotificationRowsSkeleton count={2} />}

          {hasMore && !loadingOlder && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => void loadOlder()}
                className="flex h-10 w-full items-center justify-center gap-1.5 rounded-md border border-hairline bg-surface-raised px-6 text-sm font-medium text-text-secondary transition-colors hover:border-hairline-strong hover:text-text-primary md:w-auto"
              >
                Show older
                <ChevronDown className="h-4 w-4" strokeWidth={1.5} aria-hidden />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NotificationRow({ n, onOpen }: { n: Notification; onOpen: () => void }) {
  const group = groupOf(n.kind);
  const Icon = GROUP_ICON[group];
  const unread = !n.read_at;
  const content = (
    <span className="flex items-start gap-3">
      <span
        className={cn(
          "relative mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-hairline",
          unread ? "bg-surface-raised text-text-primary" : "bg-well text-text-tertiary"
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={1.5} aria-hidden />
        {unread && (
          <span aria-hidden className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-surface bg-primary" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-sm leading-5",
            unread ? "font-semibold text-text-primary" : "font-medium text-text-secondary"
          )}
        >
          {n.title}
          {unread && <span className="sr-only"> (unread)</span>}
        </span>
        {n.body && <span className="mt-0.5 block text-sm leading-5 text-text-secondary">{n.body}</span>}
        <span className="mt-1 block font-mono text-xs leading-4 text-text-tertiary tnum">
          {group} · {shortAgo(n.created_at)}
        </span>
      </span>
    </span>
  );

  return n.deep_link ? (
    <Link
      href={n.deep_link}
      onClick={onOpen}
      className="block px-4 py-3.5 transition-colors hover:bg-surface-raised"
    >
      {content}
    </Link>
  ) : (
    <div className="px-4 py-3.5">{content}</div>
  );
}
