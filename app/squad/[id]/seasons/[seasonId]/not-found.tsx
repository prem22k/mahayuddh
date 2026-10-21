import { ArtifactNotFound } from "@/components/recap/ArtifactNotFound";

export default function SeasonNotFound() {
  return (
    <ArtifactNotFound
      heading="Season not found"
      body="This season doesn't exist, or its squad has been removed."
    />
  );
}
