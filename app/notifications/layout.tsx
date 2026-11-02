import type { Metadata } from "next";

// The page is a client component, so its title lives here. Private history:
// never indexed.
export const metadata: Metadata = {
  title: "Notifications",
  robots: { index: false, follow: false },
};

export default function NotificationsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
