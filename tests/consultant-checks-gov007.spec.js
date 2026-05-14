#!/usr/bin/env node
'use strict';
// Tests for gov-007: anneal-ticket-presence check
// Validates CONSULTANT_CLOSEOUT must declare anneal_tickets_filed

const assert = require('assert');

// Minimal inline implementation of gov-007 check logic for unit testing
function gov007Check(comments) {
  const pass = /anneal_tickets_filed:/.test(comments);
  return {
    id: 'gov-007',
    domain: 'governance',
    status: pass ? 'PASS' : 'FAIL',
    finding: 'anneal-ticket-presence',
  };
}

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}: ${e.message}`);
    failed++;
  }
}

console.log('gov-007 anneal-ticket-presence tests:');

test('PASS: closeout declares filed ticket numbers', () => {
  const comments = 'CONSULTANT_CLOSEOUT\nanneal_tickets_filed: #1494, #1495\nscore: 92';
  assert.strictEqual(gov007Check(comments).status, 'PASS');
});

test('PASS: closeout declares none (no improvements found)', () => {
  const comments = 'CONSULTANT_CLOSEOUT\nanneal_tickets_filed: none\nscore: 98';
  assert.strictEqual(gov007Check(comments).status, 'PASS');
});

test('FAIL: closeout missing anneal_tickets_filed field entirely', () => {
  const comments = 'CONSULTANT_CLOSEOUT\nscore: 85\nRisk: low';
  assert.strictEqual(gov007Check(comments).status, 'FAIL');
});

test('FAIL: closeout from old format with no field', () => {
  const comments = 'CONSULTANT_CLOSEOUT\nAll ACs complete. Issue closed.';
  assert.strictEqual(gov007Check(comments).status, 'FAIL');
});

test('PASS: multiple comments, anneal_tickets_filed present in any', () => {
  const comments = 'MANAGER_HANDOFF\nscope: fix\n---\nCONSULTANT_CLOSEOUT\nanneal_tickets_filed: #1501\n';
  assert.strictEqual(gov007Check(comments).status, 'PASS');
});

if (failed > 0) {
  console.log(`\ngov-007 tests: ${failed} FAILED, ${passed} passed`);
  process.exit(1);
} else {
  console.log(`\ngov-007 tests: PASS (${passed}/${passed + failed})`);
}
