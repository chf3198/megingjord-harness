"use strict";
// Unit tests for friction-classifier (Epic #3380 / #3382). Run: node --test tests/friction-classifier.spec.js
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const { classifyFriction } = require("../scripts/global/friction-classifier");
const { evaluate, loadCorpus } = require("../scripts/global/friction-classifier-replay-eval");

const LEX = path.join(__dirname, "..", "config", "friction-lexicon.json");
const opt = { lexiconPath: LEX };

test("deterministic mechanical defect -> guardrail-candidate", () => {
  const r = classifyFriction({ _summary: "merge-gate false-block via gh json", gate: "merge-gate", recurrence_7d: 3, severity: "high" }, opt);
  assert.strictEqual(r.destination, "guardrail-candidate");
});

test("client directive / preference -> semantic-memory", () => {
  const r = classifyFriction({ _summary: "client prefers cost over speed", trigger_role: "client" }, opt);
  assert.strictEqual(r.destination, "semantic-memory");
});

test("anti-over-route: mechanical + judgment collision -> semantic-memory (ambiguous)", () => {
  const r = classifyFriction({ _summary: "client prefers the gate stay strict even when it false-blocks", gate: "merge-gate", recurrence_7d: 2, severity: "medium", trigger_role: "client" }, opt);
  assert.strictEqual(r.destination, "semantic-memory");
  assert.strictEqual(r.ambiguous, true);
});

test("multi-step correct procedure -> skill", () => {
  const r = classifyFriction({ _summary: "recovery runbook", steps: ["a", "b", "c", "d"] }, opt);
  assert.strictEqual(r.destination, "skill");
});

test("one-off below recurrence floor -> forget", () => {
  const r = classifyFriction({ _summary: "transient 401 self-heals", recurrence_7d: 1, severity: "low" }, opt);
  assert.strictEqual(r.destination, "forget");
});

test("fail-open: empty record -> semantic-memory, never throws", () => {
  const r = classifyFriction({}, opt);
  assert.strictEqual(r.destination, "semantic-memory");
});

test("fail-open: garbage/null input never throws", () => {
  assert.doesNotThrow(() => classifyFriction(null, opt));
  assert.doesNotThrow(() => classifyFriction({ recurrence_7d: "x", severity: 42, steps: "nope" }, opt));
});

test("replay-eval on corpus meets precision gate (>=0.85)", () => {
  const res = evaluate(loadCorpus(), opt);
  assert.ok(res.accuracy >= 0.85, `accuracy ${res.accuracy} < 0.85; misses ${JSON.stringify(res.misses)}`);
  assert.ok(res.precision >= 0.85, `guardrail precision ${res.precision} < 0.85`);
  assert.strictEqual(res.promotionEligible, true);
});
