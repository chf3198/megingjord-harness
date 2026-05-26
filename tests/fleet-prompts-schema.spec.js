// Refs #2181 - golden-file tests for fleet-red-team-prompts schema
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const PROMPTS_PATH = path.join(__dirname, '..', 'config', 'fleet-red-team-prompts.json');
const EXPECTED_KEYS_PATH = path.join(__dirname, 'fixtures', 'fleet-red-team', 'expected-keys.json');

const REQUIRED_FIELDS = ['prompt_template', 'iteration_target', 'findings_cap', 'focus_areas', 'expected_token_range'];

test('fleet-red-team-prompts.json exists', () => {
  assert.ok(fs.existsSync(PROMPTS_PATH));
});

test('parses as valid JSON', () => {
  const obj = JSON.parse(fs.readFileSync(PROMPTS_PATH, 'utf8'));
  assert.equal(obj.version, 1);
  assert.ok(obj.templates);
});

test('contains all 7 expected template keys (golden fixture)', () => {
  const obj = JSON.parse(fs.readFileSync(PROMPTS_PATH, 'utf8'));
  const expected = JSON.parse(fs.readFileSync(EXPECTED_KEYS_PATH, 'utf8')).sort();
  const actual = Object.keys(obj.templates).sort();
  assert.deepEqual(actual, expected);
});

test('each template has all required fields', () => {
  const obj = JSON.parse(fs.readFileSync(PROMPTS_PATH, 'utf8'));
  for (const [key, tmpl] of Object.entries(obj.templates)) {
    for (const field of REQUIRED_FIELDS) {
      assert.ok(tmpl[field] !== undefined, `${key}.${field} missing`);
    }
  }
});

test('each prompt_template ≤500 chars', () => {
  const obj = JSON.parse(fs.readFileSync(PROMPTS_PATH, 'utf8'));
  for (const [key, tmpl] of Object.entries(obj.templates)) {
    assert.ok(tmpl.prompt_template.length <= 500, `${key}: ${tmpl.prompt_template.length} chars >500`);
  }
});

test('each prompt_template contains {{content}} placeholder', () => {
  const obj = JSON.parse(fs.readFileSync(PROMPTS_PATH, 'utf8'));
  for (const [key, tmpl] of Object.entries(obj.templates)) {
    assert.match(tmpl.prompt_template, /\{\{content\}\}/);
  }
});

test('expected_token_range is [min, max] integer pair', () => {
  const obj = JSON.parse(fs.readFileSync(PROMPTS_PATH, 'utf8'));
  for (const [key, tmpl] of Object.entries(obj.templates)) {
    const range = tmpl.expected_token_range;
    assert.ok(Array.isArray(range) && range.length === 2);
    assert.ok(Number.isInteger(range[0]) && Number.isInteger(range[1]));
    assert.ok(range[0] < range[1], `${key}: range min >= max`);
  }
});

test('findings_cap is 4 or 6 (matches Zenflow guidance 6-8 max)', () => {
  const obj = JSON.parse(fs.readFileSync(PROMPTS_PATH, 'utf8'));
  for (const [key, tmpl] of Object.entries(obj.templates)) {
    assert.ok([4, 6].includes(tmpl.findings_cap), `${key}: findings_cap=${tmpl.findings_cap}`);
  }
});
