/**
 * The provider seam, against a mock. RUNS LOCALLY — no model is called.
 *
 * lib/ai/provider.ts is the one file in this app that talks to a network service
 * on the strength of an environment variable. Until somebody sets a key it is
 * dead code, and dead code at a trust boundary is exactly the kind that is wrong
 * in a way nobody finds out about until it matters.
 *
 * So the wire contract is tested against a local HTTP server that speaks the two
 * APIs: the request is inspected (system preamble present, ladder level named,
 * timeout set) and a range of responses is fed back, including the ones a model
 * actually produces when it is not cooperating.
 *
 * No test hits a real provider. There is no key in CI, and a suite that needed
 * one would be a suite that silently stops running.
 *
 * Run: node tests/ai/provider.mjs
 */
import http from "node:http";
import assert from "node:assert/strict";
import { askLadder, askBounded, parseEnvelope, providerConfigForTest } from "../../lib/ai/provider.ts";

let passed = 0;
const failures = [];
async function check(label, fn) {
  try {
    await fn();
    passed++;
    process.stdout.write(`  ✓ ${label}\n`);
  } catch (e) {
    failures.push(`${label}: ${e.message}`);
    process.stdout.write(`  ✗ ${label}\n    ${e.message}\n`);
  }
}

/** Spin a mock provider that records the request and replies with `reply`. */
async function withMock(reply, fn, { status = 200, provider = "openai" } = {}) {
  const seen = [];
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      seen.push({ url: req.url, headers: req.headers, body: JSON.parse(body || "{}") });
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(typeof reply === "string" ? reply : JSON.stringify(reply));
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address();
  try {
    return await fn({ baseUrl: `http://127.0.0.1:${port}/v1`, apiKey: "test-key", name: provider }, seen);
  } finally {
    await new Promise((r) => server.close(r));
  }
}

const OK_REPLY = {
  choices: [{ message: { content: '{"level":"nudge","text":"What is the first thing you would check?"}' } }],
};

