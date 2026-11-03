import { ErrorScreen } from "@/components/errors/ErrorScreen";

export default function UserNotFound() {
  return (
    <ErrorScreen
      variant="inline"
      code="404"
      title="No player called that"
      body="Check the username spelling, or search for members in your squad."
      actions={[
        { label: "Leaderboard", href: "/leaderboard", primary: true },
        { label: "Go to Arena", href: "/home" },
      ]}
    />
  );
}
