import Link from "next/link";

export const metadata = { title: "Primers | Mahayuddh" };

import { PrimerList } from "@/components/primers/PrimerList";

export default function PrimersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="type-display-md text-text-primary">Primers</h1>
        <p className="mt-1 text-sm leading-6 text-text-secondary">
          One pattern, ten minutes, then the problems that teach it.
        </p>
      </div>
      <PrimerList />
      <Link
        href="/practice"
        className="inline-flex min-h-[44px] items-center text-sm font-medium leading-5 text-text-secondary transition-colors hover:text-text-primary md:min-h-0"
      >
        Back to practice
      </Link>
    </div>
  );
}
