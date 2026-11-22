import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Retired free-form notification relay. Notifications are now created by
 * verified database events and action-specific routes, so callers cannot
 * choose an arbitrary recipient or push body.
 */
export async function POST() {
  return NextResponse.json(
    { error: "Free-form notifications are no longer supported." },
    { status: 410 }
  );
}
