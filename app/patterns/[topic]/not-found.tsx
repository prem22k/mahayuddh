import { ErrorScreen } from "@/components/errors/ErrorScreen";

export default function PatternNotFound() {
  return (
    <ErrorScreen
      variant="inline"
      code="404"
      title="Pattern not found"
      body="We couldn't find a pattern by that name. Check the list of available patterns."
      actions={[
        { label: "All patterns", href: "/patterns", primary: true },
        { label: "Browse problems", href: "/practice" },
      ]}
    />
  );
}
