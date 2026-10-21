"use client";

import Link from "next/link";
import { Play } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { cn } from "@/lib/utils";

/**
 * The proof page's one gold action. A visitor goes to sign-up with ?next=
 * back to the proof; a member is already signed in, so sending them through
 * /login would just bounce them back here — they go straight to the problem.
 */
export function TryProblemLink({
  slug,
  signupHref,
  className,
}: {
  slug: string;
  /** Visitor destination: sign-up carrying ?next= back to this proof. */
  signupHref: string;
  className?: string;
}) {
  const { user } = useAuth();
  return (
    <Link
      href={user ? `/practice/${encodeURIComponent(slug)}` : signupHref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md bg-primary px-6 text-sm font-medium leading-5 text-on-primary transition-colors hover:bg-primary-hover active:bg-primary-pressed",
        className
      )}
    >
      <Play className="h-4 w-4" strokeWidth={1.5} fill="currentColor" aria-hidden />
      Try this problem
    </Link>
  );
}
