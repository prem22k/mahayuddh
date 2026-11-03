import type { Metadata } from "next";
import { ErrorScreen } from "@/components/errors/ErrorScreen";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <ErrorScreen
      variant="page"
      code="404"
      title="This page doesn't exist"
      body="The link may be old or mistyped. Nothing of yours is lost."
      actions={[
        { label: "Go to Arena", href: "/home", primary: true },
        { label: "Browse problems", href: "/practice" },
        { label: "Home page", href: "/welcome" },
      ]}
    />
  );
}
