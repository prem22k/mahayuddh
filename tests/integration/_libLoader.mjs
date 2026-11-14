/**
 * Node module hooks so an integration test can import the app's real data
 * functions (lib/data/*.ts) instead of re-typing their queries.
 *
 *   - "@/x" resolves to <repo>/x(.ts|.tsx|/index.ts), like tsconfig paths.
 *   - "@/lib/supabase/client" becomes a stub whose createClient() returns
 *     globalThis.__testSupabase: a signed-in supabase-js client, so RLS and
 *     auth.uid() behave as they do for that user in the browser.
 *   - "@/types/database" is types only; it is replaced by a module exporting
 *     each declared name as undefined, because files import those names
 *     without `import type` and stripping types leaves the import behind.
 *
 * Use: node --experimental-strip-types --import ./tests/integration/_libRegister.mjs <test>
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CLIENT_STUB = "test-stub:supabase-client";
const TYPES_STUB = "test-stub:types-database";

function fileFor(spec) {
  const base = path.join(ROOT, spec.slice(2));
  for (const c of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return null;
}

export async function resolve(spec, context, next) {
  if (spec === "@/lib/supabase/client") return { url: CLIENT_STUB, shortCircuit: true };
  if (spec === "@/types/database") return { url: TYPES_STUB, shortCircuit: true };
  if (spec.startsWith("@/")) {
    const file = fileFor(spec);
    if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
  }
  return next(spec, context);
}

export async function load(url, context, next) {
  if (url === CLIENT_STUB) {
    return {
      format: "module",
      shortCircuit: true,
      source: "export function createClient() { if (!globalThis.__testSupabase) throw new Error('set globalThis.__testSupabase first'); return globalThis.__testSupabase; }",
    };
  }
  if (url === TYPES_STUB) {
    const src = readFileSync(path.join(ROOT, "types/database.ts"), "utf8");
    const names = new Set([...src.matchAll(/^export\s+(?:type|interface|enum)\s+(\w+)/gm)].map((m) => m[1]));
    return {
      format: "module",
      shortCircuit: true,
      source: [...names].map((n) => `export const ${n} = undefined;`).join("\n"),
    };
  }
  return next(url, context);
}
