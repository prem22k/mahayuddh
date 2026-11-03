import LoginClient from "./LoginClient";
import { enabledOAuthProviders } from "@/lib/auth/providers";

/**
 * Server half of /login: asks Supabase which social providers are switched on
 * (cached five minutes) so the page renders with exactly those buttons, with
 * no layout jump and no button for a provider that would fail.
 */
export default async function LoginPage() {
  const providers = await enabledOAuthProviders();
  return <LoginClient providers={providers} />;
}
