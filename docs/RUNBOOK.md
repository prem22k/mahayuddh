# Operations runbook

Primary host is Vercel. Render free runs a dormant backup copy that the
5-minute probe workflow (`probe.yml`) wakes only while the primary is down.
Supabase holds all state. RPO is 24 hours via the nightly backup.

## Quick map

- Health: `GET /api/health` → `{ ok: true, db: "up" | "down" }` (200 when up,
  503 when down, never leaks details).
- Failover hub: `/offline` (auto-retry + countdown, backup button after
  2 failed retries). Same backup button lives in `app/global-error.tsx`.
- Backup banner: shown on all pages when `NEXT_PUBLIC_BACKUP_MODE=true`.
- Nightly backup: `.github/workflows/backup.yml` → artifact (30 days) +
  optional S3. Restore steps: `docs/RESTORE.md`.
- Probe: `.github/workflows/probe.yml` every 5 minutes.

Note: `render.yaml` is owned elsewhere and was intentionally not modified.
Its `healthCheckPath` still points at `/`. If you own that file, point it at
`/api/health` so Render's own checks match the probe.

## Sync resume-offset replay

The stats sync pages 5 handles per call. When the workflow summary reports
failed handles, replay just the failed page instead of the whole squad:

```bash
APP_URL="<host-only, e.g. mahayuddh.vercel.app>"
# Find the failed offset from the workflow summary, then:
curl -f "https://${APP_URL}/api/sync/leetcode?limit=5&offset=20" \
  -H "Authorization: Bearer ${CRON_SECRET}"
# Step offset by 5 until hasMore != true.
```

`failed.length > 0` on any page fails the workflow step and appends the
handles to the job summary. The catalog job stays best-effort (exit-0 with an
explicit comment) because it is rebuildable derived data.

## CRON_SECRET rotation

1. Generate: `openssl rand -hex 32`.
2. Update in three places: Vercel env (`CRON_SECRET`), Render dashboard env
   (`CRON_SECRET`), GitHub repo secret (`CRON_SECRET` for `sync.yml`).
3. Redeploy Vercel + Render (env-only change needs a restart).
4. Verify: replay one sync page with the new secret (above). A wrong secret
   returns 401/400 and logs `cron.denied` without leaking the value.
5. Old secret stops working immediately — there is no grace period.

## Supabase unpause

Free-tier projects pause after inactivity.

1. Open the Supabase dashboard → project → **Unpause / Resume**.
2. Wait 1–2 minutes for the database to accept connections.
3. Verify: `curl -f "https://<primary-host>/api/health"` should return
   `{"ok":true,"db":"up"}`.
4. If still `db:"down"`, check the Supabase project status page and the
   `SUPABASE_SERVICE_ROLE_KEY` / anon key envs on the host before retrying.

## Render wake and flip-back

Wake is automatic (probe resumes on 2 consecutive failures and opens a
`[probe]` issue), but manual steps work the same:

```bash
# Wake:
curl -X POST "https://api.render.com/v1/services/${RENDER_SERVICE_ID}/resume" \
  -H "Authorization: Bearer ${RENDER_API_KEY}" \
  -H "Accept: application/json"
# The backup needs about a minute to wake; users must sign in again there.

# Flip back after recovery (probe does this after 2 consecutive successes):
curl -X POST "https://api.render.com/v1/services/${RENDER_SERVICE_ID}/suspend" \
  -H "Authorization: Bearer ${RENDER_API_KEY}" \
  -H "Accept: application/json"
```

Set `NEXT_PUBLIC_BACKUP_URL` (primary) to the Render origin so `/offline`
shows the backup button, and `NEXT_PUBLIC_BACKUP_MODE=true` (backup) to show
the backup stripe. Flip-back: confirm two healthy probes, suspend Render,
close the incident issue, unset backup mode.

Missing `APP_URL`, `RENDER_API_KEY`, or `RENDER_SERVICE_ID` makes the probe
skip with a warning — never red.

## Backup restore

See `docs/RESTORE.md` for exact commands. Summary: download the newest
`mahayuddh-backup-<stamp>.sql.gz` artifact (or S3 copy), inspect with
`gunzip -c … | head`, pipe into `psql "$SUPABASE_DB_URL"`, verify counts.
Schema first on an empty project, data second.
