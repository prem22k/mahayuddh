# Backup restore

**Target RPO: 24 hours.** The nightly workflow (`.github/workflows/backup.yml`)
dumps the irreplaceable tables once a day at 02:30 UTC. Actual recovery-point loss
depends on the most recent successful backup, so check the run timestamp before
starting a restore.

## What is backed up

`pg_dump --data-only --column-inserts` of:

- `profiles`, `user_problem_status`, `problem_events`, `battles`
- `suggestions`, `approaches`, `primers`, `notebook_notes`
- `feed_events`, `notifications`
- `squads`, `squad_members`, `squad_goals`, `squad_milestones`, `squad_recaps`,
  `squad_referrals`, `squad_seasons`

Derived tables (`problems`, `catalog_sync_state`, `daily_battles`,
`sync_rate_limits`, analytics) are intentionally excluded — they rebuild from
the sync workflows.

The workflow encrypts each compressed dump with AES-256-CBC, PBKDF2, and 600,000
iterations before upload. The uploaded filename ends in **`.sql.gz.enc`**. It
requires the `BACKUP_PASSPHRASE` secret; keep a secure copy outside GitHub, since
it is required to decrypt every backup.

Artifacts live in two places:

1. GitHub Actions artifacts on the `Nightly backup` run (30-day retention).
2. Optional S3 copy at `s3://$BACKUP_S3_BUCKET/mahayuddh/` when the S3
   secrets are configured (skipped gracefully otherwise).

## Restore

You need the Supabase Postgres connection string (the same value as the
`SUPABASE_DB_URL` Actions secret — pooled port 6543 or direct port 5432 both
work for `psql`), the backup passphrase, `openssl`, `gzip`, and `psql`.

The dump contains ordinary `INSERT` statements, **not upserts**. It is not safe
to rerun into populated tables: existing primary keys will cause errors. Restore
to an empty/rebuilt target, or use a separately planned merge procedure. Do not
pipe this dump into a partially populated production database and assume that
later rows will replace earlier ones.

```bash
# 1. Download the newest encrypted artifact from the Actions tab
#    (Nightly backup → latest green run → mahayuddh-backup-<stamp>.sql.gz.enc),
#    or from S3:
aws s3 cp \
  "s3://$BACKUP_S3_BUCKET/mahayuddh/mahayuddh-backup-<stamp>.sql.gz.enc" \
  mahayuddh-backup-<stamp>.sql.gz.enc

# 2. Read the passphrase without putting it in shell history, then decrypt.
read -rsp 'Backup passphrase: ' BACKUP_PASSPHRASE; echo
export BACKUP_PASSPHRASE
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 \
  -pass env:BACKUP_PASSPHRASE \
  -in mahayuddh-backup-<stamp>.sql.gz.enc \
  -out mahayuddh-backup-<stamp>.sql.gz
unset BACKUP_PASSPHRASE

# 3. Check the compressed stream and inspect it before restoring.
gzip -t mahayuddh-backup-<stamp>.sql.gz
gzip -dc mahayuddh-backup-<stamp>.sql.gz | head -n 50

# 4. Restore into an EMPTY target. Stop on the first SQL error and make the
#    restore all-or-nothing rather than leaving a partially restored database.
gzip -dc mahayuddh-backup-<stamp>.sql.gz | \
  psql --set ON_ERROR_STOP=1 --single-transaction "$SUPABASE_DB_URL"

# 5. Verify row counts:
psql "$SUPABASE_DB_URL" -c "select 'profiles', count(*) from profiles union all \
  select 'battles', count(*) from battles union all \
  select 'user_problem_status', count(*) from user_problem_status;"
```

If restoring to an empty project, apply the current complete schema before the
data restore. Verify the migration/schema state first: `supabase/schema.sql` was
last regenerated through migration `20261105000001`, while the migration history
continues through `20261120000001`. Do not use that older snapshot as a current
production schema until it has been regenerated and checked. See `docs/RUNBOOK.md`
for the surrounding outage steps.
