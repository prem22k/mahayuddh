#!/usr/bin/env bash
#
# Apply the repo's migrations that the linked Supabase project hasn't recorded.
#
#   bash scripts/push-migrations.sh            # list pending, confirm, apply
#   bash scripts/push-migrations.sh --dry-run  # list pending only
#
# Why not `supabase db push`: supabase/config.toml keeps [db.migrations]
# disabled because the local stack is built from schema.sql, and `db push`
# then skips every migration. This uses the logged-in CLI's Management API
# path instead (`supabase db query --remote`), which needs no database
# password. Each migration runs in one transaction together with its row in
# supabase_migrations.schema_migrations, so a failure leaves neither the
# change nor the record behind, and the next run picks up where it stopped.
#
# Run from the checkout that is linked to the project (`supabase link`).

set -euo pipefail

DRY_RUN=0
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

cd "$(git rev-parse --show-toplevel)"
LINK=supabase/.temp/linked-project.json
if [[ ! -f "$LINK" ]]; then
  echo "This checkout isn't linked to a Supabase project. Run: npx supabase@latest link"
  exit 1
fi
TARGET=$(python3 -I -c 'import json,sys; j=json.load(open(sys.argv[1])); print(j.get("name","?") + " (" + j.get("ref","?") + ")")' "$LINK")

# --agent no + --output-format json: the same plain JSON array whether this
# runs in a person's terminal (which would otherwise get a table) or an agent.
query_json() {
  npx -y supabase@latest db query --remote --read-only --agent no --output-format json "$1" 2>/dev/null
}

applied=$(query_json "select version from supabase_migrations.schema_migrations" | python3 -I -c '
import json, sys
s = sys.stdin.read()
start = min((i for i in (s.find("["), s.find("{")) if i >= 0), default=-1)
if start < 0:
    sys.exit("Could not read the migration history from the Supabase CLI. Run: npx supabase@latest login")
data = json.loads(s[start:])
rows = data["rows"] if isinstance(data, dict) else data
print("\n".join(r["version"] for r in rows))')

pending=()
for f in supabase/migrations/*.sql; do
  v=$(basename "$f" | cut -d_ -f1)
  grep -qx "$v" <<<"$applied" || pending+=("$f")
done

echo "Target: $TARGET"
if (( ${#pending[@]} == 0 )); then
  echo "Nothing to apply: every migration in supabase/migrations is recorded."
  exit 0
fi
echo "Pending (${#pending[@]}), in order:"
printf '  %s\n' "${pending[@]##*/}"
(( DRY_RUN )) && exit 0

read -r -p "Apply these to $TARGET now? [y/N] " reply
[[ "$reply" =~ ^[Yy] ]] || { echo "Nothing applied."; exit 1; }

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
for f in "${pending[@]}"; do
  base=$(basename "$f" .sql)
  v=${base%%_*}; name=${base#*_}
  # Unique dollar-quote tag so the file's own $$ blocks can't end the literal.
  tag="mig_$(date +%s%N)"
  {
    echo "begin;"
    cat "$f"
    echo ";"
    printf "insert into supabase_migrations.schema_migrations (version, name, statements)\n"
    printf "values ('%s', '%s', array[\$%s\$" "$v" "$name" "$tag"
    cat "$f"
    printf "\$%s\$]);\n" "$tag"
    echo "commit;"
  } > "$tmp/$base.sql"
  echo "→ $base"
  # --yes: you confirmed above; the CLI's own prompt can't show with output
  # going to a file.
  if ! npx -y supabase@latest db query --remote --agent no --yes -f "$tmp/$base.sql" > "$tmp/$base.out" 2>&1; then
    echo "  failed; stopped here. Nothing from this migration was kept. Output:"
    tail -n 20 "$tmp/$base.out" | sed 's/^/    /'
    exit 1
  fi
  echo "  applied and recorded"
done
echo "Done."
