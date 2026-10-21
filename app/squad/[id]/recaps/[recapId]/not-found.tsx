import { ArtifactNotFound } from "@/components/recap/ArtifactNotFound";

export default function RecapNotFound() {
  return (
    <ArtifactNotFound
      heading="Recap not found"
      body="This recap doesn't exist, or its squad has been removed."
    />
  );
}
