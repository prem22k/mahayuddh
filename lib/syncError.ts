/** Shared 429-aware error reader for sync POSTs (leetcode/history/solved-slugs). */
export async function syncErrorMessage(
  res: Response | null,
  fallback: string
): Promise<string> {
  if (!res) return fallback;
  if (res.status === 429) {
    const retryAfter = res.headers.get("Retry-After");
    return retryAfter
      ? `Sync on cooldown. Retry in ${retryAfter}s.`
      : "Sync on cooldown. Wait a minute and retry.";
  }
  try {
    const json = await res.json();
    return json.error || fallback;
  } catch {
    return fallback;
  }
}
