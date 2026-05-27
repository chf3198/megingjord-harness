// Refs #2220 - bypass-detector tests
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { detectBypass, emitIncident, PAID_PROVIDER_REGEXES, OVERRIDE_MARKER_RE } = require('../scripts/global/hamr-bypass-detector.js');

test('detectBypass: curl to anthropic flags as paid-bypass', () => {
  const r = detectBypass('curl -X POST https://api.anthropic.com/v1/messages -d "..."');
  assert.equal(r.detected, true);
  assert.equal(r.severity, 'paid-bypass');
  assert.ok(r.providers.find(p => p.name === 'anthropic'));
});

test('detectBypass: curl to fleet endpoint flags as fleet-bypass', () => {
  const r = detectBypass('curl -X POST http://100.91.113.16:11434/api/generate');
  assert.equal(r.detected, true);
  assert.equal(r.severity, 'fleet-bypass');
});

test('detectBypass: localhost ollama flags fleet-bypass', () => {
  const r = detectBypass('curl http://localhost:11434/api/tags');
  assert.equal(r.detected, true);
  assert.equal(r.severity, 'fleet-bypass');
});

test('detectBypass: override marker suppresses', () => {
  const r = detectBypass('curl http://100.91.113.16:11434/api/tags # hamr-bypass-ok: health-probe');
  assert.equal(r.detected, true);
  assert.equal(r.suppressed, true);
  assert.equal(r.override_reason, 'health-probe');
});

test('detectBypass: non-curl command not detected', () => {
  const r = detectBypass('node scripts/global/hamr-provider-wrapper.js');
  assert.equal(r.detected, false);
  assert.equal(r.reason, 'not-http-invocation');
});

test('detectBypass: curl to unknown URL not detected', () => {
  const r = detectBypass('curl https://example.com/data.json');
  assert.equal(r.detected, false);
  assert.equal(r.reason, 'no-known-provider-url');
});

test('detectBypass: multiple providers in one command', () => {
  const r = detectBypass('curl https://api.anthropic.com/v1/messages; curl https://api.openai.com/v1/chat');
  assert.equal(r.detected, true);
  assert.ok(r.providers.length >= 2);
});

test('detectBypass: empty input returns not-detected', () => {
  assert.equal(detectBypass('').detected, false);
});

test('detectBypass: undefined input returns not-detected', () => {
  assert.equal(detectBypass(undefined).detected, false);
});

test('PAID_PROVIDER_REGEXES exports ≥6 paid providers', () => {
  assert.ok(PAID_PROVIDER_REGEXES.length >= 6);
  assert.ok(PAID_PROVIDER_REGEXES.find(p => p.name === 'anthropic'));
});

test('emitIncident: writes JSON line to incidents file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hamr-bypass-'));
  const file = path.join(dir, 'incidents.jsonl');
  const detection = detectBypass('curl https://api.anthropic.com/v1/messages');
  const evt = emitIncident(detection, file);
  assert.ok(evt);
  const content = fs.readFileSync(file, 'utf8').trim();
  const parsed = JSON.parse(content);
  assert.equal(parsed.event, 'hamr-bypass-detected');
  assert.equal(parsed.severity, 'paid-bypass');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('emitIncident: returns null when detection suppressed', () => {
  const detection = detectBypass('curl http://localhost:11434 # hamr-bypass-ok: testing');
  assert.equal(emitIncident(detection, '/tmp/should-not-write.jsonl'), null);
});

test('OVERRIDE_MARKER_RE captures reason', () => {
  const m = '# hamr-bypass-ok: diagnostic-health-probe'.match(OVERRIDE_MARKER_RE);
  assert.ok(m);
  assert.equal(m[1].trim(), 'diagnostic-health-probe');
});
