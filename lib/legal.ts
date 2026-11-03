/**
 * Facts the Privacy Policy and Terms state about who runs Mahayuddh. One place,
 * so the two documents (and anything that links to them) never disagree.
 *
 * Who runs it and how to reach them are deployment settings, read only from
 * the environment (NEXT_PUBLIC_ because the profile page shows the contact
 * address in the browser):
 *   NEXT_PUBLIC_OPERATOR_NAME     e.g. the person or company running the site
 *   NEXT_PUBLIC_OPERATOR_HANDLE   e.g. a GitHub or company URL without scheme
 *   NEXT_PUBLIC_CONTACT_EMAIL     where privacy, deletion and legal requests go
 *   NEXT_PUBLIC_JURISDICTION      governing law, e.g. a country
 * A missing value renders as a visible "[NAME not set]" marker, so it is caught
 * on sight instead of shipping a wrong or empty contact.
 *
 * The effective date stays here: it dates the policy text, which lives in code.
 */
function fromEnv(value: string | undefined, name: string): string {
  const v = value?.trim();
  return v ? v : `[${name} not set]`;
}

export const LEGAL = {
  // Each NEXT_PUBLIC_ variable is referenced literally so Next inlines it.
  operator: fromEnv(process.env.NEXT_PUBLIC_OPERATOR_NAME, "NEXT_PUBLIC_OPERATOR_NAME"),
  operatorHandle: fromEnv(process.env.NEXT_PUBLIC_OPERATOR_HANDLE, "NEXT_PUBLIC_OPERATOR_HANDLE"),
  contactEmail: fromEnv(process.env.NEXT_PUBLIC_CONTACT_EMAIL, "NEXT_PUBLIC_CONTACT_EMAIL"),
  jurisdiction: fromEnv(process.env.NEXT_PUBLIC_JURISDICTION, "NEXT_PUBLIC_JURISDICTION"),
  /** Shown as "Last updated" on both documents. Bump it when either changes. */
  effectiveDate: "3 November 2026",
} as const;
