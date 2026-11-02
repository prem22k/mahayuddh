import { ErrorScreen } from "@/components/errors/ErrorScreen";

export default function ProblemNotFound() {
  return (
    <ErrorScreen
      variant="inline"
      code="404"
      title="Problem not found"
      body="This problem isn't in our catalog, or the link may be mistyped."
      actions={[
        { label: "Browse problems", href: "/practice", primary: true },
        { label: "Go to Arena", href: "/home" },
      ]}
    />
  );
}
