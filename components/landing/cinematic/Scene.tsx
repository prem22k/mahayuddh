"use client";

import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useScrollProgress } from "./motion";
import styles from "./landing.module.css";

/* ── Button recipes (DESIGN.md button tokens at landing scale) ── */

export const btnGold =
  "inline-flex h-12 items-center justify-center gap-2 rounded-md bg-primary px-6 text-[15px] font-medium text-on-primary transition-colors duration-150 ease-out hover:bg-primary-hover active:bg-primary-pressed";

export const btnSecondary =
  "inline-flex h-11 items-center justify-center gap-2 rounded-md border border-hairline-strong bg-surface-overlay px-4 text-sm font-medium text-text-primary transition-colors duration-150 ease-out hover:bg-[#272830] disabled:cursor-default disabled:border-hairline disabled:bg-surface-overlay disabled:text-text-disabled md:h-10";

export const btnGhost =
  "inline-flex h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium text-text-secondary transition-colors duration-150 ease-out hover:bg-surface-raised hover:text-text-primary md:h-10";

/* ── Statement: a short sentence set very large ─────────────────
   Words light up as the sentence crosses the reading line. Parts let a
   measured value (a solve time) sit inside the sentence in mono. */

type Part = string | { mono: string };

const statementSize = {
  hero: "text-[clamp(2.75rem,0.6rem+6.6vw,6rem)] leading-[0.95] tracking-[-0.038em]",
  xl: "text-[clamp(2.6rem,0.9rem+5.4vw,5.75rem)] leading-[0.97] tracking-[-0.036em]",
  lg: "text-[clamp(2.4rem,1rem+4.2vw,4.75rem)] leading-[0.98] tracking-[-0.032em]",
} as const;

export function Statement({
  parts,
  as: Tag = "h2",
  size = "xl",
  className,
  id,
}: {
  parts: Part[];
  as?: "h1" | "h2" | "p";
  size?: keyof typeof statementSize;
  className?: string;
  id?: string;
}) {
  const ref = useScrollProgress<HTMLHeadingElement>(0.92, 0.42);
  let i = 0;
  const nodes: ReactNode[] = [];
  parts.forEach((part, pi) => {
    const mono = typeof part !== "string";
    const text = mono ? part.mono : part;
    text.split(/(\s+)/).forEach((tok, ti) => {
      if (!tok) return;
      if (/^\s+$/.test(tok)) {
        nodes.push(" ");
        return;
      }
      nodes.push(
        <span
          key={`${pi}-${ti}`}
          className={cn(styles.word, mono && styles.monoWord)}
          style={{ "--i": i++ } as CSSProperties}
        >
          {tok}
        </span>
      );
    });
  });
  return (
    <Tag
      ref={ref}
      id={id}
      className={cn(
        styles.statement,
        styles.far,
        "text-balance font-display font-semibold text-text-primary",
        statementSize[size],
        className
      )}
      style={{ "--n": i } as CSSProperties}
    >
      {nodes}
    </Tag>
  );
}

/** The supporting line under a statement. */
export function Aside({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        styles.far,
        "max-w-[34rem] text-[17px] leading-7 text-text-secondary md:text-lg md:leading-[30px]",
        className
      )}
    >
      {children}
    </p>
  );
}

/* ── Stage: a real piece rising into its own pool of light ────── */

const ENTER = {
  rise: styles.enterRise,
  turnRight: styles.enterTurnRight,
  turnLeft: styles.enterTurnLeft,
  dolly: styles.enterDolly,
  none: "",
} as const;

export function Stage({
  children,
  className,
  light = true,
  floor = true,
  enter = "rise",
}: {
  children: ReactNode;
  className?: string;
  light?: boolean;
  floor?: boolean;
  enter?: keyof typeof ENTER;
}) {
  const ref = useScrollProgress<HTMLDivElement>(1.02, 0.58);
  return (
    <div ref={ref} className={cn(styles.stage, styles.near, className)}>
      {light && <div aria-hidden className={styles.stageLight} />}
      <div className={cn(styles.stageBody, ENTER[enter])}>
        {children}
        {floor && <div aria-hidden className={styles.floor} />}
      </div>
    </div>
  );
}

/* ── The Pass, with real cut notches ───────────────────────────── */

export function StagePass({
  body,
  stub,
  className,
  bodyClassName,
  stubClassName,
  style,
  children,
}: {
  body: ReactNode;
  stub: ReactNode;
  className?: string;
  bodyClassName?: string;
  stubClassName?: string;
  /** e.g. { "--stub-h": "132px" } when a portrait stub needs more room */
  style?: CSSProperties;
  /** overlays (the hero sheen) */
  children?: ReactNode;
}) {
  return (
    <div className={cn(styles.pass, className)} style={style}>
      <div className={cn(styles.passBody, "p-5 sm:p-7 lg:p-9", bodyClassName)}>{body}</div>
      <div
        className={cn(
          styles.passStub,
          "grid grid-cols-2 content-center gap-x-4 gap-y-3 p-4 md:flex md:flex-col md:justify-center md:gap-4 md:p-6",
          stubClassName
        )}
      >
        {stub}
      </div>
      {children}
    </div>
  );
}

/** A stub serial line: tiny caps label over a mono value. */
export function Serial({
  label,
  children,
  tone = "default",
}: {
  label: string;
  children: ReactNode;
  tone?: "default" | "verified" | "muted";
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 font-mono tracking-[0.06em]">
      <span className="text-[10px] font-medium uppercase leading-4 text-text-tertiary">{label}</span>
      <span
        className={cn(
          "truncate text-xs font-medium uppercase leading-4 tnum",
          tone === "verified" && "text-verified",
          tone === "muted" && "text-text-secondary",
          tone === "default" && "text-text-primary"
        )}
      >
        {children}
      </span>
    </div>
  );
}

/** Every demo piece names itself as an example: these people are not real. */
export function ExampleTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center rounded-xs border border-hairline px-1.5 text-[11px] font-medium leading-4 text-text-tertiary",
        className
      )}
    >
      Example
    </span>
  );
}

/** A beat of the page: generous vertical rhythm, one gutter for everything. */
export function Beat({
  id,
  children,
  className,
  label,
}: {
  id?: string;
  children: ReactNode;
  className?: string;
  label: string;
}) {
  // --b: where this beat sits in the viewport, for the far/near depth layers.
  const ref = useScrollProgress<HTMLElement>(1, 0, "--b", "center");
  return (
    <section
      ref={ref}
      id={id}
      aria-label={label}
      className={cn("relative scroll-mt-20 py-[clamp(4.5rem,10vw,8.5rem)]", className)}
    >
      <div className={cn(styles.beatCam, "mx-auto w-full max-w-[1200px] px-4 md:px-10")}>{children}</div>
    </section>
  );
}
