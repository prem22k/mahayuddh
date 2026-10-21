import Link from "next/link";
import { StuckBoard } from "@/components/battle/StuckBoard";

export const metadata = {
  title: "Stuck requests | Mahayuddh",
  description: "Help at the level someone asked for, no more.",
};

/**
 * The Stuck ladder surface (09).
 *
 * Reachable from the dock's "Stuck?" button and the feed. Asking for help is
 * a thing you do while solving; this page is where the squad answers.
 */
export default function StuckPage() {
  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <div className="flex flex-col gap-1">
        <nav
          aria-label="Breadcrumb"
          className="mb-1 flex min-h-[44px] items-center gap-1.5 text-sm font-medium leading-5 text-text-tertiary md:min-h-0"
        >
          <Link href="/practice" className="transition-colors hover:text-text-primary">
            Practice
          </Link>
          <span aria-hidden className="text-text-disabled">/</span>
          <span className="text-text-secondary">Stuck requests</span>
        </nav>
        <h1 className="type-display-md text-text-primary">Stuck requests</h1>
        <p className="text-[15px] leading-6 text-text-secondary">
          Help at the level someone asked for, no more.
        </p>
      </div>

      <StuckBoard />
    </div>
  );
}
