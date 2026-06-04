'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { evaluate, isFalsePositive, oldKey, newKey } = require('../scripts/global/state-isolation-replay-eval');
const { emitStateIsolationEvent, buildEvent, EVENT_TYPES } = require('../scripts/global/state-isolation-audit');

const corpus = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures', 'state-isolation-fp-corpus.json'), 'utf8')
).corpus;

// --- C8 replay-eval: NEW per-session keying must yield ZERO false-positives ---
test('replay-eval: OLD cwd-only keying produces false-positives on the pollution corpus', () => {
  const result = evaluate(corpus);
  assert.ok(result.old.falsePositives > 0, 'OLD keying should reproduce the historical FPs');
});
test('replay-eval: NEW per-session keying yields ZERO false-positives (C8 target)', () => {
  const result = evaluate(corpus);
  assert.strictEqual(result.new.falsePositives, 0,
    `NEW keying must eliminate all pollution FPs; leaked: ${result.new.cases.join(', ')}`);
});
test('replay-eval: every corpus entry that polluted under OLD is clean under NEW', () => {
  for (const entry of corpus) {
    if (isFalsePositive(entry, oldKey)) {
      assert.strictEqual(isFalsePositive(entry, newKey), false,
        `${entry.scenario}: still FP under NEW keying`);
    }
  }
});

// --- C7 audit emitter unit tests ---
test('audit: buildEvent produces a valid schema-v3 event for each lifecycle type', () => {
  for (const type of EVENT_TYPES) {
    const ev = buildEvent(type, { session_id: 'sess1234', repo_key: 'abc123' });
    assert.strictEqual(ev.version, 3);
    assert.strictEqual(ev.service, 'state-isolation');
    assert.strictEqual(ev.event, type);
  }
});
test('audit: unknown event type throws', () => {
  assert.throws(() => buildEvent('bogus-event', {}), /unknown event/);
});
test('audit: emit appends a JSONL line to the target file', () => {
  const tmp = path.join(require('node:os').tmpdir(), `si-audit-test-${process.pid}.jsonl`);
  try { fs.unlinkSync(tmp); } catch { /* fresh */ }
  emitStateIsolationEvent('allowlist-decision', { path: '.env', decision: 'allow' }, { file: tmp, ts: '2026-06-04T00:00:00Z' });
  const lines = fs.readFileSync(tmp, 'utf8').trim().split('\n');
  assert.strictEqual(lines.length, 1);
  assert.strictEqual(JSON.parse(lines[0]).decision, 'allow');
  fs.unlinkSync(tmp);
});
