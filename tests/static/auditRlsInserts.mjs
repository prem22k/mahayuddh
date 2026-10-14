/**
 * Audit: every client-side .insert() must supply the columns its RLS insert
 * policy checks, or a trigger must fill them.
 *
 * Browser testing found two real breakages this way (stuck_requests.user_id and
 * stuck_replies.author_id were never sent, while their policies require them).
 * Both had passed the integration suite because it inserts through the service
 * role, which bypasses RLS. So this check compares the insert payload against
 * the policy text.
 */
import { readFileSync, readdirSync } from "node:fs";
import process from "node:process";

const ROOT = process.env.REPO_ROOT ?? process.cwd();
const files = [];
const walk = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) {
      // Skip build output and vendored code: neither runs under RLS.
      if (["node_modules", ".next", ".git"].includes(e.name)) continue;
      walk(p);
    } else if (/\.tsx?$/.test(e.name)) files.push(p);
  }
};
walk(`${ROOT}/lib`);
walk(`${ROOT}/app`);

// Columns each table's insert policies reference in `with check (... = <col>)`.
const POLICY_OWNERS = {
  stuck_requests: ["user_id"],
  stuck_replies: ["author_id"],
  suggestions: ["from_user"],
  notebook_notes: ["owner_id"],
  shared_resources: ["author_id"],
  approaches: ["user_id"],
  primers: ["author_id"],
  feed_events: ["user_id"],
  problem_events: ["user_id"],
  battles: ["user_id"],
  discussions: ["author_id"],
  discussion_replies: ["author_id"],
  follows: ["follower_id"],
  user_blocks: ["blocker_id"],
  feed_reports: ["reporter_id"],
  contest_reminders: [],
};

const hits = [];
for (const f of files) {
  const src = readFileSync(f, "utf8");
  // .from("table").insert({ ... }) — capture the object literal that follows.
  const re = /\.from\(\s*"([a-z_]+)"\s*\)[\s\S]{0,40}?\.insert\(\s*\{/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const table = m[1];
    const required = POLICY_OWNERS[table];
    if (!required || required.length === 0) continue;
    // Walk the object literal to its close.
    let depth = 0, i = m.index + m[0].length - 1, end = i;
    for (; i < src.length; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
    }
    const body = src.slice(m.index + m[0].length - 1, end + 1);
    for (const col of required) {
      const has = new RegExp(`(^|[{,\\s])${col}\\s*:`).test(body);
      if (!has) {
        const line = src.slice(0, m.index).split("\n").length;
        hits.push({ file: f.replace(`${ROOT}/`, ""), table, col, line });
      }
    }
  }
}

if (hits.length === 0) {
  console.log("PASS  every client insert supplies the columns its RLS policy checks");
} else {
  console.log(`FAIL  ${hits.length} insert(s) omit a column their RLS policy requires:\n`);
  for (const h of hits) {
    console.log(`        ${h.file}:${h.line}  ${h.table} omits ${h.col}`);
  }
  console.log("\nEach of these fails for every real user at runtime. The integration\n"
    + "suites do not catch it because they insert through the service role, which\n"
    + "bypasses RLS and supplies the column itself.");
  process.exit(1);
}
