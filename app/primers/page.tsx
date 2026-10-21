import Link from "next/link";

export const metadata = { title: "Primers | Mahayuddh" };

import { PrimerList } from "@/components/primers/PrimerList";

export default function PrimersPage() {
  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-8">
      <div className="flex flex-col gap-1.5">
        <h1 className="type-display-md text-text-primary">Primers</h1>
        <p className="text-[15px] leading-6 text-text-secondary">
          One pattern, ten minutes, then the problems that teach it.
        </p>
      </div>
      <PrimerList />
      <Link
        href="/practice"
        className="-mt-4 inline-flex min-h-[44px] items-center self-start text-sm font-medium leading-5 text-text-secondary transition-colors hover:text-text-primary md:min-h-0"
      >
        Back to practice
      </Link>
    </div>
  );
}
