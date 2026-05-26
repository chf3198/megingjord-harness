// Refs #2175 - tests for fleet-red-team-dispatch
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadTemplate, buildPrompt, parseFindings, stripArxivHallucinations, detectRefusal, RETRY_DELAYS_MS, TIER } = require('../scripts/global/fleet-red-team-dispatch.js');

const TEMPLATES_PATH = path.join(__dirname, '..', 'config', 'fleet-red-team-prompts.json');

test('loadTemplate: returns valid template object for known type', () => {
  const tmpl = loadTemplate('epic-scope', TEMPLATES_PATH);
  assert.ok(tmpl.prompt_template);
  assert.equal(typeof tmpl.iteration_target, 'number');
  assert.ok(Array.isArray(tmpl.focus_areas));
});

test('loadTemplate: throws on unknown artifact type', () => {
  assert.throws(() => loadTemplate('does-not-exist', TEMPLATES_PATH), /unknown artifact-type/);
});

test('buildPrompt: substitutes {{content}} placeholder', () => {
  const tmpl = { prompt_template: 'before {{content}} after' };
  assert.equal(buildPrompt(tmpl, 'X'), 'before X after');
});

test('stripArxivHallucinations: removes fake arxiv refs', () => {
  const text = 'see arxiv.org/abs/2402.02172 and arxiv.org/abs/2603.11078 for details';
  const out = stripArxivHallucinations(text);
  assert.equal(out.includes('2402.02172'), false);
  assert.match(out, /arxiv-ref-stripped/);
});

test('detectRefusal: matches "I cannot help with..."', () => {
  assert.ok(detectRefusal("I cannot help with that."));
  assert.ok(detectRefusal("I'm sorry, but I cannot do that."));
  assert.equal(detectRefusal("Here are findings: ACCEPT something"), false);
});

test('parseFindings: extracts ACCEPT/REJECT/PARTIAL lines', () => {
  const raw = { response: 'Here are findings:\nACCEPT: real defect\nREJECT: not a real issue\nPARTIAL: maybe\nignored line' };
  const { findings, warning } = parseFindings(raw);
  assert.equal(findings.length, 3);
  assert.equal(warning, null);
});

test('parseFindings: empty response returns warning', () => {
  const { findings, warning } = parseFindings({ response: '' });
  assert.equal(findings.length, 0);
  assert.equal(warning, 'empty-or-short-response');
});

test('parseFindings: detects refusal', () => {
  const { findings, warning } = parseFindings({ response: 'I cannot help with that request because it could be misused.' });
  assert.equal(findings.length, 0);
  assert.equal(warning, 'fleet-refused');
});

test('parseFindings: handles markdown-bold ACCEPT formatting', () => {
  const raw = { response: '**ACCEPT**: finding A\n**REJECT**: finding B\n**PARTIAL**: finding C' };
  const { findings } = parseFindings(raw);
  assert.equal(findings.length, 3);
});

test('TIER constant is "fleet-local" (per P1-7 #2178)', () => {
  assert.equal(TIER, 'fleet-local');
});

test('RETRY_DELAYS_MS is [1000, 4000] per Phase-0 finding', () => {
  assert.deepEqual(RETRY_DELAYS_MS, [1000, 4000]);
});
