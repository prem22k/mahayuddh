import { ErrorScreen } from "@/components/errors/ErrorScreen";

export default function SquadJoinNotFound() {
  return (
    <ErrorScreen
      variant="inline"
      code="404"
      title="That invite code isn't valid or has expired"
      body="Check the code with the person who sent it, or start your own squad."
      actions={[
        { label: "Start your own squad", href: "/welcome", primary: true },
        { label: "Go to Arena", href: "/home" },
      ]}
    />
  );
}
