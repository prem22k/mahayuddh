"use client";

import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";
import { OAUTH_PROVIDERS, type OAuthProviderId } from "@/lib/auth/providers";
import { PROVIDER_MARKS } from "@/components/auth/ProviderMarks";

const LABEL = Object.fromEntries(OAUTH_PROVIDERS.map((p) => [p.id, p.label])) as Record<
  OAuthProviderId,
  string
>;

export function providerLabel(id: OAuthProviderId): string {
  return LABEL[id];
}

/**
 * Social sign-in buttons followed by the "or with email" rule.
 *
 * Layout follows the count: one provider gets a full-width "Continue with X";
 * two share a row; three or more sit in a three-column grid of mark + name
 * (two columns below 390px, where three would truncate "LinkedIn"), so six
 * providers are two or three tidy rows at every width down to 320px. Each button is
 * 44px tall and announces "Continue with <Provider>".
 *
 * While one provider is redirecting, it shows a spinner and every button is
 * disabled, so a double tap can't start two flows.
 */
export function SocialSignIn({
  providers,
  busy,
  onSelect,
  heading,
}: {
  providers: OAuthProviderId[];
  busy: OAuthProviderId | null;
  onSelect: (id: OAuthProviderId) => void;
  /** Section label above the buttons (the Join form uses "Create your account"). */
  heading?: string;
}) {
  if (providers.length === 0) return null;
  const single = providers.length === 1;

  return (
    <div className={cn(heading && "border-t border-hairline pt-4")}>
      {heading && <p className="mb-2.5 text-xs font-medium text-text-secondary">{heading}</p>}
      <div
        className={cn(
          "grid gap-2",
          single ? "grid-cols-1" : providers.length === 2 ? "grid-cols-2" : "grid-cols-2 min-[390px]:grid-cols-3"
        )}
      >
        {providers.map((id) => {
          const Mark = PROVIDER_MARKS[id];
          const isBusy = busy === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              disabled={busy !== null}
              aria-label={`Continue with ${LABEL[id]}`}
              aria-busy={isBusy || undefined}
              className={cn(
                "inline-flex h-11 min-w-0 items-center justify-center gap-2 rounded-md border border-hairline bg-surface-raised px-2 text-[13px] font-medium text-text-primary transition-colors md:h-10",
                "hover:border-hairline-strong hover:bg-surface-overlay",
                "disabled:cursor-not-allowed disabled:opacity-60"
              )}
            >
              {isBusy ? (
                <Spinner size="sm" />
              ) : (
                <Mark className="h-[18px] w-[18px] shrink-0" />
              )}
              <span className="truncate">{single ? `Continue with ${LABEL[id]}` : LABEL[id]}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-hairline" />
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-tertiary">
          or with email
        </span>
        <span className="h-px flex-1 bg-hairline" />
      </div>
    </div>
  );
}
