"use client";

import { useState } from "react";
import { Check, Link2, Share2 } from "lucide-react";
import { copyText } from "@/lib/clipboard";
import { track } from "@/lib/analytics";
import { shareTargets, withVia, type ShareArtifact } from "@/lib/share";

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
 */
export function ShareRow({
  path,
  text,
  artifact,
  label = "Share",
  onCopied,
}: {
  /** Absolute or root-relative URL of the artifact. */
  path: string;
  /** The message body, without the URL — shareTargets appends it. */
  text: string;
  artifact: ShareArtifact;
  label?: string;
  onCopied?: (ok: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

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

      {open && (
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
              Copy for Discord
            </button>
          </div>
        </>
      )}
    </div>
  );
}
