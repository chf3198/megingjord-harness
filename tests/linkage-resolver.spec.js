'use strict';
// Regression suite for the deterministic linked-ticket resolver. Refs #1614 AC3.
// Anchors the two live defects of the old first-match /Refs\s+#(\d+)/i pattern
// plus the Refs-Epic exclusion and markdown/backtick variants.

const test = require('node:test');
const assert = require('node:assert');
const { resolveLinkedTicket } = require('../scripts/global/linkage-resolver');

test('AC1: auto-close keyword wins over a leading non-ticket Refs (old bug)', () => {
  // Old /Refs\s+#(\d+)/i resolved this to 1305; the close target is authoritative.
  const r = resolveLinkedTicket('Closes #1614\nRefs #1305');
  assert.strictEqual(r.ticket, 1614);
  assert.strictEqual(r.source, 'close-keyword');
});

test('AC1: deferred-final marker wins over a leading non-ticket Refs', () => {
  const r = resolveLinkedTicket('Refs #1305\nmerge-evidence-deferred-final: #1614');
  assert.strictEqual(r.ticket, 1614);
  assert.strictEqual(r.source, 'deferred-final');
});

test('AC1: close keyword takes precedence over deferred-final', () => {
  const r = resolveLinkedTicket('Closes #10\nmerge-evidence-deferred-final: #20');
  assert.strictEqual(r.ticket, 10);
  assert.strictEqual(r.source, 'close-keyword');
});

test('AC1: Fixes / Resolves variants are recognized', () => {
  assert.strictEqual(resolveLinkedTicket('Fixes #7').ticket, 7);
  assert.strictEqual(resolveLinkedTicket('Resolves #8').ticket, 8);
  assert.strictEqual(resolveLinkedTicket('Fixed #9').ticket, 9);
});

test('AC1+AC3: Refs Epic #N is never selected as the child ticket', () => {
  const r = resolveLinkedTicket('Refs Epic #1604\nRefs #1614');
  assert.strictEqual(r.ticket, 1614);
  assert.strictEqual(r.source, 'refs');
});

test('AC3: a lone Refs Epic resolves to no linked ticket (not the epic)', () => {
  const r = resolveLinkedTicket('Refs Epic #1604');
  assert.strictEqual(r.ticket, null);
  assert.strictEqual(r.source, 'none');
});

test('AC3: ticket-first Refs ordering resolves to the ticket', () => {
  const r = resolveLinkedTicket('Refs #1614\nRefs #1305 (research dependency)');
  assert.strictEqual(r.ticket, 1614);
});

test('AC3: list-marker and indented linkage lines are anchored', () => {
  assert.strictEqual(resolveLinkedTicket('- Closes #42').ticket, 42);
  assert.strictEqual(resolveLinkedTicket('  Refs #43').ticket, 43);
  assert.strictEqual(resolveLinkedTicket('* Resolves #44').ticket, 44);
});

test('AC2/AC3: a mid-prose keyword is NOT treated as a linkage directive', () => {
  // "we should fix #5 later" must not masquerade as a close directive.
  assert.strictEqual(resolveLinkedTicket('we should fix #5 later').ticket, null);
  assert.strictEqual(resolveLinkedTicket('todo: fix #5').ticket, null);
});

test('AC3: backtick / markdown-bold wrappers do not break the real linkage below', () => {
  const body = 'Discussion of `Closes #99` syntax in prose.\n\nRefs #1614\nCloses #1614';
  // The prose backtick line is mid-line (not anchored at col 0 sans markers), so
  // the authoritative Closes #1614 on its own line is selected.
  const r = resolveLinkedTicket(body);
  assert.strictEqual(r.ticket, 1614);
  assert.strictEqual(r.source, 'close-keyword');
});

test('AC3: empty / null / undefined bodies resolve to none without throwing', () => {
  for (const b of ['', null, undefined, '   \n  ']) {
    const r = resolveLinkedTicket(b);
    assert.strictEqual(r.ticket, null);
    assert.strictEqual(r.source, 'none');
  }
});

test('AC3: case-insensitive keyword matching', () => {
  assert.strictEqual(resolveLinkedTicket('CLOSES #11').ticket, 11);
  assert.strictEqual(resolveLinkedTicket('refs #12').ticket, 12);
});
