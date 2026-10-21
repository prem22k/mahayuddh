"use client";

import Link from "next/link";
import { Eye, Pencil } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";

/**
 * Stitch "Own profile" state: a quiet note that this is the public view, with
 * a way to the settings page that edits it. Only the owner sees it.
 */
export function OwnerNotice({ userId }: { userId: string }) {
  const { user } = useAuth();
  if (!user || user.id !== userId) return null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-lg border border-hairline bg-well px-4 py-2 text-center text-xs leading-5 text-text-secondary">
      <span className="inline-flex items-center gap-1.5">
        <Eye className="h-3.5 w-3.5 text-text-tertiary" strokeWidth={1.5} aria-hidden />
        This is how others see your page.
      </span>
      <Link
        href="/profile"
        className="inline-flex min-h-[44px] items-center gap-1 font-medium text-text-primary underline decoration-hairline-strong underline-offset-4 hover:decoration-text-primary md:min-h-0"
      >
        <Pencil className="h-3 w-3" strokeWidth={1.5} aria-hidden />
        Edit profile
      </Link>
    </div>
  );
}
