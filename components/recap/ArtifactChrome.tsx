"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Swords, Users } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { cn } from "@/lib/utils";

/**
 * Chrome for the shareable squad artifacts (weekly recap, season summary).
 *
 * Signed out there is no app shell, so the frame brings its own gutters and a
 * quiet brand bar; signed in, the shell's <main> already provides both. The
 * gutter test mirrors AppShell's own (`user`), so the page never doubles or
 * drops its padding while auth resolves.
 */
export function ArtifactFrame({
  children,
  crumb,
  signInHref,
  className,
}: {
  children: React.ReactNode;
  /** Mono caption after the brand, e.g. the week or season name. */
  crumb?: React.ReactNode;
  /** Sign-in link for visitors; carries ?next= back to the artifact. */
  signInHref: string;
  className?: string;
}) {
  const { user } = useAuth();
  return (
    <div className={cn("mx-auto w-full", !user && "px-4 pb-12 pt-6 md:pt-10", className)}>
      {!user && (
        <div className="mb-8 flex items-center justify-between gap-3 border-b border-hairline pb-4 md:mb-10">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/"
              className="flex shrink-0 items-center gap-2 font-display text-lg font-semibold tracking-[-0.01em] text-text-primary"
            >
              <Swords className="h-[18px] w-[18px] text-text-secondary" strokeWidth={1.5} aria-hidden />
              Mahayuddh
            </Link>
            {crumb && (
              <>
                <span aria-hidden className="text-text-disabled">
                  /
                </span>
                <span className="truncate font-mono text-xs font-medium uppercase tracking-[0.06em] text-text-tertiary tnum">
                  {crumb}
                </span>
              </>
            )}
          </div>
          <Link
            href={signInHref}
            className="inline-flex min-h-[44px] shrink-0 items-center rounded-md px-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
          >
            Sign in
          </Link>
        </div>
      )}
      {children}
    </div>
  );
}

/** Rendered only once auth has resolved to "signed out", so members never see it flash. */
export function VisitorOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading || user) return null;
  return <>{children}</>;
}

/** Rendered only for a signed-in viewer. */
export function MemberOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return null;
  return <>{children}</>;
}

/**
 * The visitor close: the page's one gold action. Members already have a
 * squad, so they never see it.
 */
export function VisitorCta({ href, body }: { href: string; body: string }) {
  return (
    <VisitorOnly>
      <section className="relative overflow-hidden rounded-xl border border-hairline-strong bg-surface-raised p-5 md:p-10 md:text-center">
        <span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-hairline bg-surface px-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-text-secondary md:hidden">
          <Users className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
          Squads
        </span>
        <span
          aria-hidden
          className="mx-auto mb-5 hidden h-12 w-12 items-center justify-center rounded-full border border-hairline bg-surface text-text-secondary md:flex"
        >
          <Users className="h-6 w-6" strokeWidth={1.5} />
        </span>
        <h2 className="mt-3 type-title text-text-primary md:mt-0">Practice with your own people.</h2>
        <p className="mt-2 text-[15px] leading-6 text-text-secondary md:mx-auto md:max-w-md">{body}</p>
        <Link
          href={href}
          className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary px-6 text-sm font-medium leading-5 text-on-primary transition-colors hover:bg-primary-hover active:bg-primary-pressed md:h-11 md:w-auto"
        >
          Start your squad
          <ArrowRight className="h-4 w-4" strokeWidth={1.5} aria-hidden />
        </Link>
      </section>
    </VisitorOnly>
  );
}
