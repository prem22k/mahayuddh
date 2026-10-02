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
    for line in text.split("\n"):
        # Policy names contain spaces and capitals ("Everyone reads triage"),
        # and the trailing clause is lowercase in pg_dump output ("for select").
        m = re.match(r'^CREATE POLICY ("[^"]+") ON ("public"\."[a-z_0-9]+")', line)
        if m:
            count += 1
            out.append(f'DROP POLICY IF EXISTS {m.group(1)} ON {m.group(2)};')
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
if n_idx != 68:
    print(f"WARNING: expected 68 indexes, matched {n_idx}", file=sys.stderr)
    sys.exit(1)
