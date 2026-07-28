'use strict';
// Unit tests for baton-back-ledger (Epic #3251 #3259 D3): metadata-only,
// redaction-wrapped, per-ticket event writer (NOT the #3573-fragile monolith).
const assert = require('node:assert/strict');
const { test } = require('node:test');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const { toEvent, ledgerPath, appendEvent, readEvents } =
  require('../scripts/global/baton-back-ledger.js');

function tmpDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'bbl-')); }

test('toEvent projects metadata only — drops free-text lesson/summary', () => {
  const ev = toEvent({ open: true, detector: 'd', remediator: 'collaborator', impact: 'baton-back',
    cycle: 2, finding_ref: 'F1', review: 'cross-family-free', lesson: 'SECRET leaky text' }, 7);
  assert.equal(ev.ticket, 7);
  assert.equal(ev.remediator, 'collaborator');
  assert.equal(ev.event, 'baton-back-open');
  assert.equal(ev.version, 3);
  assert.equal(ev.service, 'baton-back');
  assert.ok(!('lesson' in ev)); // free text never enters the ledger
  assert.equal(JSON.stringify(ev).includes('leaky text'), false);
});

test('appendEvent writes a per-ticket jsonl line and readEvents round-trips', () => {
  const dir = tmpDir();
  assert.equal(appendEvent(101, { open: true, detector: 'x', remediator: 'manager', impact: 'hold' }, { dir }), true);
  assert.equal(appendEvent(101, { open: false, detector: 'x' }, { dir }), true);
  assert.equal(appendEvent(202, { open: true, detector: 'y' }, { dir }), true);
  assert.ok(ledgerPath(101, dir).endsWith('101.jsonl'));
  const evs = readEvents(101, dir);
  assert.equal(evs.length, 2);
  assert.equal(evs[0].event, 'baton-back-open');
  assert.equal(evs[1].event, 'baton-back-cleared');
  assert.equal(readEvents(202, dir).length, 1); // separate per-ticket file
  assert.equal(readEvents(999, dir).length, 0); // missing file -> []
});

test('appendEvent redacts a secret that slips into a metadata field (G4 defense-in-depth)', () => {
  const dir = tmpDir();
  // detector carries an accidental token; wrapWrite must scrub it before write.
  appendEvent(303, { open: true, detector: 'ghp_0123456789abcdef0123456789abcdef0123' }, { dir });
  const raw = fs.readFileSync(ledgerPath(303, dir), 'utf8');
  assert.equal(raw.includes('ghp_0123456789abcdef0123456789abcdef0123'), false);
});

test('appendEvent is best-effort — an IO failure returns false, never throws', () => {
  const boom = () => { throw new Error('disk full'); };
  assert.equal(appendEvent(1, { open: true }, { writeFn: boom }), false);
});
