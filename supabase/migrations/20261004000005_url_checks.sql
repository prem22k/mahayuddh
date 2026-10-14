-- Wave B trust-hardening: URL shape checks (surgical, no data rewrite).
--
-- App-side validators live in lib/security/urls.ts:
--   - profiles.avatar_url: https-only + exact-host allowlist. The hosts reuse
--     next.config images.remotePatterns (assets.leetcode.com, leetcode.com,
--     lh3.googleusercontent.com, avatars.githubusercontent.com) so the DB and
--     the image optimizer never disagree about which hosts are renderable.
--   - shared_resources.external_url: https-only, any host (vault articles can
--     legitimately link anywhere; the control is scheme, not host).
-- These CHECKs are the second layer: a writer that bypasses the app (direct
-- SQL, old client) still cannot store javascript:/data:/http: URLs.
-- Guards are check-exists DO blocks; no UPDATE/DELETE of existing rows.

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_avatar_url_check'
  ) then
    alter table public.profiles
      add constraint profiles_avatar_url_check check (
        avatar_url is null
        or (
          avatar_url like 'https://%'
          and char_length(avatar_url) <= 2048
          and (
            avatar_url = 'https://assets.leetcode.com'
            or avatar_url like 'https://assets.leetcode.com/%'
            or avatar_url = 'https://leetcode.com'
            or avatar_url like 'https://leetcode.com/%'
            or avatar_url = 'https://lh3.googleusercontent.com'
            or avatar_url like 'https://lh3.googleusercontent.com/%'
            or avatar_url = 'https://avatars.githubusercontent.com'
            or avatar_url like 'https://avatars.githubusercontent.com/%'
          )
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'shared_resources_external_url_check'
  ) then
    alter table public.shared_resources
      add constraint shared_resources_external_url_check check (
        external_url is null
        or (
          external_url like 'https://%'
          and char_length(external_url) <= 2048
        )
      );
  end if;
end
$$;
