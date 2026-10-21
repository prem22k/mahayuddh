import Link from "next/link";
import { ArrowLeft, FileQuestionMark } from "lucide-react";
import { ArtifactFrame } from "./ArtifactChrome";

/**
 * 404 for a shared recap or season link: the artifact or its squad is gone.
 * Rendered by the route's not-found boundary, so the response stays a 404.
 */
export function ArtifactNotFound({ heading, body }: { heading: string; body: string }) {
  return (
    <ArtifactFrame signInHref="/login" className="max-w-reading">
      <div className="mx-auto max-w-md px-2 py-12 text-center md:py-20">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-hairline bg-surface-raised text-text-tertiary">
          <FileQuestionMark className="h-6 w-6" strokeWidth={1.5} aria-hidden />
        </span>
        <h1 className="type-title text-text-primary">{heading}</h1>
        <p className="mt-2 text-sm leading-6 text-text-secondary">{body}</p>
        <Link
          href="/"
          className="mt-6 inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-hairline bg-surface-overlay px-4 text-sm font-medium text-text-primary transition-colors hover:bg-surface-raised md:min-h-0 md:h-10"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} aria-hidden />
          Go to Mahayuddh
        </Link>
      </div>
    </ArtifactFrame>
  );
}
