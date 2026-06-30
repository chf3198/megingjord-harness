"use strict";
// Tests for guardrail-conversion-signal (Epic #3380 / #3386).
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  buildConversionSignal, emitConversionSignal, mechanismBreakdown,
} = require("../scripts/global/guardrail-conversion-signal");
const { isValidV3 } = require("../scripts/global/event-schema-v3");

function fixtureDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "conv-sig-"));
  fs.writeFileSync(path.join(dir, "MEMORY.md"), "# index\n");
  fs.writeFileSync(path.join(dir, "merge_gate_false_block.md"),
    "merge-gate false-block; enforcer rejects redirect");
  fs.writeFileSync(path.join(dir, "client_pref.md"),
    "Client prefers cost over speed; patience over speed");
  return dir;
}

test("signal is schema-v3 valid", () => {
  const signal = buildConversionSignal({ memoryDir: fixtureDir(), ts: "2026-06-30T00:00:00Z" });
  const { ok, errors } = isValidV3(signal);
  assert.ok(ok, `not valid v3: ${(errors || []).join("; ")}`);
});

test("computes counts and conversion ratio", () => {
  const signal = buildConversionSignal({ memoryDir: fixtureDir(), ts: "2026-06-30T00:00:00Z" });
  assert.strictEqual(signal.note_index_total, 2);
  assert.strictEqual(signal.guardrail_candidate_count, 1);
  assert.strictEqual(signal.semantic_memory_count, 1);
  assert.strictEqual(signal.conversion_opportunity_ratio, 0.5);
});

test("mechanism_breakdown only counts guardrail-candidates", () => {
  const entries = [
    { destination: "guardrail-candidate", mechanism: "hook" },
    { destination: "guardrail-candidate", mechanism: "hook" },
    { destination: "semantic-memory", mechanism: null },
  ];
  assert.deepStrictEqual(mechanismBreakdown(entries), { hook: 2 });
});

test("emitConversionSignal appends one valid line to the target file", () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "conv-out-")), "events.jsonl");
  emitConversionSignal({ memoryDir: fixtureDir(), file: out, ts: "2026-06-30T00:00:00Z" });
  const lines = fs.readFileSync(out, "utf8").trim().split("\n");
  assert.strictEqual(lines.length, 1);
  assert.strictEqual(JSON.parse(lines[0]).event, "guardrail-conversion-rate");
});

test("empty memory dir yields zero ratio, no throw", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "conv-empty-"));
  const signal = buildConversionSignal({ memoryDir: dir, ts: "2026-06-30T00:00:00Z" });
  assert.strictEqual(signal.conversion_opportunity_ratio, 0);
});
