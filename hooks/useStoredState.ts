"use client";

import { useCallback, useSyncExternalStore } from "react";

type Primitive = string | number | boolean;
type Area = "local" | "session";

// Same-tab writes don't fire "storage", so every setter also pings these.
const listeners = new Set<() => void>();
// Values storage refused to keep (private mode, quota), for this visit only.
const unsaved = new Map<string, string>();

function area(kind: Area): Storage | null {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * A UI preference remembered in the browser (a tab, a filter). Never server
 * data: that stays in the in-memory cache (lib/cache/query.tsx).
 *
 * `parse` turns the stored string (or null) into a valid value, so a stale or
 * hand-edited entry falls back to the default instead of breaking the page.
 * Storage can be missing or throw (private mode); then the value lasts for the
 * visit only. The server render uses the default; the stored value applies on
 * hydration.
 */
export function useStoredState<T extends Primitive>(
  key: string,
  fallback: T,
  parse: (raw: string | null) => T | null,
  kind: Area = "local"
): [T, (next: T) => void] {
  const read = useCallback(() => {
    const slot = `${kind}:${key}`;
    let raw: string | null = unsaved.get(slot) ?? null;
    if (!unsaved.has(slot)) {
      try {
        raw = area(kind)?.getItem(key) ?? null;
      } catch {
        // Unreadable; use the default.
      }
    }
    return parse(raw) ?? fallback;
  }, [key, kind, parse, fallback]);

  const value = useSyncExternalStore(subscribe, read, () => fallback);

  const set = useCallback(
    (next: T) => {
      const slot = `${kind}:${key}`;
      try {
        const store = area(kind);
        if (!store) throw new Error("no storage");
        store.setItem(key, String(next));
        unsaved.delete(slot);
      } catch {
        // Not remembered past this visit; still changes this view.
        unsaved.set(slot, String(next));
      }
      listeners.forEach((l) => l());
    },
    [key, kind]
  );

  return [value, set];
}

/** `parse` for a value that must be one of a fixed set. */
export function oneOf<T extends string>(allowed: readonly T[]) {
  return (raw: string | null): T | null =>
    raw != null && (allowed as readonly string[]).includes(raw) ? (raw as T) : null;
}

export const parseBool = (raw: string | null): boolean | null =>
  raw === "true" ? true : raw === "false" ? false : null;

export const parseNonNegativeInt = (raw: string | null): number | null => {
  const n = raw == null ? NaN : Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
};

export const parseString = (raw: string | null): string | null => raw;
