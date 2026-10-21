"use client";

import { useEffect, useState } from "react";
import { Check, Link2, MessageCircle, MessageSquare, Send, Share2 } from "lucide-react";
import { copyText } from "@/lib/clipboard";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { shareTargets, withVia, type ShareArtifact, type ShareTarget } from "@/lib/share";

type ExpandedTarget = ShareTarget["id"] | "discord";
const EXPANDED_TARGETS: ExpandedTarget[] = ["whatsapp", "telegram", "x", "linkedin", "discord"];

/** Neutral glyphs: lucide carries no brand marks, and brand colors are not tokens. */
function TargetGlyph({ id }: { id: ShareTarget["id"] }) {
  if (id === "whatsapp") return <MessageCircle className="h-4 w-4" strokeWidth={1.5} aria-hidden />;
  if (id === "telegram") return <Send className="h-4 w-4" strokeWidth={1.5} aria-hidden />;
  // The label "X" is already the mark; a glyph beside it would read "X X".
  if (id === "x") return null;
  return (
    <span aria-hidden className="inline-flex h-4 w-4 items-center justify-center font-mono text-[12px] font-semibold leading-none">
      in
    </span>
  );
}

/**
 * Share row (Bible §40, §56).
 *
 * Three affordances, in the order people reach for them: the OS share sheet on
 * mobile, copy-link as the universal fallback, and platform intents for the
 * groups this product is actually shared in.
 *
 * The link is generated with ?via= so the signup it produces can be credited
 * back to this artifact. `share_clicked` fires once per press regardless of
 * which affordance was used, because "copied" and "posted to WhatsApp" are the
 * same decision from the loop's point of view.
 *
 * `compact` folds the row into one button (Stitch's single "Share" ghost
 * button): the OS share sheet where there is one, otherwise the same target
 * menu with a plain copy-link entry. `expanded` lays every target out as its
 * own labeled button (Stitch's share card on recaps and seasons): copy link
 * first, then the platform intents. Default rendering is unchanged.
 */
