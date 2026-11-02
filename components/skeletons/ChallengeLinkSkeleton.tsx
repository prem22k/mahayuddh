"use client";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/States";
import { useAuth } from "@/components/providers/AuthProvider";
import { LoadingStatus } from "./parts";

/**
 * /c/[id] while the challenge loads: the challenge pass. Signed out there is
 * no app shell, so the frame brings its own gutters, exactly like the page.
 */
export function ChallengeLinkSkeleton() {
  const { user } = useAuth();
  return (
    <div className={cn("mx-auto w-full max-w-[780px] space-y-4", !user && "px-4 pb-12 pt-6 md:pt-10")}>
      <LoadingStatus label="Loading challenge" />
      <div className="pass" aria-hidden>
        <div className="pass-body space-y-4">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-48" />
          <Skeleton className="h-12 w-full" />
        </div>
        <div className="pass-stub">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
    </div>
  );
}
