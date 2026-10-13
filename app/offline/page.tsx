"use client";

import Link from "next/link";
import { WifiOff, RotateCw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function OfflinePage() {
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
        <p className="mt-2 max-w-sm text-sm leading-6 text-text-secondary">
          This page needs a connection. A battle timer that&apos;s already running keeps
          counting on this device.
        </p>
        <div className="mt-6 flex w-full max-w-xs flex-col gap-2">
          <Button variant="primary" size="lg" className="w-full min-h-[44px]" onClick={() => window.location.reload()}>
            <RotateCw className="h-4 w-4" strokeWidth={1.5} />
            Try again
          </Button>
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
