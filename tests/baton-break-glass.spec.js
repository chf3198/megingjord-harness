// baton-break-glass.spec.js -- Tests for break-glass module.
// Refs #3292, Epic #3284 (W4). AC2: two distinct approvers + hash-linked.
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  recordBreakGlass,
  verifyBreakGlass,
  preReceiveCheck,
  extractUniqueApprovers,
} = require('../scripts/global/baton-bypass/break-glass');

// -- Fake chain append that mimics event-log.js appendVerdict --

function makeFakeChainAppend() {
  const chain = [];
  let lastHash = '0'.repeat(64);
  const appendFn = function fakeAppend(verdict) {
    const seq = chain.length;
    const hash = 'fakehash_' + String(seq);
    const entry = { seq, hash, prev_hash: lastHash, verdict };
    chain.push(entry);
    lastHash = hash;
    return { seq, hash, nonce: 'fakenonce_' + String(seq) };
  };
  return { appendFn, chain };
}

// -- extractUniqueApprovers --

describe('extractUniqueApprovers', () => {
  it('deduplicates approver aliases', () => {
    const result = extractUniqueApprovers([
      { alias: 'Alice' }, { alias: 'Bob' }, { alias: 'Alice' },
    ]);
    assert.deepEqual(result, ['Alice', 'Bob']);
  });

  it('returns empty for null input', () => {
    assert.deepEqual(extractUniqueApprovers(null), []);
  });
});

// -- recordBreakGlass --

describe('recordBreakGlass', () => {
  it('records with two distinct approvers', () => {
    const { appendFn, chain } = makeFakeChainAppend();
    const result = recordBreakGlass(42, [
      { alias: 'Orla Reyes' }, { alias: 'Sage Vale' },
    ], appendFn);
    assert.equal(result.recorded, true);
    assert.equal(result.error, null);
    assert.equal(result.entry.pr, 42);
    assert.deepEqual(result.entry.approvers, ['Orla Reyes', 'Sage Vale']);
    assert.equal(chain.length, 1);
  });

  it('rejects with only one approver', () => {
    const { appendFn } = makeFakeChainAppend();
    const result = recordBreakGlass(42, [
      { alias: 'Orla Reyes' },
    ], appendFn);
    assert.equal(result.recorded, false);
    assert.ok(result.error.includes('distinct approver'));
  });

  it('rejects when both approvals are from the same alias (duplicate)', () => {
    const { appendFn } = makeFakeChainAppend();
    const result = recordBreakGlass(42, [
      { alias: 'Orla Reyes' }, { alias: 'Orla Reyes' },
    ], appendFn);
    assert.equal(result.recorded, false);
    assert.ok(result.error.includes('1'));
  });

  it('rejects with zero approvers', () => {
    const { appendFn } = makeFakeChainAppend();
    const result = recordBreakGlass(42, [], appendFn);
    assert.equal(result.recorded, false);
  });

  it('appends a hash-linked entry to the chain', () => {
    const { appendFn, chain } = makeFakeChainAppend();
    recordBreakGlass(10, [
      { alias: 'A' }, { alias: 'B' },
    ], appendFn);
    recordBreakGlass(20, [
      { alias: 'C' }, { alias: 'D' },
    ], appendFn);
    assert.equal(chain.length, 2);
    assert.equal(chain[1].prev_hash, chain[0].hash);
    assert.equal(chain[0].seq, 0);
    assert.equal(chain[1].seq, 1);
  });
});

// -- verifyBreakGlass --

describe('verifyBreakGlass', () => {
  it('validates a correct entry with two approvers', () => {
    const entry = { type: 'break-glass', approvers: ['A', 'B'], seq: 0 };
    const chain = [{ seq: 0, verdict: entry }];
    const result = verifyBreakGlass(entry, chain);
    assert.equal(result.valid, true);
  });

  it('rejects entry with fewer than two approvers', () => {
    const entry = { type: 'break-glass', approvers: ['A'], seq: 0 };
    const result = verifyBreakGlass(entry, []);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(err => err.includes('insufficient')));
  });

  it('rejects non-break-glass entry type', () => {
    const entry = { type: 'verdict', approvers: ['A', 'B'] };
    const result = verifyBreakGlass(entry, []);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(err => err.includes('not a break-glass')));
  });
});

// -- preReceiveCheck --

describe('preReceiveCheck', () => {
  it('allows push when no checks are overridden', () => {
    const result = preReceiveCheck({ checksOverridden: false, prNumber: 1 }, []);
    assert.equal(result.allowed, true);
  });

  it('rejects push circumventing checks without break-glass', () => {
    const result = preReceiveCheck({ checksOverridden: true, prNumber: 99 }, []);
    assert.equal(result.allowed, false);
    assert.ok(result.reason.includes('99'));
    assert.ok(result.reason.includes('circumvents'));
  });

  it('allows push when valid break-glass entry exists', () => {
    const chainEntries = [{
      verdict: { type: 'break-glass', pr: 99, approvers: ['A', 'B'] },
    }];
    const result = preReceiveCheck({ checksOverridden: true, prNumber: 99 }, chainEntries);
    assert.equal(result.allowed, true);
    assert.ok(result.reason.includes('valid break-glass'));
  });

  it('rejects when break-glass entry has insufficient approvers', () => {
    const chainEntries = [{
      verdict: { type: 'break-glass', pr: 99, approvers: ['A'] },
    }];
    const result = preReceiveCheck({ checksOverridden: true, prNumber: 99 }, chainEntries);
    assert.equal(result.allowed, false);
    assert.ok(result.reason.includes('insufficient'));
  });

  it('rejects when break-glass entry is for a different PR', () => {
    const chainEntries = [{
      verdict: { type: 'break-glass', pr: 50, approvers: ['A', 'B'] },
    }];
    const result = preReceiveCheck({ checksOverridden: true, prNumber: 99 }, chainEntries);
    assert.equal(result.allowed, false);
  });
});
