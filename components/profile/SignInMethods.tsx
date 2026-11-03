"use client";

import { useCallback, useEffect, useState } from "react";
import type { UserIdentity } from "@supabase/supabase-js";
import { Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/Button";
import { outlineAction } from "@/components/settings/SettingsCard";
import { PROVIDER_MARKS } from "@/components/auth/ProviderMarks";
import { providerLabel } from "@/components/auth/SocialSignIn";
import { isOAuthProviderId, orderedProviders, type OAuthProviderId } from "@/lib/auth/providers";
import { useCachedQuery } from "@/lib/cache/query";

/**
 * Profile → Account → Sign-in methods.
 *
 * Lists every way into this account (email + password, GitHub, Google, ...),
 * connects another provider to it (Supabase manual identity linking), and
 * disconnects one as long as another remains. An account created through a
 * provider can add a password; one that has a password changes it through
 * the emailed reset link, so the change always proves ownership of the email.
 *
 * Same-email accounts link automatically (once email confirmation is on);
 * this card is how someone attaches a provider whose email differs.
 */

const LINK_RESULTS: Record<string, string> = {
  taken: "That account is already connected to a different Mahayuddh account. Sign in with it to use that account, or disconnect it there first.",
  cancelled: "Connecting was cancelled. Nothing changed.",
  failed: "Couldn't connect that account. Try again.",
};

async function fetchEnabledProviders(): Promise<OAuthProviderId[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return [];
  const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
  if (!res.ok) return [];
  const body = (await res.json()) as { external?: Record<string, unknown> };
  const external = body.external ?? {};
  return orderedProviders(Object.keys(external).filter((k) => external[k] === true));
}

function identityDetail(i: UserIdentity): string | null {
  const d = (i.identity_data ?? {}) as Record<string, unknown>;
  const handle = d.user_name ?? d.preferred_username;
  if (typeof handle === "string" && handle) return `@${handle}`;
  return typeof d.email === "string" ? d.email : null;
}

export function SignInMethods() {
  const { user } = useAuth();
  const [identities, setIdentities] = useState<UserIdentity[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmUnlink, setConfirmUnlink] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [password, setPassword] = useState("");

  const enabled = useCachedQuery(["auth-providers"], fetchEnabledProviders, { freshForMs: 10 * 60_000 });

  const loadIdentities = useCallback(async () => {
    const { data, error } = await createClient().auth.getUserIdentities();
    setIdentities(error ? [] : (data?.identities ?? []));
  }, []);

  useEffect(() => {
    if (user) void loadIdentities();
  }, [user, loadIdentities]);

  // Result of a connect round trip (?linked=<provider> or ?link_error=<reason>),
  // read once and removed from the address bar.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const linked = params.get("linked");
    const linkError = params.get("link_error");
    if (!linked && !linkError) return;
    if (linked && isOAuthProviderId(linked)) {
      setMessage({ tone: "ok", text: `${providerLabel(linked)} is connected. You can sign in with it from now on.` });
    } else if (linkError) {
      setMessage({ tone: "error", text: LINK_RESULTS[linkError] ?? LINK_RESULTS.failed });
    }
    params.delete("linked");
    params.delete("link_error");
    const q = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${q ? `?${q}` : ""}#account`);
    document.getElementById("account")?.scrollIntoView({ block: "start" });
  }, []);

  if (!user || identities === null) {
    return <p className="py-3 text-xs text-text-tertiary">Loading sign-in methods…</p>;
  }

  const linkedProviders = new Set(identities.map((i) => i.provider));
  const hasPassword = linkedProviders.has("email");
  const connectable = (enabled.data ?? []).filter((p) => !linkedProviders.has(p));
  const oauthCount = identities.filter((i) => i.provider !== "email").length;
  const canUnlink = identities.length > 1;

  const connect = async (provider: OAuthProviderId) => {
    setMessage(null);
    setBusy(`connect:${provider}`);
    const back = `/profile?linked=${provider}`;
    const { error } = await createClient().auth.linkIdentity({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(back)}` },
    });
    if (error) {
      setBusy(null);
      setMessage({
        tone: "error",
        text: /manual linking/i.test(error.message)
          ? "Connecting another account isn't switched on yet."
          : `Couldn't start connecting ${providerLabel(provider)}. Try again.`,
      });
    }
  };

  const unlink = async (identity: UserIdentity) => {
    setMessage(null);
    setBusy(`unlink:${identity.identity_id}`);
    const { error } = await createClient().auth.unlinkIdentity(identity);
    setBusy(null);
    setConfirmUnlink(null);
    if (error) {
      setMessage({ tone: "error", text: "Couldn't disconnect it. Try again." });
      return;
    }
    const label = isOAuthProviderId(identity.provider) ? providerLabel(identity.provider) : identity.provider;
    setMessage({ tone: "ok", text: `${label} is disconnected.` });
    await loadIdentities();
  };

  const setNewPassword = async () => {
    if (password.length < 8) {
      setMessage({ tone: "error", text: "Use at least 8 characters." });
      return;
    }
    setBusy("password");
    const { error } = await createClient().auth.updateUser({ password });
    setBusy(null);
    if (error) {
      setMessage({ tone: "error", text: "Couldn't set the password. Try a different one." });
      return;
    }
    setPassword("");
    setPasswordOpen(false);
    setMessage({ tone: "ok", text: `Password set. You can sign in with ${user.email} and this password too.` });
    await loadIdentities();
  };

  const sendReset = async () => {
    if (!user.email) return;
    setBusy("reset");
    const { error } = await createClient().auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`,
    });
    setBusy(null);
    setMessage(
      error
        ? { tone: "error", text: "Couldn't send the link right now. Wait a minute and try again." }
        : { tone: "ok", text: `A link to change your password was sent to ${user.email}. It works once and expires soon.` }
    );
  };

  return (
    <div className="py-2.5 md:py-3.5">
      <p className="text-[11px] font-medium leading-4 text-text-tertiary md:text-xs">Sign-in methods</p>

      <ul className="mt-2 space-y-2">
        {identities.map((identity) => {
          const isEmail = identity.provider === "email";
          const known = isOAuthProviderId(identity.provider);
          const Mark = known ? PROVIDER_MARKS[identity.provider as OAuthProviderId] : null;
          const label = isEmail ? "Email and password" : known ? providerLabel(identity.provider as OAuthProviderId) : identity.provider;
          const detail = isEmail ? user.email ?? null : identityDetail(identity);
          const confirming = confirmUnlink === identity.identity_id;
          return (
            <li
              key={identity.identity_id}
              className="flex min-h-[44px] flex-wrap items-center justify-between gap-2 rounded-md border border-hairline bg-well px-3 py-2"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                {Mark ? (
                  <Mark className="h-4 w-4 shrink-0" />
                ) : (
                  <Mail className="h-4 w-4 shrink-0 text-text-secondary" strokeWidth={1.5} aria-hidden />
                )}
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-text-primary">{label}</span>
                  {detail && <span className="block truncate text-xs text-text-tertiary">{detail}</span>}
                </span>
              </span>
              {!isEmail && canUnlink && (
                confirming ? (
                  <span className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void unlink(identity)}
                      disabled={busy !== null}
                      className={`${outlineAction} border-error/40 text-error hover:text-error`}
                    >
                      {busy === `unlink:${identity.identity_id}` ? "Disconnecting…" : "Disconnect"}
                    </button>
                    <button type="button" onClick={() => setConfirmUnlink(null)} className={outlineAction}>
                      Keep
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmUnlink(identity.identity_id)}
                    disabled={busy !== null}
                    className={outlineAction}
                    aria-label={`Disconnect ${label}`}
                  >
                    Disconnect
                  </button>
                )
              )}
            </li>
          );
        })}
      </ul>

      {connectable.length > 0 && (
        <div className="mt-3">
          <p className="mb-2 text-xs text-text-secondary">Connect another way to sign in</p>
          <div className="flex flex-wrap gap-2">
            {connectable.map((p) => {
              const Mark = PROVIDER_MARKS[p];
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => void connect(p)}
                  disabled={busy !== null}
                  className={outlineAction}
                  aria-label={`Connect ${providerLabel(p)}`}
                >
                  <Mark className="h-3.5 w-3.5" />
                  {busy === `connect:${p}` ? "Opening…" : providerLabel(p)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-3">
        {hasPassword ? (
          <button type="button" onClick={() => void sendReset()} disabled={busy !== null} className={outlineAction}>
            {busy === "reset" ? "Sending…" : "Change password"}
          </button>
        ) : passwordOpen ? (
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void setNewPassword();
            }}
          >
            <input
              type="password"
              autoComplete="new-password"
              aria-label="New password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              autoFocus
              className="h-11 min-w-0 flex-1 rounded-md border border-hairline bg-well px-3 text-sm text-text-primary md:h-9"
            />
            <Button type="submit" variant="primary" loading={busy === "password"}>
              Set password
            </Button>
            <button type="button" onClick={() => setPasswordOpen(false)} className={outlineAction}>
              Cancel
            </button>
          </form>
        ) : (
          oauthCount > 0 && (
            <button type="button" onClick={() => setPasswordOpen(true)} className={outlineAction}>
              Set a password
            </button>
          )
        )}
      </div>

      {message && (
        <p
          role={message.tone === "error" ? "alert" : "status"}
          className={`mt-3 text-xs leading-5 ${message.tone === "error" ? "text-error" : "text-verified"}`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
