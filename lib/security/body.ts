/**
 * Bounded request-body reading.
 *
 * App Router route handlers have no default body cap. The pages API routes used
 * to reject anything past 1MB automatically; a route handler that calls
 * `request.json()` will happily parse a hundred megabytes first and only then
 * discover that `body.scratchpad.slice(0, 20000)` throws most of it away. Every
 * field bound in this codebase is applied *after* the parse, which is the wrong
 * order for an abuse control.
 *
 * Two layers, because each one alone has a hole:
 *
 *   1. `content-length` is checked first and rejected before a single byte is
 *      read. Cheap, and it is what a real browser or `curl` sends.
 *   2. The body is then read incrementally with a running byte count, so a
 *      chunked request with no (or a lying) `Content-Length` is still cut off.
 *
 * Alias-free and dependency-free: usable from edge middleware and from Node
 * route handlers alike.
 */

export const DEFAULT_MAX_BODY_BYTES = 64 * 1024;

/**
 * Per-path ceilings, because one global number cannot be right for both a
 * scratchpad keystroke and a full solve-history import.
 *
 * `/api/sync/solved-slugs` is the outlier and deliberately so: it accepts up to
 * 2000 slugs at 80 characters each, which is ~170KB of legitimate JSON. Capping
 * it at the default 64KB would break the 1-click LeetCode import, and raising
 * the default for everyone would loosen every other route to accommodate it.
 */
const PATH_LIMITS: ReadonlyArray<{ prefix: string; maxBytes: number }> = [
  { prefix: "/api/sync/solved-slugs", maxBytes: 512 * 1024 },
  // A scratchpad heartbeat plus the rest of the battle payload.
  { prefix: "/api/battles", maxBytes: 128 * 1024 },
];

/** The body ceiling for a pathname, falling back to the default. */
export function maxBodyBytesFor(pathname: string): number {
  for (const entry of PATH_LIMITS) {
    if (pathname === entry.prefix || pathname.startsWith(`${entry.prefix}/`)) {
      return entry.maxBytes;
    }
  }
  return DEFAULT_MAX_BODY_BYTES;
}

/** Errors carry the status code so a route does not have to guess 413 vs 400. */
export class BodyTooLargeError extends Error {
  readonly status = 413;
  readonly maxBytes: number;

  constructor(maxBytes: number) {
    super(`Request body exceeds ${maxBytes} bytes`);
    this.name = "BodyTooLargeError";
    this.maxBytes = maxBytes;
  }
}

export type BoundedJson<T> =
  | { ok: true; value: T }
  | { ok: false; error: "too_large"; maxBytes: number };

/** The declared length, when the header is present and parseable. */
export function declaredBodyLength(request: Request): number | null {
  const raw = request.headers.get("content-length");
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

/** True when the declared length alone already exceeds the cap. */
export function declaredBodyTooLarge(request: Request, maxBytes: number): boolean {
  const declared = declaredBodyLength(request);
  return declared !== null && declared > maxBytes;
}

/**
 * Read and parse a JSON body, refusing anything over `maxBytes`.
 *
 * A body that is not valid JSON resolves to `value: null` rather than throwing,
 * matching the `await request.json().catch(() => ({}))` shape the existing routes
 * use. Callers treat `null` as "no usable input", which is what they already do.
 */
export async function readJsonBounded<T = unknown>(
  request: Request,
  maxBytes: number = DEFAULT_MAX_BODY_BYTES
): Promise<BoundedJson<T>> {
  if (declaredBodyTooLarge(request, maxBytes)) {
    return { ok: false, error: "too_large", maxBytes };
  }

  const raw = await readBodyBounded(request, maxBytes);
  if (raw === null) return { ok: true, value: null as T };
  // Discriminated on the `error` key, which only exists on the failure arm.
  if ("error" in raw) return { ok: false, error: "too_large", maxBytes };

  if (raw.text.trim() === "") return { ok: true, value: null as T };
  try {
    return { ok: true, value: JSON.parse(raw.text) as T };
  } catch {
    return { ok: true, value: null as T };
  }
}

/** Read the body as text with a hard byte ceiling, or null when there is none. */
export async function readBodyBounded(
  request: Request,
  maxBytes: number
): Promise<{ text: string } | { error: "too_large"; maxBytes: number } | null> {
  const body = request.body;
  if (!body) return null;

  const reader = body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        // Stop reading immediately. The rest of the socket is never buffered.
        await reader.cancel().catch(() => undefined);
        return { error: "too_large", maxBytes };
      }
      chunks.push(decoder.decode(value, { stream: true }));
    }
    chunks.push(decoder.decode());
  } catch {
    return null;
  } finally {
    reader.releaseLock?.();
  }

  return { text: chunks.join("") };
}