import { cn } from "@/lib/utils";
import { Spinner } from "./Spinner";

interface PageLoaderProps {
  label: string;
  className?: string;
}

/** Full-width loading state: spinner + label (page loads, table bodies). */
export function PageLoader({ label, className }: PageLoaderProps) {
  return (
    <div
      className={cn(
        "h-[60vh] flex flex-col items-center justify-center gap-3 text-text-secondary",
        className
      )}
    >
      <Spinner size="xl" />
      <span className="text-xs font-medium tracking-wide">{label}</span>
    </div>
  );
}
