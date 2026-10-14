# Backup restore

**RPO: 24 hours.** The nightly workflow (`.github/workflows/backup.yml`) dumps
the irreplaceable tables once a day at 02:30 UTC, so the worst case data loss
after a restore is the last ~24 hours of writes.

## What is backed up

`pg_dump --data-only` of:

- `profiles`, `user_problem_status`, `problem_events`, `battles`
- `suggestions`, `approaches`, `primers`, `notebook_notes`
- `feed_events`, `notifications`
- `squads`, `squad_members`, `squad_goals`, `squad_milestones`, `squad_recaps`,
  `squad_referrals`, `squad_seasons`

Derived tables (`problems`, `catalog_sync_state`, `daily_battles`,
`sync_rate_limits`, analytics) are intentionally excluded — they rebuild from
the sync workflows.

Artifacts live in two places:

1. GitHub Actions artifacts on the `Nightly backup` run (30-day retention).
2. Optional S3 copy at `s3://$BACKUP_S3_BUCKET/mahayuddh/` when the S3
   secrets are configured (skipped gracefully otherwise).

## Restore

You need the Supabase Postgres connection string (the same value as the
`SUPABASE_DB_URL` Actions secret — pooled port 6543 or direct port 5432 both
work for `psql`).

```bash
# 1. Download the newest artifact from the Actions tab
#    (Nightly backup → latest green run → mahayuddh-backup-<stamp>.sql.gz),
#    or from S3:
aws s3 cp s3://$BACKUP_S3_BUCKET/mahayuddh/mahayuddh-backup-<stamp>.sql.gz .

# 2. Inspect before restoring (never pipe an unread file into prod):
gunzip -c mahayuddh-backup-<stamp>.sql.gz | head -n 50

# 3. Restore into Supabase (data-only INSERTs; re-runnable, later rows win
#    per primary key — for a clean-room rebuild, truncate the listed tables first):
gunzip -c mahayuddh-backup-<stamp>.sql.gz | psql "$SUPABASE_DB_URL"

# 4. Verify row counts:
psql "$SUPABASE_DB_URL" -c "select 'profiles', count(*) from profiles union all \
  select 'battles', count(*) from battles union all \
  select 'user_problem_status', count(*) from user_problem_status;"
```

If restoring to an empty project, apply the schema first
(`supabase/schema.sql` or the versioned `supabase/migrations/`), then run the
data restore above. See `docs/RUNBOOK.md` for the surrounding outage steps.
