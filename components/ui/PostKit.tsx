"use client";

import { useState } from "react";
import { Copy, Check, Download } from "lucide-react";
import { copyText } from "@/lib/clipboard";
import { track } from "@/lib/analytics";
import { withVia, type ShareArtifact } from "@/lib/share";

/**
 * Post kit (Wave D growth).
 *
 * Two affordances beside every share row on a public artifact: download the
 * rendered card image, and copy a two-line hook plus the attributed URL. The
 * mechanics reuse the ShareRow patterns (withVia attribution, copyText, a
 * track call per press) so the post loop is measurable: download_copied and
 * post_copied are the numerator events in lib/analyticsEvents.ts.
 */
export function PostKit({
  imageHref,
  path,
  artifact,
  text,
}: {
  /** Same-origin /opengraph-image URL for the artifact. */
  imageHref: string;
  /** Root-relative artifact path, without query or hash. */
  path: string;
  artifact: ShareArtifact;
  /** The share message. Only the first two non-empty lines are posted. */
  text: string;
}) {
  const [copied, setCopied] = useState(false);

  const absoluteUrl = (): string => {
    const base = typeof window === "undefined" ? "" : window.location.origin;
    const root = path.startsWith("/") ? path : `/${path}`;
    return withVia(`${base}${root}`, artifact);
  };

  const postBody = (): string => {
    const hook = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 2)
      .join("\n");
    return hook ? `${hook}\n${absoluteUrl()}` : absoluteUrl();
  };

  const handleCopyPost = async () => {
    const ok = await copyText(postBody());
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
    track("post_copied", { artifact: artifact.kind });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={imageHref}
        download
        onClick={() => track("download_copied", { artifact: artifact.kind })}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-surface-overlay px-4 text-sm font-medium leading-5 text-text-primary transition-colors hover:bg-surface-raised"
      >
        <Download className="h-4 w-4" strokeWidth={1.5} />
        Download image
      </a>
      <button
        type="button"
        onClick={() => void handleCopyPost()}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-surface-overlay px-4 text-sm font-medium leading-5 text-text-primary transition-colors hover:bg-surface-raised"
      >
        {copied ? (
          <Check className="h-4 w-4 text-verified" strokeWidth={1.5} />
        ) : (
          <Copy className="h-4 w-4" strokeWidth={1.5} />
        )}
        {copied ? "Copied" : "Copy post"}
      </button>
    </div>
  );
}
