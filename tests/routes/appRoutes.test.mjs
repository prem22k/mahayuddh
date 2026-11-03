/**
 * The page-route list the session gate uses must match app/ exactly. A page
 * missing from the list would be served to signed-out visitors as a 404
 * instead of sending them to /login; an extra entry would send a typo to the
 * login form.
 *
 * Run: node --no-warnings --test tests/routes/appRoutes.test.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { APP_PAGE_ROUTES, isAppPage } from "../../lib/appRoutes.ts";

const APP = fileURLToPath(new URL("../../app", import.meta.url));

function pagesUnder(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...pagesUnder(full));
    else if (name === "page.tsx") {
      const segs = relative(APP, dir).split(sep).filter(Boolean)
        // Route groups and parallel slots do not appear in the URL.
        .filter((s) => !/^\(.*\)$/.test(s) && !s.startsWith("@"));
      out.push("/" + segs.join("/"));
    }
  }
  return out;
}

describe("app page routes", () => {
  it("lists every page.tsx in app/, and nothing else", () => {
    assert.deepEqual([...APP_PAGE_ROUTES].sort(), pagesUnder(APP).sort());
  });

  it("matches real pages, with params and a trailing slash", () => {
    for (const p of ["/", "/home", "/home/", "/practice/two-sum", "/practice/two-sum/compare",
      "/squad/abc/recaps/def", "/squad/join/DEMO2026", "/u/someone"]) {
      assert.equal(isAppPage(p), true, p);
    }
  });

  it("does not match paths no page serves", () => {
    for (const p of ["/does-not-exist", "/homee", "/practice/two-sum/extra", "/squad/abc",
      "/squad/abc/wall/extra", "/u", "/u/a/b", "/api/anything", "/.env"]) {
      assert.equal(isAppPage(p), false, p);
    }
  });
});
