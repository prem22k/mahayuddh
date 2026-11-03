import { ErrorScreen } from "@/components/errors/ErrorScreen";

export default function ChallengeNotFound() {
  return (
    <ErrorScreen
      variant="inline"
      code="404"
      title="Challenge not found"
      body="This challenge doesn't exist or was withdrawn. Start your own battle instead."
      actions={[
        { label: "Start a battle", href: "/", primary: true },
        { label: "Browse problems", href: "/practice" },
      ]}
    />
  );
}
