"use strict";
// Tests for memory-guardrail-audit (Epic #3380 / #3385). node --test tests/memory-guardrail-audit.spec.js
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { auditMemoryDir, proposeMechanism } = require("../scripts/global/memory-guardrail-audit");

function makeFixtureDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mem-audit-"));
  fs.writeFileSync(path.join(dir, "MEMORY.md"), "# index — should be excluded\n");
  fs.writeFileSync(path.join(dir, "merge_gate_false_block.md"),
    "the merge-gate false-blocks via gh json; enforcer rejects the redirect");
  fs.writeFileSync(path.join(dir, "client_cost_over_speed.md"),
    "Client prefers cost over speed; patience over speed; never drop to a paid model");
  fs.writeFileSync(path.join(dir, "prose_collision.md"),
    "closeout regex collision: parser grabs first Team&Model line in prose");
  return dir;
}

test("excludes MEMORY.md index and classifies the rest", () => {
  const report = auditMemoryDir(makeFixtureDir());
  assert.strictEqual(report.entries.length, 3);
  assert.ok(!report.entries.some((entry) => entry.file === "MEMORY.md"));
});

test("mechanical defect notes route to guardrail-candidate with a proposed mechanism", () => {
  const report = auditMemoryDir(makeFixtureDir());
  const merge = report.entries.find((entry) => entry.file === "merge_gate_false_block.md");
  assert.strictEqual(merge.destination, "guardrail-candidate");
  assert.ok(["hook", "validator", "ci-backstop", "unit-test"].includes(merge.mechanism));
});

test("client preference note stays semantic-memory (anti-over-route)", () => {
  const report = auditMemoryDir(makeFixtureDir());
  const pref = report.entries.find((entry) => entry.file === "client_cost_over_speed.md");
  assert.strictEqual(pref.destination, "semantic-memory");
  assert.strictEqual(pref.mechanism, null);
});

test("counts tally to the number of audited entries", () => {
  const report = auditMemoryDir(makeFixtureDir());
  const total = Object.values(report.counts).reduce((sum, value) => sum + value, 0);
  assert.strictEqual(total, report.entries.length);
});

test("unreadable dir fails open (no throw)", () => {
  assert.doesNotThrow(() => {
    const report = auditMemoryDir("/nonexistent/dir/xyz");
    assert.strictEqual(report.error, "memory-dir-unreadable");
  });
});

test("proposeMechanism is deterministic and total", () => {
  assert.strictEqual(proposeMechanism("enforcer blocks the write"), "hook");
  assert.strictEqual(proposeMechanism("baton signer regex"), "validator");
  assert.strictEqual(typeof proposeMechanism("anything else"), "string");
});
