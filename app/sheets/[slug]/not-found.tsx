import { ErrorScreen } from "@/components/errors/ErrorScreen";

export default function SheetNotFound() {
  return (
    <ErrorScreen
      variant="inline"
      code="404"
      title="Sheet not found"
      body="This roadmap or practice sheet doesn't exist."
      actions={[
        { label: "All sheets", href: "/sheets", primary: true },
        { label: "Go to Arena", href: "/home" },
      ]}
    />
  );
}
