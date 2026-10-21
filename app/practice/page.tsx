import { PracticeHub } from "@/components/practice/PracticeHub";

export const metadata = { title: "Practice | Mahayuddh" };

// Practice hub (04): the single most valuable thing to practice now, weak
// patterns with an honesty note, primers, and sheets to start.
export default function PracticePage() {
  return (
    <div className="space-y-6 md:space-y-8">
      <div>
        <h1 className="font-display text-[28px] font-semibold leading-[1.1] tracking-[-0.02em] text-text-primary md:text-[32px] md:leading-9">
          Practice
        </h1>
        <p className="mt-1 text-[15px] leading-6 text-text-secondary">
          What to practice next, and why.
        </p>
      </div>

      <PracticeHub />
    </div>
  );
}
