'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ob = require(path.resolve(__dirname, '..', 'scripts', 'global', 'governance-outbox.js'));

function tmpOutbox(name) {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gov-outbox-')), name || 'outbox.jsonl');
}

test('canonicalJson is key-order independent', () => {
  assert.strictEqual(ob.canonicalJson({ b: 1, a: 2 }), ob.canonicalJson({ a: 2, b: 1 }));
});

test('canonicalizeGovText strips zero-width and collapses whitespace', () => {
  assert.strictEqual(ob.canonicalizeGovText('  a\u200b b\t c '), 'a b c');
});

test('idempotencyKey is stable for semantically identical events', () => {
  assert.strictEqual(ob.idempotencyKey({ a: 1, b: 2 }), ob.idempotencyKey({ b: 2, a: 1 }));
});

test('enqueue appends a queued entry and returns its key', () => {
  const outboxPath = tmpOutbox();
  const key = ob.enqueue({ kind: 'tier1', n: 1 }, { outboxPath });
  const entries = ob.readEntries(outboxPath);
  assert.strictEqual(entries.length, 1);
  assert.strictEqual(entries[0].state, 'queued');
  assert.strictEqual(entries[0].key, key);
});

test('flush delivers queued entries via remotePut and marks them flushed', () => {
  const outboxPath = tmpOutbox();
  const put = [];
  ob.enqueue({ kind: 'a' }, { outboxPath });
  ob.enqueue({ kind: 'b' }, { outboxPath });
  const result = ob.flush({ outboxPath, remotePut: (event) => put.push(event.kind) });
  assert.strictEqual(result.flushed, 2);
  assert.deepStrictEqual(put.sort(), ['a', 'b']);
});

test('flush is idempotent: a second flush re-delivers nothing', () => {
  const outboxPath = tmpOutbox();
  ob.enqueue({ kind: 'a' }, { outboxPath });
  ob.flush({ outboxPath });
  const put = [];
  const result = ob.flush({ outboxPath, remotePut: (event) => put.push(event.kind) });
  assert.strictEqual(result.flushed, 0);
  assert.deepStrictEqual(put, []);
});

test('idempotent consumer skips remotePut when remoteHas is true', () => {
  const outboxPath = tmpOutbox();
  ob.enqueue({ kind: 'a' }, { outboxPath });
  const put = [];
  ob.flush({ outboxPath, remoteHas: () => true, remotePut: (event) => put.push(event.kind) });
  assert.deepStrictEqual(put, []);
});

test('a held lease makes a concurrent flush a no-op (no double-flush)', () => {
  const outboxPath = tmpOutbox();
  ob.enqueue({ kind: 'a' }, { outboxPath });
  const lease = ob.acquireLease(outboxPath + '.lock');
  const result = ob.flush({ outboxPath });
  assert.strictEqual(result.locked, true);
  assert.strictEqual(result.flushed, 0);
  fs.closeSync(lease);
  fs.rmSync(outboxPath + '.lock', { force: true });
});
