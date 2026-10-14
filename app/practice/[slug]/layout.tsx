import type { Metadata } from "next";

/**
 * A problem page is private-by-default (Principle 6), so this is deliberately
 * a generic title plus a noindex: individual problem pages must not become thin
 * doorway pages in search results.
 */
export const metadata: Metadata = {
  title: "Problem | Mahayuddh",
  robots: { index: false, follow: false },
};

export default function ProblemLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}