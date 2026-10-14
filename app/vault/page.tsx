import { redirect } from "next/navigation";

// Vault is a tab inside Notebook (plan Step 4 + Step 13: Vault = shared
// reusable, Notebook = personal). Old /vault links keep working.
export default function VaultAlias() {
  redirect("/notebook?tab=vault");
}