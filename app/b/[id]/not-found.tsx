import { ArtifactNotFound } from "@/components/recap/ArtifactNotFound";

export default function ProofNotFound() {
  return (
    <ArtifactNotFound
      heading="Proof not found"
      body="This link doesn't point at a battle. Check it, or ask whoever shared it for a fresh one."
    />
  );
}
