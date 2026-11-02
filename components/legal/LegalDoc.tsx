import Link from "next/link";
import { ArtifactFrame } from "@/components/recap/ArtifactChrome";
import { LEGAL } from "@/lib/legal";

export interface LegalSection {
  id: string;
  heading: string;
  body: React.ReactNode;
}

/**
 * A legal document in the reading column. Signed out, ArtifactFrame brings the
 * brand bar and gutters (these pages are public); signed in, the app shell does.
 */
export function LegalDoc({
  title,
  intro,
  sections,
  path,
  other,
}: {
  title: string;
  intro: React.ReactNode;
  sections: LegalSection[];
  /** This page's path, for the sign-in link's ?next=. */
  path: "/privacy" | "/terms";
  /** The companion document. */
  other: { href: "/privacy" | "/terms"; label: string };
}) {
  return (
    <ArtifactFrame crumb={title} signInHref={`/login?next=${encodeURIComponent(path)}`} className="max-w-reading">
      <article className="flex flex-col gap-8 pb-8">
        <header className="flex flex-col gap-2 border-b border-hairline pb-6">
          <h1 className="type-display-md text-text-primary">{title}</h1>
          <p className="font-mono text-xs text-text-tertiary">Last updated {LEGAL.effectiveDate}</p>
          <div className="mt-2 text-[15px] leading-7 text-text-secondary">{intro}</div>
        </header>

        <nav aria-label="On this page" className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {sections.map((s, i) => (
            <a key={s.id} href={`#${s.id}`} className="text-text-secondary underline-offset-[3px] hover:text-text-primary hover:underline">
              {i + 1}. {s.heading}
            </a>
          ))}
        </nav>

        {sections.map((s, i) => (
          <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="flex scroll-mt-24 flex-col gap-3">
            <h2 id={`${s.id}-h`} className="text-lg font-semibold leading-[26px] tracking-[-0.01em] text-text-primary">
              <span className="mr-2 font-mono text-sm font-medium text-text-tertiary tnum">{i + 1}.</span>
              {s.heading}
            </h2>
            <div className="flex flex-col gap-3 text-[15px] leading-7 text-text-secondary [&_a]:text-text-primary [&_a]:underline [&_a]:decoration-hairline-strong [&_a]:underline-offset-[3px] [&_li]:pl-1 [&_strong]:font-medium [&_strong]:text-text-primary [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
              {s.body}
            </div>
          </section>
        ))}

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-6 text-sm text-text-secondary">
          <span>
            Questions:{" "}
            <a href={`mailto:${LEGAL.contactEmail}`} className="text-text-primary underline decoration-hairline-strong underline-offset-[3px]">
              {LEGAL.contactEmail}
            </a>
          </span>
          <Link href={other.href} className="font-medium text-text-primary hover:underline">
            {other.label}
          </Link>
        </footer>
      </article>
    </ArtifactFrame>
  );
}
