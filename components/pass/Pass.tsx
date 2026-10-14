"use client";

import React from "react";
import { cn } from "@/lib/utils";

export function Pass({
  body,
  stub,
  className,
}: {
  body: React.ReactNode;
  stub: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("pass", className)}>
      <div className="pass-body">{body}</div>
      <div className="pass-stub">{stub}</div>
    </div>
  );
}

export function PassSerial({ children }: { children: React.ReactNode }) {
  return <div className="pass-serial">{children}</div>;
}
