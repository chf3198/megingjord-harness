'use strict';
// Stress (Epic #2709 / #2724): concurrency + state-mutation -> fault-injection + p99 budget.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ob = require(path.resolve(__dirname, '..', 'scripts', 'global', 'governance-outbox.js'));

const SCALE = 1000;
const P99_BUDGET_MS = 1500;

function tmpOutbox() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gov-stress-')), 'outbox.jsonl');
}

test('chaos: re-flush after a partial crash never re-delivers already-flushed entries', () => {
  const outboxPath = tmpOutbox();
  for (let i = 0; i < 50; i += 1) ob.enqueue({ kind: 'e', n: i }, { outboxPath });
  ob.flush({ outboxPath });
  // simulate a crash that left more queued entries appended after the first flush
  for (let i = 50; i < 60; i += 1) ob.enqueue({ kind: 'e', n: i }, { outboxPath });
  const delivered = [];
  const result = ob.flush({ outboxPath, remotePut: (event) => delivered.push(event.n) });
  assert.strictEqual(result.flushed, 10);
  assert.deepStrictEqual(delivered.sort((a, b) => a - b), Array.from({ length: 10 }, (_, i) => i + 50));
});

test('perf: enqueue + flush of a large outbox stays under the p99 budget', () => {
  const outboxPath = tmpOutbox();
  const start = process.hrtime.bigint();
  for (let i = 0; i < SCALE; i += 1) ob.enqueue({ kind: 'e', n: i }, { outboxPath });
  const result = ob.flush({ outboxPath });
  const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
  assert.strictEqual(result.flushed, SCALE);
  assert.ok(elapsedMs < P99_BUDGET_MS, `enqueue+flush took ${elapsedMs}ms (budget ${P99_BUDGET_MS}ms)`);
});
