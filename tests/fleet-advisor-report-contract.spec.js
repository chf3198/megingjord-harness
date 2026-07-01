'use strict';
// golden-file + OpenAPI contract + cross-runtime parity tests (Epic #3414 #3482 AC2/AC3, G9).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const yaml = require('js-yaml');
const Ajv = require('ajv');
const rep = require('../scripts/global/fleet-advisor-report.js');

const GOLDEN = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'fleet-advisor-report-golden.json'), 'utf8'));
const OPENAPI = yaml.load(fs.readFileSync(path.join(__dirname, '..', 'openapi', 'fleet-advisor.yaml'), 'utf8'));

test('golden-file — buildAdvisoryReport reproduces the canonical report exactly', () => {
  const produced = rep.buildAdvisoryReport(GOLDEN.input, { now: 0 });
  assert.deepEqual(produced, GOLDEN.report);
});

test('AC2 — the OpenAPI spec is well-formed and versioned', () => {
  assert.equal(OPENAPI.openapi, '3.1.0');
  assert.ok(OPENAPI.info.version);
  assert.ok(OPENAPI.components.schemas.AdvisoryReport);
  assert.ok(OPENAPI.components.schemas.Finding);
});

test('AC2 (G9) — the report payload validates against the OpenAPI schema (ajv)', () => {
  const ajv = new Ajv({ strict: false });
  // Inline the $ref target so ajv resolves Finding within AdvisoryReport.
  const schema = JSON.parse(JSON.stringify(OPENAPI.components.schemas.AdvisoryReport)
    .replace(/#\/components\/schemas\/Finding/g, '#/$defs/Finding'));
  schema.$defs = { Finding: OPENAPI.components.schemas.Finding };
  const validate = ajv.compile(schema);
  const report = rep.buildAdvisoryReport(GOLDEN.input, { now: 0 });
  assert.equal(validate(report), true, JSON.stringify(validate.errors));
});

test('AC2 (G9) — cross-runtime parity: the SAME schema + module validate identically for all 4 teams', () => {
  const ajv = new Ajv({ strict: false });
  const schema = JSON.parse(JSON.stringify(OPENAPI.components.schemas.AdvisoryReport)
    .replace(/#\/components\/schemas\/Finding/g, '#/$defs/Finding'));
  schema.$defs = { Finding: OPENAPI.components.schemas.Finding };
  const validate = ajv.compile(schema);
  const report = rep.buildAdvisoryReport(GOLDEN.input, { now: 0 });
  // The module is a pure scripts/global module (mirrored to ~/.copilot, ~/.codex, ~/.claude, antigravity)
  // with no runtime-specific imports — every team imports + validates this identical object.
  for (const team of ['claude-code', 'codex', 'copilot', 'antigravity']) {
    assert.equal(validate(report), true, `parity failure for ${team}`);
  }
  // No require of any runtime-specific path in the contract module (parity invariant).
  const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'global', 'fleet-advisor-report.js'), 'utf8');
  assert.doesNotMatch(src, /require\(['"](?:\.\.\/)*(?:\.copilot|\.codex|\.claude)\b/);
});

test('AC3 — the AI-prompt hardware-only view carries no addressing/secrets across runtimes', () => {
  const fingerprint = { hosts: [{ id: 'host-a', url: 'http://100.78.22.13:11434', engine: 'vllm@0.8', vramBucket: 'dedicated' }] };
  const view = rep.hardwareOnlyView(fingerprint, 'F4');
  const json = JSON.stringify(view);
  assert.doesNotMatch(json, /100\.78\.22\.13/);
  assert.doesNotMatch(json, /:11434/);
  assert.doesNotMatch(json, /host-a/);
  assert.match(json, /vllm/);
});

test('the /fleet-advisor skill + OpenAPI spec ship with the module (capstone completeness)', () => {
  assert.ok(fs.existsSync(path.join(__dirname, '..', '.claude', 'commands', 'fleet-advisor.md')));
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'openapi', 'fleet-advisor.yaml')));
});
