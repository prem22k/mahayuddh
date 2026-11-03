import { ErrorScreen } from "@/components/errors/ErrorScreen";

export default function ApproachNotFound() {
  return (
    <ErrorScreen
      variant="inline"
      code="404"
      title="Approach not found"
      body="This approach doesn't exist, or its author made it private or deleted it."
      actions={[
        { label: "Back to practice", href: "/practice", primary: true },
        { label: "Go to Arena", href: "/home" },
      ]}
    />
  );
}
