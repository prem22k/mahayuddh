import React from "react";
import { CircleAlert, CircleCheck, Eye, EyeOff } from "lucide-react";
import { Wordmark } from "@/components/landing/Brand";
import { cn } from "@/lib/utils";

/**
 * Shared chrome for the logged-out auth surfaces (/login, /auth/update-password),
 * laid out from the Stitch "Sign in & Join" frames.
 *
 * Desktop centres a 440px column under the wordmark. Mobile gets a slim top
 * bar instead and starts the column at the top, so the keyboard never hides
 * the field being typed into. These pages render without the app shell.
 */
export function AuthFrame({
  intro,
  children,
}: {
  /** Heading block under the wordmark (left-aligned on mobile, centred on desktop). */
  intro?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen select-none flex-col bg-canvas text-text-primary">
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center border-b border-hairline bg-surface/80 px-4 backdrop-blur md:hidden">
        <Wordmark />
      </header>
      <div className="flex flex-1 flex-col items-center px-4 pb-12 pt-5 md:justify-center md:py-16">
        <div className="w-full max-w-[440px]">
          <div className="mb-4 md:mb-6 md:text-center">
            <Wordmark
              size="lg"
              className="mb-2 hidden md:inline-flex"
              textClassName="text-2xl"
            />
            {intro}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

/** The form card: surface, hairline, 12px radius, inner top highlight. */
export function AuthCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "w-full rounded-lg border border-hairline bg-surface p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] md:p-6",
        className
      )}
    >
      {children}
    </div>
  );
}

/** Error / success notice. Render inside a persistent aria-live region. */
export function AuthAlert({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: React.ReactNode;
}) {
  const Icon = tone === "error" ? CircleAlert : CircleCheck;
  return (
    <div
      className={cn(
        "mb-4 flex items-start gap-2.5 rounded-md border p-3 text-xs leading-5",
        tone === "error"
          ? "border-error/30 bg-error-tint text-error"
          : "border-verified/30 bg-verified-tint text-verified"
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** Eye toggle inside a password input. Keeps a 44px hit area on touch. */
export function PasswordToggle({
  shown,
  onToggle,
}: {
  shown: boolean;
  onToggle: () => void;
}) {
  const Icon = shown ? EyeOff : Eye;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={shown}
      aria-label={shown ? "Hide password" : "Show password"}
      title={shown ? "Hide password" : "Show password"}
      className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-md text-text-tertiary transition-colors hover:text-text-primary md:w-10"
    >
      <Icon className="h-4 w-4" strokeWidth={1.5} aria-hidden />
    </button>
  );
}

export const authInputCls =
  "w-full h-11 md:h-10 rounded-md border border-hairline bg-well px-3 text-sm text-text-primary placeholder:text-text-disabled transition-colors hover:border-hairline-strong focus:border-[rgba(255,255,255,0.28)] focus:shadow-[0_0_0_2px_rgba(237,237,239,0.2)] focus:outline-none";

export const authLabelCls = "mb-1.5 block text-xs font-medium text-text-secondary";
