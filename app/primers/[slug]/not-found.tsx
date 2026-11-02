import { ErrorScreen } from "@/components/errors/ErrorScreen";

export default function PrimerNotFound() {
  return (
    <ErrorScreen
      variant="inline"
      code="404"
      title="Primer not found"
      body="This primer doesn't exist or may have been moved."
      actions={[
        { label: "All primers", href: "/primers", primary: true },
        { label: "Browse problems", href: "/practice" },
      ]}
    />
  );
}
