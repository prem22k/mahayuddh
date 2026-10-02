/**
 * Share link + distribution targets (Bible §40, §56).
 *
 * Pure string work so the URLs and the attribution slug are testable without a
 * browser. The component in components/ui/ShareRow.tsx only renders them.
 *
 * Two rules:
 *
 * 1. Every link we generate carries ?via=. Without it, a signup that arrives
 *    from a shared battle card is indistinguishable from one that arrived from
 *    a competitor's blog, and Loop B cannot be measured at all.
 * 2. The slug is an artifact type plus a stable id — never a full URL. A
 *    ?via= that carried the referrer would let one share claim signups it had
 *    nothing to do with.
 */

export type ShareArtifact =
  | { kind: "battle"; id: string }
  | { kind: "journey"; id: string }
  | { kind: "recap"; id: string; squadId: string }
  | { kind: "primer"; id: string }
  | { kind: "season"; id: string; squadId: string }
  | { kind: "squad"; id: string }
  | { kind: "stuck"; id: string };

/** Stable, non-identifying attribution slug: "battle:9f3c…". */
export function viaSlug(artifact: ShareArtifact): string {
  // The id is encoded, the separator is not. URLSearchParams would escape the
  // colon into %3A, which is valid but turns every shared link into
  // ?via=battle%3A9f3c — unreadable in a chat window and longer than the id.
  return `${artifact.kind}:${encodeURIComponent(artifact.id)}`;
}

/** Public path for an artifact, so share and preview never disagree. */
export function artifactPath(artifact: ShareArtifact): string {
  switch (artifact.kind) {
    case "battle":
      return `/b/${artifact.id}`;
    case "journey":
      return `/u/${encodeURIComponent(artifact.id)}`;
    case "recap":
      return `/squad/${artifact.squadId}/recaps/${artifact.id}`;
    case "primer":
      return `/primers/${artifact.id}`;
    case "season":
      return `/squad/${artifact.squadId}/seasons/${artifact.id}`;
    case "stuck":
      return `/stuck/${artifact.id}`;
    case "squad":
      // A squad has no public page of its own; the invite route is the shareable
      // surface, and the token is appended by withVia, not here.
      return `/squad/${artifact.id}`;
  }
}

/**
 * Append ?via= to a path or absolute URL, preserving any existing query and
 * hash. Reuses an existing ?via= rather than appending a second one.
 */
export function withVia(
  target: string,
  artifact: ShareArtifact | null
): string {
  if (!artifact) return target;
  const slug = viaSlug(artifact);
  const [base, hash = ""] = splitHash(target);
  const [path, query = ""] = splitQuery(base);
  // Left alone if the link already carries one, so a re-shared link does not
  // end up with two competing attributions.
  if (/(^|[?&])via=/.test(query)) return target;
  const joined = query ? `${query}&via=${slug}` : `via=${slug}`;
  return `${path}?${joined}${hash ? `#${hash}` : ""}`;
}

function splitQuery(s: string): [string, string] {
  const i = s.indexOf("?");
  return i === -1 ? [s, ""] : [s.slice(0, i), s.slice(i + 1)];
}

function splitHash(s: string): [string, string] {
  const i = s.indexOf("#");
  return i === -1 ? [s, ""] : [s.slice(0, i), s.slice(i + 1)];
}

/**
 * Third-party share URLs. Kept in one place so the set is auditable — a
 * distribution target is a place the message leaves, which means it should be
 * a deliberate list rather than whatever a component happens to build.
 *
 * Percent-encoding is applied to the message and the link, not pre-encoded by
 * the caller, so a slug with a space or an ampersand cannot break the URL.
 */
export interface ShareTarget {
  id: "whatsapp" | "linkedin" | "x" | "telegram";
  label: string;
  href: string;
}

export function shareTargets(url: string, text: string): ShareTarget[] {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(text);
  return [
    {
      id: "whatsapp",
      label: "WhatsApp",
      href: `https://wa.me/?text=${t}%20${u}`,
    },
    {
      id: "telegram",
      label: "Telegram",
      href: `https://t.me/share/url?url=${u}&text=${t}`,
    },
    {
      id: "linkedin",
      label: "LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
    },
    {
      id: "x",
      label: "X",
      href: `https://x.com/intent/tweet?text=${t}&url=${u}`,
    },
    // Discord is deliberately absent: it has no public share intent, so the
    // only honest route is the copy-link button below.
  ];
}
