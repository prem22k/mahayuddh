import { Skeleton } from "@/components/ui/States";
import { AuthCard, AuthFrame } from "@/components/auth/AuthChrome";
import { LoadingStatus, Repeat, SkeletonLine } from "./parts";

/**
 * The auth form while it hydrates or checks a link (/login,
 * /auth/update-password): the real frame and card, with the segmented
 * sign-in/join control, the fields and the submit button as skeletons.
 */
export function AuthSkeleton({ tabs = true, label = "Loading sign in" }: { tabs?: boolean; label?: string }) {
  return (
    <AuthFrame
      intro={
        <div aria-hidden>
          <SkeletonLine className="h-[30px] md:h-6 md:justify-center" bar="h-5 md:h-3.5" width="w-64 max-w-full" />
          <SkeletonLine className="mt-1 h-5 md:hidden" bar="h-3" width="w-56" />
        </div>
      }
    >
      <LoadingStatus label={label} />
      <AuthCard>
        <div aria-hidden>
          {tabs && <Skeleton className="mb-4 h-[52px] w-full rounded-md md:mb-6 md:h-9" />}
          <div className="space-y-4">
            <Repeat count={2}>
              {(i) => (
                <div key={i}>
                  <SkeletonLine className="mb-1.5 h-4" bar="h-2.5" width={i ? "w-16" : "w-12"} />
                  <Skeleton className="h-11 w-full rounded-md md:h-10" />
                </div>
              )}
            </Repeat>
            <Skeleton className="h-11 w-full rounded-md md:h-10" />
          </div>
        </div>
      </AuthCard>
    </AuthFrame>
  );
}
