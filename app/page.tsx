import { redirect } from "next/navigation";

// The Arena is Home (plan Step 4: nav maps to intent, not DB tables).
// This alias keeps `/` working for bookmarks, PWA start_url and the sync cron.
export default function RootAlias() {
  redirect("/home");
}