#!/usr/bin/env node
/**
 * Compile and run every primer code snippet, with its hidden checks.
 *
 *   node scripts/check-primer-code.mjs            # every primer
 *   node scripts/check-primer-code.mjs sliding-window
 *
 * Snippets live in content/primers/<slug>/code/<name>.{py,cpp,java}. Each file
 * runs on its own: setup lines, then "---- code ----" (what readers see), then
 * "---- checks ----" (asserts readers never see). A template that doesn't
 * compile, or gives a wrong answer, fails here instead of on someone's screen.
 *
 * Java uses a JDK on PATH, or else a running Docker with the eclipse-temurin
 * image. With neither, Java snippets are reported SKIPPED (never as passing)
 * and the run exits non-zero unless --allow-skip is given.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readdirSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const CONTENT = path.join(ROOT, "content/primers");
const args = process.argv.slice(2);
const allowSkip = args.includes("--allow-skip");
const only = args.filter((a) => !a.startsWith("--"));

function has(cmd, probe) {
  const r = spawnSync(cmd, probe, { stdio: "ignore" });
  return r.status === 0;
}
const javaOk = has("javac", ["-version"]) && has("java", ["-version"]);
const dockerOk = !javaOk && has("docker", ["info"]);
const JDK_IMAGE = "eclipse-temurin:21-jdk";

function run(file) {
  const ext = path.extname(file);
  const dir = mkdtempSync(path.join(tmpdir(), "primer-"));
  try {
    if (ext === ".py") {
      execFileSync("python3", ["-I", file], { stdio: "pipe" });
    } else if (ext === ".cpp") {
      const bin = path.join(dir, "a.out");
      const cxx = has("g++", ["--version"]) ? "g++" : "clang++";
      execFileSync(cxx, ["-std=c++17", "-Wall", "-O1", "-o", bin, file], { stdio: "pipe" });
      execFileSync(bin, { stdio: "pipe" });
    } else if (ext === ".java") {
      const src = path.join(dir, "Snippet.java");
      copyFileSync(file, src);
      if (javaOk) {
        execFileSync("javac", ["-d", dir, src], { stdio: "pipe" });
        execFileSync("java", ["-ea", "-cp", dir, "Main"], { stdio: "pipe" });
      } else if (dockerOk) {
        execFileSync("docker", ["run", "--rm", "-v", `${dir}:/w`, JDK_IMAGE, "sh", "-c",
          "javac -d /w /w/Snippet.java && java -ea -cp /w Main"], { stdio: "pipe" });
      } else {
        return "SKIPPED (no JDK on PATH and no Docker)";
      }
    } else {
      return null;
    }
    return "ok";
  } catch (e) {
    const out = `${e.stdout ?? ""}${e.stderr ?? ""}`.trim().split("\n").slice(0, 8).join("\n");
    return `FAIL\n${out}`;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

let failed = 0;
let skipped = 0;
let passed = 0;
const primers = readdirSync(CONTENT, { withFileTypes: true })
  .filter((d) => d.isDirectory() && (only.length === 0 || only.includes(d.name)))
  .map((d) => d.name)
  .sort();
for (const slug of primers) {
  const codeDir = path.join(CONTENT, slug, "code");
  if (!existsSync(codeDir)) continue;
  for (const name of readdirSync(codeDir).sort()) {
    const result = run(path.join(codeDir, name));
    if (result === null) continue;
    const label = `${slug}/${name}`;
    if (result === "ok") passed++;
    else if (result.startsWith("SKIPPED")) skipped++;
    else failed++;
    console.log(`${result === "ok" ? "PASS" : result.startsWith("SKIPPED") ? "SKIP" : "FAIL"}  ${label}${result === "ok" ? "" : `  ${result.replace(/^FAIL\n/, "\n        ")}`}`);
  }
}
console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped`);
process.exit(failed > 0 || (skipped > 0 && !allowSkip) ? 1 : 0);
