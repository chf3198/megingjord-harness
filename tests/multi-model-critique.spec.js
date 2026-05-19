'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../scripts/global/multi-model-critique.js');

test('buildPrompt: substitutes artifact placeholder', () => {
  const p = C.buildPrompt('TEST_ARTIFACT_CONTENT');
  assert.match(p, /TEST_ARTIFACT_CONTENT/);
  assert.match(p, /INDEPENDENT cross-family/);
});

test('buildPrompt: caps long input', () => {
  const long = 'A'.repeat(10000);
  const p = C.buildPrompt(long);
  const aCount = (p.match(/A/g) || []).length;
  assert.ok(aCount <= 6001);
});

test('buildPrompt: handles null/empty', () => {
  assert.ok(C.buildPrompt(null).length > 0);
  assert.ok(C.buildPrompt('').length > 0);
});

test('MODELS includes 3 distinct families', () => {
  const families = new Set(C.MODELS.map(m => m.family));
  assert.equal(families.size, 3);
  assert.ok(families.has('alibaba'));
  assert.ok(families.has('ibm'));
  assert.ok(families.has('bigcode'));
});

test('MODELS each has required fields', () => {
  for (const m of C.MODELS) {
    assert.ok(m.id, 'has id');
    assert.ok(m.model, 'has model');
    assert.ok(m.tier, 'has tier');
    assert.ok(m.family, 'has family');
  }
});
