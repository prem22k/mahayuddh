#!/usr/bin/env python3
"""
Make supabase/schema.sql re-runnable.

`supabase db dump` emits correct but not idempotent SQL: 118 bare CREATE POLICY,
131 bare ADD CONSTRAINT and 68 bare CREATE INDEX statements all fail on a second
run. README claims the file is "complete and idempotent on its own", and the
whole reason to keep a canonical schema is being able to re-run it to repair
drift — so the claim should be true rather than aspirational.

Three transforms, all of them preserving what the dump actually said:

  CREATE POLICY   → prefixed with DROP POLICY IF EXISTS
  ADD CONSTRAINT  → wrapped in a DO block guarded by pg_constraint
  CREATE INDEX    → IF NOT EXISTS

CREATE OR REPLACE FUNCTION / TRIGGER, CREATE TABLE IF NOT EXISTS, ENABLE ROW
LEVEL SECURITY, GRANT and COMMENT are already idempotent and are left alone.
"""
import re
import sys

PATH = "supabase/schema.sql"

src = open(PATH).read()

# Count what needs guarding first, so the summary below reports the real totals
# instead of a hard-coded number that goes stale every time the schema grows.
def count(pattern):
    return len(re.findall(pattern, src, re.MULTILINE))

# Count only the forms that still NEED guarding, so re-running this script on its
# own output reports zero rather than claiming it found 120 policies to guard.
#   - a guarded ADD CONSTRAINT sits inside a DO block, indented, so a line-start
#     ALTER TABLE matches only the unguarded form
#   - a guarded index already says IF NOT EXISTS
#   - a guarded policy is immediately preceded by its own DROP
want = {
    "constraints": count(r'^ALTER TABLE (?:ONLY )?.*\n[ \t]+ADD CONSTRAINT '),
    "indexes": count(r'^CREATE (UNIQUE )?INDEX (?!IF NOT EXISTS)'),
    "policies": sum(
        1
        for i, line in enumerate(src.split("\n"))
        if re.match(r'^CREATE POLICY ("[^"]+") ON ("public"\."[^"]+")', line)
        and (i == 0 or not src.split("\n")[i - 1].startswith("DROP POLICY IF EXISTS"))
    ),
}

# ── 1. ADD CONSTRAINT, inside `ALTER TABLE ONLY "public"."tbl"\n    ADD CONSTRAINT "name" ...;`
def guard_constraints(text: str) -> tuple[str, int]:
    pattern = re.compile(
        # Both spellings occur: ALTER TABLE ONLY for indexes/PKs/FKs, and bare
        # ALTER TABLE for the NOT VALID check constraints.
        r'^ALTER TABLE (?:ONLY )?("public"\."[^"]+")\n'
        r'([ \t]+)(ADD CONSTRAINT "[^"]+".*?;)$',
        re.MULTILINE | re.DOTALL,
    )
    count = 0

    def repl(m: re.Match) -> str:
        nonlocal count
        count += 1
        table, indent, body = m.group(1), m.group(2), m.group(3)
        conname = re.search(r'ADD CONSTRAINT "([^"]+)"', body).group(1)
        return (
            "DO $guard$\n"
            "BEGIN\n"
            "  IF NOT EXISTS (SELECT 1 FROM pg_constraint\n"
            # Single quotes, or "public"."tbl" parses as a column named "public".
            f"                 WHERE conname = '{conname}' AND conrelid = '{table}'::regclass) THEN\n"
            f"    ALTER TABLE {table}\n"
            f"    {body}\n"
            "  END IF;\n"
            "END\n"
            "$guard$;"
        )

    return pattern.sub(repl, text), count


# ── 2. CREATE POLICY → prefix a DROP POLICY IF EXISTS
def guard_policies(text: str) -> tuple[str, int]:
    count = 0
    out = []
    # Policy names contain spaces and capitals ("Everyone reads triage"), and the
    # trailing clause is lowercase in pg_dump output ("for select").
    pattern = re.compile(r'^CREATE POLICY ("[^"]+") ON ("public"\."[^"]+")')
    for line in text.split("\n"):
        m = pattern.match(line)
        if m:
            # Skip a policy already preceded by its own DROP, so running this
            # script twice does not stack duplicate DROPs. Without that, the
            # script was not idempotent even though the file it produced was.
            drop = f"DROP POLICY IF EXISTS {m.group(1)} ON {m.group(2)};"
            if not out or out[-1].strip() != drop:
                count += 1
                out.append(drop)
        out.append(line)
    return "\n".join(out), count


# ── 3. CREATE [UNIQUE ]INDEX → IF NOT EXISTS
def guard_indexes(text: str) -> tuple[str, int]:
    pattern = re.compile(r'^CREATE (UNIQUE )?INDEX ("[^"]+")', re.MULTILINE)
    return pattern.subn(r'CREATE \1INDEX IF NOT EXISTS \2', text)


out, n_con = guard_constraints(src)
out, n_pol = guard_policies(out)
out, n_idx = guard_indexes(out)

assert isinstance(out, str), f"transform produced {type(out)}, refusing to write"
with open(PATH, "w") as fh:
    fh.write(out)
print(f"guarded {n_con} ADD CONSTRAINT, {n_pol} CREATE POLICY, {n_idx} CREATE INDEX")
# Only under-guarding is a defect: something was found and not made re-runnable.
# Over-counting is expected on a second pass, since guarded CREATE POLICY and
# CREATE INDEX IF NOT EXISTS lines are still present in the file.
got = {"constraints": n_con, "policies": n_pol, "indexes": n_idx}
under = [k for k in want if got[k] < want[k]]
if under:
    # The regexes have drifted from the dump's formatting, so the file would be
    # only partly re-runnable while looking perfectly fine.
    print(
        f"ERROR: found {want} but guarded {got} — under-guarded: {under}. "
        "The patterns no longer match the dump; refusing to claim idempotency.",
        file=sys.stderr,
    )
    sys.exit(1)
