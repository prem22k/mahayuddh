"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { WifiOff, RefreshCw, ArrowLeft, Server, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Wordmark } from "@/components/landing/Brand";
import { useAuth } from "@/components/providers/AuthProvider";
import { cn } from "@/lib/utils";

const RETRY_DELAYS = [5, 10, 20];

export default function OfflinePage() {
  // Same test AppShell uses: signed in, this renders inside the shell (which
  // already carries the brand), so the page's own top bar would be a second one.
  const { user } = useAuth();
  const backupUrl = process.env.NEXT_PUBLIC_BACKUP_URL;
  const [attempts, setAttempts] = useState(0);
  const [countdown, setCountdown] = useState(RETRY_DELAYS[0]);
  const [primaryBack, setPrimaryBack] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkPrimary = useCallback(async () => {
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      const body = (await res.json().catch(() => null)) as {
        db?: string;
      } | null;
      if (res.ok && body?.db === "up") {
        setPrimaryBack(true);
        if (timerRef.current) clearInterval(timerRef.current);
        return true;
      }
    } catch {
      // Network or parse failure counts as a failed retry.
    }
    setAttempts((a) => a + 1);
    return false;
  }, []);

  useEffect(() => {
    void checkPrimary();
  }, [checkPrimary]);

  useEffect(() => {
    if (primaryBack) return;
    const delay = RETRY_DELAYS[Math.min(attempts, RETRY_DELAYS.length - 1)];
    setCountdown(delay);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          void checkPrimary();
          return RETRY_DELAYS[Math.min(attempts + 1, RETRY_DELAYS.length - 1)];
        }
        return c - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [attempts, primaryBack, checkPrimary]);

  const showBackup = attempts >= 2 && !!backupUrl;

  return (
    <div className={cn("flex flex-col bg-canvas text-text-primary", user ? "min-h-[70vh]" : "min-h-screen")}>
      {!user && (
        <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between border-b border-hairline bg-canvas/80 px-4 backdrop-blur-sm sm:px-8">
          <Wordmark />
          <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface px-2.5 py-1 font-mono text-xs font-medium text-text-tertiary">
            <span
              aria-hidden
              className={cn("h-1.5 w-1.5 rounded-full", primaryBack ? "bg-verified" : "bg-text-disabled")}
            />
            {primaryBack ? "Server back" : "Offline"}
          </span>
        </header>
      )}
      <div className="flex flex-1 items-center justify-center px-4 py-12 sm:py-20">
        <div className="mx-auto flex w-full max-w-[420px] flex-col items-center text-center">
          <div className="relative mb-6">
            <span className="flex h-16 w-16 items-center justify-center rounded-lg border border-hairline bg-surface text-text-secondary shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <WifiOff className="h-7 w-7" strokeWidth={1.5} aria-hidden />
            </span>
            <span aria-hidden className="absolute -right-1 -top-1 flex h-3 w-3">
              {!primaryBack && (
                <span className="absolute inline-flex h-full w-full rounded-full bg-error opacity-40 motion-safe:animate-ping" />
              )}
              <span
                className={cn(
                  "relative inline-flex h-3 w-3 rounded-full border-2 border-canvas",
                  primaryBack ? "bg-verified" : "bg-error"
                )}
              />
            </span>
          </div>
          <h1 className="mb-3 font-display text-2xl font-semibold leading-tight tracking-[-0.015em] text-text-primary sm:text-[26px]">
            You&apos;re offline
          </h1>
          {primaryBack ? (
            <p className="mb-8 max-w-[360px] text-[15px] leading-6 text-text-secondary">
              The primary server is back. Reload to continue where you left off.
            </p>
          ) : (
            <p className="mb-8 max-w-[360px] text-[15px] leading-6 text-text-secondary">
              This page needs a connection. A battle timer that&apos;s already running keeps
              counting on this device.
            </p>
          )}
          <div className="flex w-full flex-col items-stretch gap-3">
            <Button variant="primary" size="lg" className="h-11 w-full" onClick={() => window.location.reload()}>
              <RefreshCw className="h-4 w-4" strokeWidth={1.5} aria-hidden />
              {primaryBack ? "Back to the primary server" : "Try again"}
            </Button>
            {showBackup && (
              <div className="flex flex-col gap-1.5">
                <a
                  href={backupUrl}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-hairline bg-surface-overlay px-4 text-sm font-medium text-text-primary transition-colors hover:bg-[#272830]"
                >
                  <Server className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                  Open backup server
                </a>
                <p className="text-xs leading-5 text-text-tertiary">
                  The backup needs about a minute to wake up, and you will need to sign in again.
                </p>
              </div>
            )}
            <Link
              href="/home"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={1.5} aria-hidden />
              Back to Arena
            </Link>
          </div>
          <p className="mt-10 flex w-full items-center justify-center gap-2 border-t border-hairline pt-6 font-mono text-xs text-text-tertiary tnum">
            {primaryBack ? (
              <>
                <Check className="h-3.5 w-3.5 text-verified" strokeWidth={1.5} aria-hidden />
                Primary server is reachable
              </>
            ) : (
              <>
                <Server className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden />
                Retrying the primary server in {countdown}s · attempt {attempts + 1}
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