export function ShareRow({
  path,
  text,
  artifact,
  label = "Share",
  onCopied,
  compact = false,
  expanded = false,
  targets,
  className,
}: {
  /** Absolute or root-relative URL of the artifact. */
  path: string;
  /** The message body, without the URL — shareTargets appends it. */
  text: string;
  artifact: ShareArtifact;
  label?: string;
  onCopied?: (ok: boolean) => void;
  /** One "Share" button instead of three. Optional; off by default. */
  compact?: boolean;
  /** Copy link plus one labeled button per target. Optional; off by default. */
  expanded?: boolean;
  /**
   * With `expanded`: which targets to show, in order. "discord" is a copy
   * button (Discord has no share intent). Defaults to every target.
   */
  targets?: ExpandedTarget[];
  /** Extra classes for the compact trigger, or the expanded button group. */
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  // Expanded intents render on first paint; until mount they use the
  // root-relative link so the server and client markup agree.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const withSlug = (p: string): string =>
    p.startsWith("http") ? withVia(p, artifact) : withVia(p, artifact);

  const absolute = (): string => {
    const base = typeof window === "undefined" ? "" : window.location.origin;
    return withSlug(`${base}${path.startsWith("/") ? path : `/${path}`}`);
  };

  const body = (): string => {
    const url = absolute();
    return text.includes("http") ? text : `${text}\n${url}`;
  };

  const fire = (via: string) => track("share_clicked", { artifact: artifact.kind, via });

  const handleCopy = async () => {
    const ok = await copyText(body());
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
    fire("copy");
    onCopied?.(ok);
  };

  const handleNative = async () => {
    const nav = navigator as Navigator & {
      share?: (data: ShareData) => Promise<void>;
      canShare?: (data: ShareData) => boolean;
    };
    if (nav.share) {
      try {
        await nav.share({ title: "Mahayuddh", text: body(), url: absolute() });
        fire("native");
        return;
      } catch {
        // The user dismissed the sheet. That is not a failure worth reporting.
        return;
      }
    }
    await handleCopy();
  };

  const menu = open ? (
    <>
      <button
        aria-hidden
        tabIndex={-1}
        onClick={() => setOpen(false)}
        className="fixed inset-0 z-10 cursor-default"
      />
      <div className="absolute right-0 top-full mt-1.5 z-20 min-w-[9.5rem] popover-panel p-1.5">
        {shareTargets(absolute(), body()).map((t) => (
          <a
            key={t.id}
            href={t.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              fire(t.id);
              setOpen(false);
            }}
            className="block px-3 py-2 rounded-xl text-[11px] font-bold text-text-secondary hover:text-text-primary hover:bg-surface-overlay transition-all"
          >
            {t.label}
          </a>
        ))}
        <button
          onClick={() => {
            setOpen(false);
            void handleCopy();
          }}
          className="block w-full text-left px-3 py-2 rounded-xl text-[11px] font-bold text-text-secondary hover:text-text-primary hover:bg-surface-overlay transition-all"
        >
          {compact ? "Copy link" : "Copy for Discord"}
        </button>
      </div>
    </>
  ) : null;

  if (expanded) {
    const order = targets ?? EXPANDED_TARGETS;
    const shareUrl = mounted ? absolute() : withSlug(path.startsWith("/") ? path : `/${path}`);
    const shareBody = text.includes("http") ? text : `${text}\n${shareUrl}`;
    const intents = new Map(shareTargets(shareUrl, shareBody).map((t) => [t.id, t]));
    const tile =
      "inline-flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-md border border-hairline bg-surface-raised px-2.5 text-xs font-medium text-text-secondary transition-colors hover:border-hairline-strong hover:bg-surface-overlay hover:text-text-primary md:h-10 md:min-h-0 md:flex-row md:gap-2 md:px-3.5";
    return (
      <div className={cn("grid grid-cols-3 gap-2 md:flex md:flex-wrap md:items-center", className)}>
        <button type="button" onClick={() => void handleCopy()} className={cn(tile, "text-text-primary")}>
          {copied ? (
            <Check className="h-4 w-4 text-verified" strokeWidth={1.5} aria-hidden />
          ) : (
            <Link2 className="h-4 w-4" strokeWidth={1.5} aria-hidden />
          )}
          {copied ? "Copied" : "Copy link"}
        </button>
        {order.map((id) => {
          if (id === "discord") {
            return (
              <button
                key={id}
                type="button"
                onClick={() => void handleCopy()}
                title="Copy for Discord"
                className={tile}
              >
                <MessageSquare className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                Discord
              </button>
            );
          }
          const t = intents.get(id);
          if (!t) return null;
          return (
            <a
              key={id}
              href={t.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => fire(t.id)}
              className={tile}
            >
              <TargetGlyph id={id} />
              {t.label}
            </a>
          );
        })}
      </div>
    );
  }

  if (compact) {
    const handleCompact = async () => {
      // Desktop browsers without a share sheet get the target menu instead.
      if (typeof navigator !== "undefined" && "share" in navigator) {
        await handleNative();
        return;
      }
      setOpen((v) => !v);
    };
    return (
      <div className="relative">
        <button
          onClick={() => void handleCompact()}
          aria-expanded={open}
          aria-haspopup="menu"
          title="Share"
          className={cn(
            "inline-flex h-8 min-h-[44px] items-center justify-center gap-1.5 rounded-md border border-hairline bg-surface-raised px-3 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-overlay hover:text-text-primary md:min-h-0",
            className
          )}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-verified" strokeWidth={1.5} />
          ) : (
            <Share2 className="h-3.5 w-3.5" strokeWidth={1.5} />
          )}
          {copied ? "Copied" : label}
        </button>
        {menu}
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5">
        <button
          onClick={handleNative}
          className="px-3 py-1.5 rounded-full bg-surface-overlay hover:bg-surface-raised border border-hairline text-text-primary text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5"
          title="Share"
        >
          <Share2 className="w-3.5 h-3.5" />
          {label}
        </button>
        <button
          onClick={handleCopy}
          className="px-2.5 py-1.5 rounded-full bg-surface-overlay hover:bg-surface-raised border border-hairline text-text-primary text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5"
          title="Copy link and message"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-verified" /> : <Link2 className="w-3.5 h-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="More share options"
          className="px-2 py-1.5 rounded-full bg-surface-overlay hover:bg-surface-raised border border-hairline text-text-primary text-[11px] font-bold transition-all cursor-pointer"
        >
          ⋯
        </button>
      </div>

      {menu}
    </div>
  );
}