async function main() {
  console.log("Provider seam — the request we send\n");

  const config = providerConfigForTest({ baseUrl: "x", apiKey: "k" });
  assert.ok(config, "providerConfigForTest must build a config");

  await check("the §45 preamble is in the system message, every call", async () => {
    await withMock(OK_REPLY, async (cfg, seen) => {
      await askLadder({ config: cfg, requestedLevel: "pattern" });
      const sys = seen[0].body.messages[0];
      assert.equal(sys.role, "system");
      assert.match(sys.content, /helping a developer learn/i);
      assert.match(sys.content, /Never give a complete solution/i);
    });
  });

  await check("the requested ladder level is named in the instruction", async () => {
    await withMock(OK_REPLY, async (cfg, seen) => {
      await askLadder({ config: cfg, requestedLevel: "direction" });
      const user = seen[0].body.messages[1].content;
      assert.match(user, /exactly the "direction" level/i);
      assert.match(user, /one line of JSON/i);
    });
  });

  await check("each level gets its own instruction, not a generic one", async () => {
    const seenLevels = [];
    for (const level of ["nudge", "pattern", "direction", "full"]) {
      await withMock(OK_REPLY, async (cfg, seen) => {
        await askLadder({ config: cfg, requestedLevel: level });
        seenLevels.push(seen[0].body.messages[1].content);
      });
    }
    assert.equal(new Set(seenLevels).size, 4, "two levels produced the same instruction");
    // "nudge" must not be allowed to become a direction.
    assert.match(seenLevels[0], /not a direction/i);
    assert.doesNotMatch(seenLevels[2], /one short question or observation/i);
  });

  await check("the scratchpad is included when present and omitted when not", async () => {
    await withMock(OK_REPLY, async (cfg, seen) => {
      await askLadder({ config: cfg, requestedLevel: "nudge", scratchpad: "tried the hash map, got a key error" });
      assert.match(seen[0].body.messages[1].content, /tried the hash map/);
    });
    await withMock(OK_REPLY, async (cfg, seen) => {
      await askLadder({ config: cfg, requestedLevel: "nudge" });
      assert.doesNotMatch(seen[0].body.messages[1].content, /scratchpad/i);
    });
  });

  await check("a very long scratchpad is clipped rather than sent whole", async () => {
    await withMock(OK_REPLY, async (cfg, seen) => {
      await askLadder({ config: cfg, requestedLevel: "nudge", scratchpad: "x".repeat(50000) });
      const user = seen[0].body.messages[1].content;
      assert.ok(user.length < 6000, `instruction was ${user.length} chars`);
      assert.match(user, /…$/m);
    });
  });

  await check("the key travels in the header, never the body", async () => {
    await withMock(OK_REPLY, async (cfg, seen) => {
      await askLadder({ config: cfg, requestedLevel: "nudge" });
      assert.equal(seen[0].headers.authorization, "Bearer test-key");
      assert.ok(!JSON.stringify(seen[0].body).includes("test-key"), "the key leaked into the request body");
    });
  });

  await check("output is capped", async () => {
    await withMock(OK_REPLY, async (cfg, seen) => {
      await askLadder({ config: cfg, requestedLevel: "nudge" });
      assert.ok(seen[0].body.max_tokens > 0 && seen[0].body.max_tokens <= 1000,
        `max_tokens was ${seen[0].body.max_tokens}`);
    });
  });

  await check("the Anthropic wire format uses x-api-key and a system field", async () => {
    await withMock({ content: [{ type: "text", text: '{"level":"pattern","text":"Two pointers."}' }] },
      async (cfg, seen) => {
        await askLadder({ config: cfg, requestedLevel: "pattern" });
        assert.equal(seen[0].url, "/v1/messages");
        assert.equal(seen[0].headers["x-api-key"], "test-key");
        assert.ok(!("system" in seen[0].body.messages[0]), "system belongs at the top level, not in messages");
        assert.match(seen[0].body.system, /helping a developer learn/i);
      }, { provider: "anthropic" });
  });

  console.log("\nthe failures a provider actually has\n");

  await check("a 401 becomes a credentials message, not the provider's body", async () => {
    await withMock({ error: { message: "Incorrect API key provided: sk-live-abc123" } },
      async (cfg) => {
        await assert.rejects(
          () => askLadder({ config: cfg, requestedLevel: "nudge" }),
          (e) => {
            assert.match(e.message, /rejected this deployment's credentials/i);
            // The upstream body quoted the key. It must not reach the message.
            assert.ok(!e.message.includes("sk-live-abc123"), "the key was surfaced in the user-facing message");
            assert.ok(!e.message.includes("Incorrect API key"), "the provider's body was surfaced verbatim");
            return true;
          },
        );
      }, { status: 401 });
  });

  await check("a 429 says rate limited and stays retryable-sounding", async () => {
    await withMock({ error: "slow down" }, async (cfg) => {
      await assert.rejects(() => askLadder({ config: cfg, requestedLevel: "nudge" }),
        (e) => { assert.match(e.message, /rate limiting/i); return true; });
    }, { status: 429 });
  });

  await check("a 500 is a plain message with no upstream detail", async () => {
    await withMock({ error: "upstream exploded at 10.0.0.7" }, async (cfg) => {
      await assert.rejects(() => askLadder({ config: cfg, requestedLevel: "nudge" }),
        (e) => {
          assert.match(e.message, /could not answer right now/i);
          assert.ok(!e.message.includes("10.0.0.7"), "an internal address leaked into the message");
          return true;
        });
    }, { status: 500 });
  });

  await check("an empty completion is an error, not an empty hint", async () => {
    await withMock({ choices: [{ message: { content: "" } }] }, async (cfg) => {
      await assert.rejects(() => askLadder({ config: cfg, requestedLevel: "nudge" }),
        (e) => { assert.match(e.message, /empty answer/i); return true; });
    });
  });

  await check("a response with no choices at all is an error", async () => {
    await withMock({}, async (cfg) => {
      await assert.rejects(() => askLadder({ config: cfg, requestedLevel: "nudge" }),
        (e) => { assert.match(e.message, /empty answer/i); return true; });
    });
  });

  console.log("\nparsing what the model sends back\n");

  await check("well-formed JSON is read, with its level", () => {
    const r = parseEnvelope('{"level":"pattern","text":"Sliding window."}');
    assert.equal(r.level, "pattern");
    assert.equal(r.text, "Sliding window.");
  });

  await check("JSON in a code fence is still read", () => {
    const r = parseEnvelope('```json\n{"level":"direction","text":"Try the monotonic stack."}\n```');
    assert.equal(r.level, "direction");
    assert.equal(r.text, "Try the monotonic stack.");
  });

  await check("JSON preceded by a sentence is still read", () => {
    const r = parseEnvelope('Sure! {"level":"nudge","text":"What changed?"} Hope that helps.');
    assert.equal(r.level, "nudge");
    assert.equal(r.text, "What changed?");
  });

  await check("a level that is not on the ladder is refused, not trusted", () => {
    // Defaulting to the requested level here would let a model that ignored the
    // instruction have its claim accepted. Defaulting low keeps the ceiling.
    const r = parseEnvelope('{"level":"complete_solution","text":"Here is everything."}');
    assert.equal(r.level, "nudge");
    assert.equal(r.text, "Here is everything.");
  });

  await check("prose instead of JSON still yields usable text", () => {
    const r = parseEnvelope("Ask yourself whether the array is sorted.");
    assert.equal(r.level, "nudge");
    assert.equal(r.text, "Ask yourself whether the array is sorted.");
  });

  await check("an empty text field falls back to the raw response", () => {
    const r = parseEnvelope('{"level":"pattern","text":"   "}');
    assert.ok(r.text.length > 0, "an empty hint would render as a blank card");
  });

  await check("malformed JSON does not throw", () => {
    for (const bad of ['{"level":"nudge","text":', "{not json at all}", "```json\n{oops\n```", ""]) {
      const r = parseEnvelope(bad);
      assert.equal(typeof r.text, "string");
      assert.ok(LEVEL_RANK_OK(r.level));
    }
  });

  await check("a code fence INSIDE the JSON does not destroy the level claim", () => {
    // The bug this pins: the fence-stripping used to run before JSON extraction,
    // so a model that quoted its own code — precisely what it does when it
    // oversteps — had its envelope discarded and silently downgraded. The safe
    // direction, but it lost the fact that the model had claimed "full", which is
    // the thing the ladder audit reads.
    const r = parseEnvelope('{"level":"full","text":"```python def f(): pass ```"}');
    assert.equal(r.level, "full", "the level claim was lost to an inner code fence");
    assert.match(r.text, /def f/);
  });

  await check("a model claiming 'full' for a nudge request is clamped by the caller", async () => {
    // parseEnvelope returns what the model said; the ceiling is enforced by
    // sanitizeAnswer, which is what gate.ts calls. Assert the pair together so
    // neither can be changed alone.
    const { sanitizeAnswer } = await import("../../lib/ai/policy.ts");
    // Single-line on purpose: a real newline inside a JSON string value is
    // invalid JSON, so the previous version exercised the prose fallback instead
    // of the clamp it claimed to test.
    const claimed = parseEnvelope('{"level":"full","text":"```python def f(): pass ``` Here is the code."}');
    const clean = sanitizeAnswer("nudge", claimed);
    assert.equal(clean.level, "nudge", "the ceiling did not hold");
    assert.equal(clean.pulledDown, true);
    assert.doesNotMatch(clean.text, /def f/, "the code block survived sanitisation");
  });

  console.log("\nthe non-ladder features share the same bounds\n");

  await check("askBounded sends the preamble and returns prose", async () => {
    await withMock(OK_REPLY, async (cfg, seen) => {
      const out = await askBounded({ config: cfg, instruction: "Name the concept they missed." });
      assert.match(seen[0].body.messages[0].content, /helping a developer learn/i);
      assert.equal(typeof out, "string");
    });
  });

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) { failures.forEach((f) => console.log(`  ✗ ${f}`)); process.exitCode = 1; }
}

function LEVEL_RANK_OK(level) {
  return ["nudge", "pattern", "direction", "full"].includes(level);
}

main().catch((e) => { console.error(`\nharness error: ${e.message}`); process.exitCode = 1; });