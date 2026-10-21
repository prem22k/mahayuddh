"use client";

import React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { chainState } from "@/lib/chains";
import { Avatar } from "@/components/ui/Avatar";
import type { Suggestion } from "@/types/database";
import { challengeStatus, fmtClock, fmtDelta } from "./challengeFormat";

/** Neutral status chip for rows and the phone stub (Open / Solved / Expired…). */
export function ChallengeStatusChip({
  item,
  className,
}: {
  item: Pick<Suggestion, "status" | "deadline_at" | "accepted_at">;
  className?: string;
}) {
  const s = challengeStatus(item);
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-xs border px-2 font-mono text-[11px] font-medium leading-4 tracking-[0.02em]",
        s.key === "solved"
          ? "border-hairline-strong bg-surface-raised text-text-primary"
          : s.key === "expired" || s.key === "declined"
            ? "border-hairline bg-well text-text-tertiary"
            : "border-hairline bg-surface-raised text-text-secondary",
        className
      )}
    >
      {s.key === "solved" ? (
        <Check className="h-3 w-3" strokeWidth={2} aria-hidden />
      ) : s.key === "open" || s.key === "accepted" ? (
        <span
          aria-hidden
          className={cn("h-1.5 w-1.5 rounded-full", s.key === "accepted" ? "bg-text-primary" : "bg-text-secondary")}
        />
      ) : null}
      {s.label}
    </span>
  );
}

type NodeTone = "origin" | "solved" | "passed" | "current" | "ended";

interface ChainNode {
  key: string;
  name: string;
  avatar: string | null;
  caption: string;
  tone: NodeTone;
  /** Measured time this person set (their sender time when passing it on). */
  sec: number | null;
}

/**
 * People in a challenge chain, oldest first: the originator, then each
 * recipient. Times come only from `sender_time_sec` — what each person set
 * when they sent or passed it on — so a node without one shows no time.
 */
export function buildChainNodes(chain: Suggestion[], viewerId?: string | null): ChainNode[] {
  if (chain.length === 0) return [];
  const root = chain[0];
  const nodes: ChainNode[] = [
    {
      key: `origin-${root.id}`,
      name: root.from_user === viewerId ? "You" : root.from_profile?.username ? `@${root.from_profile.username}` : "Member",
      avatar: root.from_profile?.avatar_url ?? null,
      caption: fmtClock(root.sender_time_sec) ? `Solved ${fmtClock(root.sender_time_sec)}` : "Started it",
      tone: "origin",
      sec: root.sender_time_sec,
    },
  ];
  chain.forEach((hop, i) => {
    const next = chain[i + 1];
    const state = chainState(hop);
    const isLeaf = i === chain.length - 1;
    const sec = next?.sender_time_sec ?? null;
    let tone: NodeTone;
    let caption: string;
    if (state === "completed") {
      tone = "solved";
      caption = fmtClock(sec) ?? "Solved";
    } else if (state === "broken" || state === "timed_out") {
      tone = "ended";
      caption = state === "broken" ? "Declined" : "Expired";
    } else if (isLeaf) {
      tone = "current";
      caption = fmtClock(hop.sender_time_sec) ? `Target ${fmtClock(hop.sender_time_sec)}` : "Up now";
    } else {
      tone = "passed";
      caption = fmtClock(sec) ?? "Passed on";
    }
    nodes.push({
      key: `hop-${hop.id}`,
      name: hop.to_user === viewerId ? "You" : hop.to_profile?.username ? `@${hop.to_profile.username}` : "Member",
      avatar: hop.to_profile?.avatar_url ?? null,
      caption,
      tone,
      sec,
    });
  });
  return nodes;
}

/** `@prem → @rahul → You` for chain headers. */
export function chainNames(chain: Suggestion[], viewerId?: string | null): string {
  return buildChainNodes(chain, viewerId)
    .map((n) => n.name)
    .join(" → ");
}

