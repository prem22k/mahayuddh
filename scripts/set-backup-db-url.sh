#!/usr/bin/env bash
# Set the SUPABASE_DB_URL Actions secret that .github/workflows/backup.yml uses,
# but only after proving the password logs in.
#
#   bash scripts/set-backup-db-url.sh
#
# Asks for the database password without echoing it, URL-encodes it (symbols
# are fine), tests a login through the session pooler from this machine, and
# saves the secret only if that login works. The password is never printed and
# never passed as a command-line argument (it travels on stdin).
#
# Needs: python3, gh (logged in), and a psql: either on PATH or inside the
# local Supabase Docker container (npx supabase start).
set -euo pipefail

REF=$(cat supabase/.temp/project-ref 2>/dev/null || true)
POOLER=$(sed -E 's#^.*@([^:/]+).*$#\1#' supabase/.temp/pooler-url 2>/dev/null || true)
if [[ -z "$REF" || -z "$POOLER" ]]; then
  echo "This checkout isn't linked to the Supabase project. Run: npx supabase@latest link" >&2
  exit 1
fi

URL=$(python3 -I -c '
import getpass, sys, urllib.parse
p = getpass.getpass("Database password (from Supabase > Project Settings > Database): ")
if not p:
    sys.exit("No password entered.")
sys.stdout.write("postgresql://postgres.%s:%s@%s:5432/postgres" % (sys.argv[1], urllib.parse.quote(p, safe=""), sys.argv[2]))
' "$REF" "$POOLER")

echo "Testing the login against $POOLER ..."
probe='read -r U; psql "$U" -tAc "select current_user" -v ON_ERROR_STOP=1'
if command -v psql >/dev/null 2>&1; then
  out=$(printf '%s\n' "$URL" | sh -c "$probe" 2>&1) || { echo "Login failed: ${out##*FATAL:}" >&2; echo "Nothing was saved. Check the password in Supabase and run this again." >&2; exit 1; }
else
  DB=$(docker ps --format '{{.Names}}' | grep -m1 supabase_db || true)
  if [[ -z "$DB" ]]; then
    echo "No psql found. Install it (brew install libpq) or start the local stack (npx supabase start)." >&2
    exit 1
  fi
  out=$(printf '%s\n' "$URL" | docker exec -i "$DB" sh -c "$probe" 2>&1) || { echo "Login failed: ${out##*FATAL:}" >&2; echo "Nothing was saved. Check the password in Supabase and run this again." >&2; exit 1; }
fi
echo "Login works."

printf '%s' "$URL" | gh secret set SUPABASE_DB_URL
echo "Saved SUPABASE_DB_URL. Next: gh workflow run backup.yml"
