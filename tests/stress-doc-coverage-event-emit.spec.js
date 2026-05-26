// Refs #2169 — stress test suite for doc-coverage-event emitter (#2158)
// G6 fault-injection (concurrent writers) + G7 p99 latency budget + schema-under-load
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { fork } = require('child_process');

const { emitDocCoverageEvent, buildEvent } = require('../scripts/global/doc-coverage-event-emit.js');
const { isValidV3 } = require('../scripts/global/event-schema-v3.js');

function sandboxLog(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `stress-evt-${prefix}-`));
  return path.join(dir, 'incidents.jsonl');
}

function p99(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length * 0.99)] || sorted[sorted.length - 1];
}

test('chaos G6: 20 concurrent writers — all events present, no truncation', async () => {
  const logPath = sandboxLog('concurrent');
  const N = 20;
  const eventsPerWorker = 10;
  // Use Promise.all to fire 20 concurrent emits from the SAME process
  // (multi-process append-safety is OS-guaranteed via O_APPEND on POSIX;
  // intra-process concurrency is the practical agent-orchestration case)
  const promises = [];
  for (let worker = 0; worker < N; worker++) {
    for (let evt = 0; evt < eventsPerWorker; evt++) {
      promises.push(Promise.resolve().then(() =>
        emitDocCoverageEvent({
          ticket: `#${worker}-${evt}`,
          validator: 'doc-coverage',
          verdict: 'pass',
        }, { logPath })
      ));
    }
  }
  await Promise.all(promises);
  const lines = fs.readFileSync(logPath, 'utf8').trim().split('\n');
  assert.equal(lines.length, N * eventsPerWorker, `expected ${N * eventsPerWorker} lines, got ${lines.length}`);
  for (const line of lines) {
    assert.doesNotThrow(() => JSON.parse(line), `line not valid JSON: ${line.slice(0, 60)}`);
  }
});

test('chaos G6: append-only invariant — earlier lines never overwritten', () => {
  const logPath = sandboxLog('append-only');
  emitDocCoverageEvent({ ticket: '#first', validator: 'doc-coverage', verdict: 'pass' }, { logPath });
  const after1 = fs.readFileSync(logPath, 'utf8');
  for (let i = 0; i < 50; i++) {
    emitDocCoverageEvent({ ticket: `#n${i}`, validator: 'doc-coverage', verdict: 'pass' }, { logPath });
  }
  const final = fs.readFileSync(logPath, 'utf8');
  assert.ok(final.startsWith(after1), 'first line was modified by subsequent appends');
});

test('G7 p99 latency budget: single emit completes in <10ms p99', () => {
  const logPath = sandboxLog('p99');
  const samples = [];
  for (let i = 0; i < 100; i++) {
    const start = process.hrtime.bigint();
    emitDocCoverageEvent({ ticket: `#${i}`, validator: 'doc-coverage', verdict: 'pass' }, { logPath });
    samples.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  const p99Val = p99(samples);
  assert.ok(p99Val < 10, `single-emit p99 = ${p99Val.toFixed(2)}ms > 10ms budget`);
});

test('schema-under-load G2: every event passes isValidV3 after 200 concurrent emits', async () => {
  const logPath = sandboxLog('schema');
  const promises = [];
  for (let i = 0; i < 200; i++) {
    promises.push(Promise.resolve().then(() =>
      emitDocCoverageEvent({
        ticket: `#${i}`,
        validator: i % 4 === 0 ? 'doc-coverage' :
                   i % 4 === 1 ? 'changelog-fragment-presence' :
                   i % 4 === 2 ? 'wiki-lint-gate' : 'tech-writer-subphase',
        verdict: ['pass', 'advisory', 'fail'][i % 3],
        surfaces_required: [`docs/x${i}.md`],
      }, { logPath })
    ));
  }
  await Promise.all(promises);
  const lines = fs.readFileSync(logPath, 'utf8').trim().split('\n');
  for (const line of lines) {
    const parsed = JSON.parse(line);
    assert.ok(isValidV3(parsed), `event failed v3 validation: ${JSON.stringify(parsed).slice(0, 80)}`);
  }
});

test('chaos G6: fault-injection — emit with redaction-tripping payload does not corrupt JSONL', () => {
  const logPath = sandboxLog('redaction');
  emitDocCoverageEvent({
    ticket: '#redaction',
    validator: 'doc-coverage',
    verdict: 'fail',
    surfaces_required: [
      'sk-ant-api03-aBcDef0123456789ABCDEFabcdef0123456789ABCDEF leaked',
      'gh' + 'p_' + 'A'.repeat(40),
    ],
  }, { logPath });
  const text = fs.readFileSync(logPath, 'utf8');
  assert.equal(text.includes('sk-ant-api03-aBcDef'), false, 'API key leaked');
  assert.equal(text.includes('ghp_' + 'A'.repeat(40)), false, 'GitHub PAT leaked');
  const lines = text.trim().split('\n');
  assert.equal(lines.length, 1);
  assert.doesNotThrow(() => JSON.parse(lines[0]), 'redaction corrupted JSONL');
});

test('G7 throughput budget: 1000 sequential emits under 10s total', () => {
  const logPath = sandboxLog('throughput');
  const start = Date.now();
  for (let i = 0; i < 1000; i++) {
    emitDocCoverageEvent({ ticket: `#${i}`, validator: 'doc-coverage', verdict: 'pass' }, { logPath });
  }
  const elapsed = Date.now() - start;
  assert.ok(elapsed < 10000, `1000 emits took ${elapsed}ms (>10s budget)`);
});
