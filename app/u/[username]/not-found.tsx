import { ArtifactNotFound } from "@/components/recap/ArtifactNotFound";

export default function ProfileNotFound() {
  return (
    <ArtifactNotFound
      heading="No one here by that name"
      body="There's no Mahayuddh profile at this address. The handle may be misspelled, or it may have changed."
    />
  );
}
