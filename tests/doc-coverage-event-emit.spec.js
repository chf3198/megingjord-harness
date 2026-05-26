// Refs #2158 - unit tests for doc-coverage-event emitter
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { emitDocCoverageEvent, buildEvent, validateInput, VALID_VERDICTS, VALID_VALIDATORS } = require('../scripts/global/doc-coverage-event-emit.js');

function sandboxLog() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-cov-evt-'));
  return path.join(dir, 'incidents.jsonl');
}

test('buildEvent: shape matches event-schema-v3 expectations', () => {
  const evt = buildEvent({
    ticket: '#2158',
    validator: 'doc-coverage',
    verdict: 'pass',
    surfaces_required: ['README.md'],
    surfaces_updated: ['README.md'],
  });
  assert.equal(evt.version, 3);
  assert.equal(evt.event, 'doc_coverage_event');
  assert.equal(evt.service, 'megingjord-doc-governance');
  assert.equal(evt.env, 'prod');
  assert.equal(evt.verdict, 'pass');
});

test('validateInput: requires ticket, validator, verdict', () => {
  assert.throws(() => validateInput({ validator: 'doc-coverage', verdict: 'pass' }), /ticket/);
  assert.throws(() => validateInput({ ticket: '#1', verdict: 'pass' }), /validator/);
  assert.throws(() => validateInput({ ticket: '#1', validator: 'doc-coverage' }), /verdict/);
});

test('validateInput: rejects invalid verdict', () => {
  assert.throws(() => validateInput({ ticket: '#1', validator: 'doc-coverage', verdict: 'bogus' }), /invalid verdict/);
});

test('validateInput: rejects unknown validator', () => {
  assert.throws(() => validateInput({ ticket: '#1', validator: 'unknown-thing', verdict: 'pass' }), /unknown validator/);
});

test('VALID_VERDICTS exports list of allowed verdicts', () => {
  assert.deepEqual(VALID_VERDICTS, ['pass', 'advisory', 'fail']);
});

test('VALID_VALIDATORS exports list of allowed validators', () => {
  assert.ok(VALID_VALIDATORS.includes('doc-coverage'));
  assert.ok(VALID_VALIDATORS.includes('changelog-fragment-presence'));
  assert.ok(VALID_VALIDATORS.includes('tech-writer-subphase'));
  assert.ok(VALID_VALIDATORS.includes('wiki-lint-gate'));
});

test('emitDocCoverageEvent: appends JSON line to log file', () => {
  const logPath = sandboxLog();
  const evt = emitDocCoverageEvent({
    ticket: '#2158',
    validator: 'doc-coverage',
    verdict: 'pass',
  }, { logPath });
  const lines = fs.readFileSync(logPath, 'utf8').trim().split('\n');
  assert.equal(lines.length, 1);
  const parsed = JSON.parse(lines[0]);
  assert.equal(parsed.event, 'doc_coverage_event');
  assert.equal(parsed.ticket, '#2158');
  assert.equal(parsed.verdict, 'pass');
  assert.ok(parsed.ts);
  assert.equal(evt.ticket, '#2158');
});

test('emitDocCoverageEvent: redacts API-key-shaped strings via log-redaction', () => {
  const logPath = sandboxLog();
  emitDocCoverageEvent({
    ticket: '#2158',
    validator: 'doc-coverage',
    verdict: 'fail',
    surfaces_required: ['secret sk-ant-api03-aBcDef0123456789ABCDEFabcdef0123456789ABCDEF is here'],
  }, { logPath });
  const content = fs.readFileSync(logPath, 'utf8');
  assert.equal(content.includes('aBcDef0123456789'), false, 'API key leaked');
});

test('emitDocCoverageEvent: multiple events append to same file', () => {
  const logPath = sandboxLog();
  emitDocCoverageEvent({ ticket: '#1', validator: 'doc-coverage', verdict: 'pass' }, { logPath });
  emitDocCoverageEvent({ ticket: '#2', validator: 'doc-coverage', verdict: 'advisory' }, { logPath });
  const lines = fs.readFileSync(logPath, 'utf8').trim().split('\n');
  assert.equal(lines.length, 2);
});

test('emitDocCoverageEvent: returns event with v3 fields', () => {
  const logPath = sandboxLog();
  const evt = emitDocCoverageEvent({ ticket: '#9', validator: 'wiki-lint-gate', verdict: 'fail', trace_id: 't-123' }, { logPath });
  assert.equal(evt.trace_id, 't-123');
  assert.equal(evt.version, 3);
});
