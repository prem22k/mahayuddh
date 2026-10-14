"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { WifiOff, RotateCw, ArrowLeft, Server } from "lucide-react";
import { Button } from "@/components/ui/Button";

const RETRY_DELAYS = [5, 10, 20];

export default function OfflinePage() {
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
    <div className="min-h-screen bg-canvas text-text-primary">
      <header className="flex h-14 items-center px-4 md:px-10">
        <Link href="/welcome" className="font-display text-lg font-semibold tracking-tight">
          Mahayuddh
        </Link>
      </header>
      <main className="mx-auto flex min-h-[70vh] w-full max-w-reading flex-col items-center justify-center px-4 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-hairline bg-surface text-text-secondary">
          <WifiOff className="h-5 w-5" strokeWidth={1.5} />
        </span>
        <h1 className="mt-5 font-display text-2xl font-semibold leading-[29px] tracking-tight">
          You&apos;re offline
        </h1>
        {primaryBack ? (
          <p className="mt-2 max-w-sm text-sm leading-6 text-text-secondary">
            The primary server is back. Reload to continue where you left off.
          </p>
        ) : (
          <p className="mt-2 max-w-sm text-sm leading-6 text-text-secondary">
            This page needs a connection. A battle timer that&apos;s already running keeps
            counting on this device. Retrying the primary server in {countdown}s
            (attempt {attempts + 1}).
          </p>
        )}
        <div className="mt-6 flex w-full max-w-xs flex-col gap-2">
          {primaryBack ? (
            <Button variant="primary" size="lg" className="w-full min-h-[44px]" onClick={() => window.location.reload()}>
              <RotateCw className="h-4 w-4" strokeWidth={1.5} />
              Back to the primary server
            </Button>
          ) : (
            <Button variant="primary" size="lg" className="w-full min-h-[44px]" onClick={() => window.location.reload()}>
              <RotateCw className="h-4 w-4" strokeWidth={1.5} />
              Try again
            </Button>
          )}
          {showBackup && (
            <div className="flex flex-col gap-1">
              <a
                href={backupUrl}
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-md bg-surface-overlay px-3 text-sm font-medium text-text-primary transition-colors hover:brightness-110"
              >
                <Server className="h-4 w-4" strokeWidth={1.5} />
                Open backup server
              </a>
              <p className="text-xs leading-5 text-text-tertiary">
                The backup needs about a minute to wake up, and you will need to sign in again.
              </p>
            </div>
          )}
          <Link
            href="/home"
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
            Back to Arena
          </Link>
        </div>
      </main>
    </div>
  );
}
