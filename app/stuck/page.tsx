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
    <div className="space-y-8">
      <div>
        <Link
          href="/practice"
          className="text-sm font-medium leading-5 text-text-tertiary transition-colors hover:text-text-primary"
        >
          Practice / Stuck requests
        </Link>
        <h1 className="type-display-md mt-1 text-text-primary">Stuck requests</h1>
        <p className="mt-1 text-[15px] leading-6 text-text-secondary">
          Help at the level someone asked for, no more.
        </p>
      </div>

      <StuckBoard />
    </div>
  );
}
