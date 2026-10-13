"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";

export function Skeleton({
  className,
}: {
  className?: string;
}) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}

export function EmptyState({
  heading,
  body,
  action,
}: {
  heading: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card text-center">
      <h3 className="font-display text-xl font-semibold">{heading}</h3>
      <p className="mt-1 text-sm leading-6 text-text-secondary">{body}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function ErrorCard({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="card flex items-center justify-between gap-4">
      <p className="text-sm leading-6 text-text-secondary">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