function NodeDot({ node, size }: { node: ChainNode; size: "sm" | "md" }) {
  return (
    <span className="relative inline-flex shrink-0">
      <Avatar
        name={node.name.replace(/^@/, "")}
        src={node.avatar}
        size={size === "md" ? "md" : "sm"}
        className={cn(
          "border",
          size === "md" && "h-9 w-9",
          node.tone === "current"
            ? "border-text-primary text-text-primary"
            : node.tone === "ended"
              ? "border-hairline text-text-disabled"
              : "border-hairline-strong"
        )}
      />
      {node.tone === "solved" && (
        <span
          aria-hidden
          className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-surface bg-text-primary text-canvas"
        >
          <Check className="h-2.5 w-2.5" strokeWidth={2.5} />
        </span>
      )}
    </span>
  );
}

function nodeTextCls(tone: NodeTone) {
  return tone === "ended" ? "text-text-disabled line-through" : "text-text-primary";
}

/**
 * The chain as a horizontal track. `compact` is the inline strip inside a
 * challenge row; `full` is the /c/[id] chain card with time gaps on the wire.
 */
export function ChainTrack({
  chain,
  viewerId,
  variant = "compact",
  className,
}: {
  chain: Suggestion[];
  viewerId?: string | null;
  variant?: "compact" | "full";
  className?: string;
}) {
  const nodes = buildChainNodes(chain, viewerId);
  if (nodes.length < 2) return null;
  const label = `Challenge chain: ${nodes.map((n) => `${n.name} ${n.caption}`).join(", then ")}`;

  if (variant === "compact") {
    return (
      <ol
        aria-label={label}
        className={cn(
          "flex items-center overflow-x-auto rounded-md border border-hairline bg-well p-3 [scrollbar-width:none]",
          className
        )}
      >
        {nodes.map((n, i) => (
          <React.Fragment key={n.key}>
            {i > 0 && (
              <li aria-hidden className="mx-2 h-px min-w-4 flex-1 bg-hairline-strong md:mx-4 md:max-w-[120px]" />
            )}
            <li className="flex shrink-0 flex-col items-center gap-0.5 md:flex-row md:items-center md:gap-2.5">
              <span className="hidden md:inline-flex">
                <NodeDot node={n} size="sm" />
              </span>
              <span className="flex flex-col items-center md:items-start">
                <span className={cn("max-w-[96px] truncate text-xs font-medium leading-4", nodeTextCls(n.tone))}>
                  {n.name}
                </span>
                <span
                  className={cn(
                    "font-mono text-[11px] leading-4 tnum",
                    n.tone === "current" ? "text-text-primary" : "text-text-tertiary"
                  )}
                >
                  {n.caption}
                </span>
              </span>
            </li>
          </React.Fragment>
        ))}
      </ol>
    );
  }

  return (
    <ol aria-label={label} className={cn("flex items-start overflow-x-auto pb-1 [scrollbar-width:none]", className)}>
      {nodes.map((n, i) => {
        const prev = nodes[i - 1];
        const gap = prev && prev.sec != null && n.sec != null ? fmtDelta(n.sec - prev.sec) : null;
        return (
          <React.Fragment key={n.key}>
            {i > 0 && (
              <li aria-hidden className="relative h-9 min-w-8 flex-1">
                <span className="absolute inset-x-0 top-1/2 h-px bg-hairline-strong" />
                {gap && (
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-xs border border-hairline bg-well px-2 py-0.5 font-mono text-[10px] leading-4 text-text-tertiary tnum">
                    {gap}
                  </span>
                )}
              </li>
            )}
            <li className="flex w-[84px] shrink-0 flex-col items-center text-center md:w-[112px]">
              <NodeDot node={n} size="md" />
              <span className={cn("mt-1.5 max-w-full truncate text-xs font-medium leading-4", nodeTextCls(n.tone))}>
                {n.name}
              </span>
              <span
                className={cn(
                  "mt-0.5 font-mono text-[11px] leading-4 tnum",
                  n.tone === "current" ? "text-text-primary" : "text-text-tertiary"
                )}
              >
                {n.caption}
              </span>
            </li>
          </React.Fragment>
        );
      })}
    </ol>
  );
}
