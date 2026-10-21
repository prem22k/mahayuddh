import { ArtifactNotFound } from "@/components/recap/ArtifactNotFound";

export default function ApproachNotFound() {
  return (
    <ArtifactNotFound
      heading="Approach not found"
      body="This approach doesn't exist, or its author deleted it."
    />
  );
}
