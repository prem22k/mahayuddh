import { createClient } from "@/lib/supabase/client";

export type LeetCodeVerificationResult =
  | { ok: true; status: "pending"; handle: string; code: string; expiresAt: string }
  | { ok: true; status: "verified"; handle: string; releasedOther: boolean }
  | { ok: true; status: "not_found_yet"; handle: string; code: string; expiresAt: string; message: string }
  | { ok: false; httpStatus: number; error: string; retryAfter?: number };

async function postVerify(body: Record<string, unknown>): Promise<LeetCodeVerificationResult> {
  try {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;

    const res = await fetch("/api/leetcode/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      const retryAfterHeader = res.headers.get("retry-after");
      const retryAfter =
        typeof json?.retry_after === "number"
          ? json.retry_after
          : retryAfterHeader
            ? parseInt(retryAfterHeader, 10) || undefined
            : undefined;

      return {
        ok: false,
        httpStatus: res.status,
        error: typeof json?.error === "string" ? json.error : "Verification failed.",
        ...(retryAfter != null ? { retryAfter } : {}),
      };
    }

    if (json?.status === "pending") {
      return {
        ok: true,
        status: "pending",
        handle: json.handle,
        code: json.code,
        expiresAt: json.expires_at,
      };
    }

    if (json?.status === "verified") {
      return {
        ok: true,
        status: "verified",
        handle: json.handle,
        releasedOther: Boolean(json.released_other),
      };
    }

    if (json?.status === "not_found_yet") {
      return {
        ok: true,
        status: "not_found_yet",
        handle: json.handle,
        code: json.code,
        expiresAt: json.expires_at,
        message: typeof json.error === "string" ? json.error : (json.message ?? ""),
      };
    }

    return {
      ok: false,
      httpStatus: res.status,
      error: typeof json?.error === "string" ? json.error : "Unexpected verification response.",
    };
  } catch {
    return {
      ok: false,
      httpStatus: 0,
      error: "Couldn't reach Mahayuddh. Check your connection.",
    };
  }
}

export async function startLeetCodeVerification(handle: string): Promise<LeetCodeVerificationResult> {
  return postVerify({ action: "start", handle });
}

export async function checkLeetCodeVerification(): Promise<LeetCodeVerificationResult> {
  return postVerify({ action: "check" });
}
