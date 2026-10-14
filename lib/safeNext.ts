/**
 * Same-origin relative-path guard for `?next=` continuations.
 *
 * Bible §42: a logged-out challenge-link visitor must land back on the battle
 * they were invited to, not on a generic page — and never on someone else's
 * origin. Lives outside `middleware.ts` (edge runtime) because both the
 * middleware and the client login page need it.
 */
export function safeNext(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//") || value.startsWith("/\\")) return null;

  // Decode once to catch percent-encoded protocol-relative / absolute targets
  // ("/%2F%2Fevil.com", "/%5C%5Cevil.com").
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }
  if (decoded.startsWith("//") || decoded.startsWith("/\\")) return null;
  if (decoded.includes("://")) return null;

  return value;
}