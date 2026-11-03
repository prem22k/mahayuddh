"use client";

import React from "react";
import Link from "next/link";
import { LogoMark } from "@/components/landing/Brand";
import { cn } from "@/lib/utils";

export interface ErrorAction {
  label: string;
  href?: string;
  onClick?: () => void;
  primary?: boolean;
}

export interface ErrorScreenProps {
  code?: string;
  title: string;
  body: string;
  actions?: ErrorAction[];
  detail?: string;
  variant: "page" | "inline";
  children?: React.ReactNode;
}

export function ErrorScreen({
  code,
  title,
  body,
  actions,
  detail,
  variant,
  children,
}: ErrorScreenProps) {
  const containerClasses =
    variant === "page"
      ? "min-h-screen w-full flex flex-col items-center justify-center px-4 py-12 sm:py-20 bg-canvas text-text-primary"
      : "w-full min-h-[50vh] flex flex-col items-center justify-center px-4 py-12 sm:py-16 text-center text-text-primary";

  return (
    <div
      className={containerClasses}
      role={code === "404" ? undefined : "alert"}
    >
      <div className="mx-auto flex w-full max-w-[440px] flex-col items-center text-center">
        <div className="mb-4 flex items-center justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-xl border border-hairline bg-surface text-text-secondary shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <LogoMark className="h-7 w-7" />
          </span>
        </div>

        {code && (
          <p className="mb-2 font-mono text-4xl font-light tracking-tight text-text-tertiary select-none sm:text-5xl">
            {code}
          </p>
        )}

        <h1 className="font-display text-2xl font-semibold leading-tight tracking-[-0.015em] text-text-primary sm:text-[28px]">
          {title}
        </h1>

        <p className="mt-2 max-w-sm text-[15px] leading-6 text-text-secondary">
          {body}
        </p>

        {detail && (
          <p className="mt-2 font-mono text-xs text-text-tertiary">{detail}</p>
        )}

        {actions && actions.length > 0 && (
          <div className="mt-6 flex w-full flex-col items-stretch justify-center gap-2.5 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
            {actions.map((action) => {
              const isPrimary = Boolean(action.primary);
              const btnClass = cn(
                "inline-flex min-h-[44px] items-center justify-center px-4 py-2.5 rounded-md text-sm font-medium transition-colors select-none text-center cursor-pointer",
                isPrimary
                  ? "bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-pressed"
                  : "border border-hairline bg-surface-overlay text-text-primary hover:bg-surface-raised active:bg-surface"
              );

              if (action.href) {
                const isExternal =
                  action.href.startsWith("http://") ||
                  action.href.startsWith("https://");
                if (isExternal) {
                  return (
                    <a
                      key={action.label}
                      href={action.href}
                      className={btnClass}
                      rel="noopener noreferrer"
                    >
                      {action.label}
                    </a>
                  );
                }
                return (
                  <Link key={action.label} href={action.href} className={btnClass}>
                    {action.label}
                  </Link>
                );
              }

              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={action.onClick}
                  className={btnClass}
                >
                  {action.label}
                </button>
              );
            })}
          </div>
        )}

        {children && <div className="mt-4 w-full">{children}</div>}
      </div>
    </div>
  );
}
