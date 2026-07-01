'use strict';
// eval-harness tests for the fleet tool-use reliability harness (Epic #3414 #3487).
// Scores parseToolCall against the labeled corpus and exercises the retry/route/bar logic.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const h = require('../scripts/global/fleet-tool-use-harness.js');

const CORPUS = JSON.parse(fs.readFileSync(path.join(__dirname, 'eval', 'fleet-tool-use-corpus.json'), 'utf8'));

test('eval — parseToolCall classifies every corpus sample per its label (accuracy = 1.0)', () => {
  let correct = 0;
  for (const s of CORPUS.samples) {
    const got = h.parseToolCall(s.output, CORPUS.schema).ok;
    if (got === s.shouldParse) correct += 1;
    else assert.fail(`${s.id}: parsed=${got} expected=${s.shouldParse}`);
  }
  assert.equal(correct, CORPUS.samples.length);
});

test('AC1/AC2 — measureReliability over the well-formed subset clears the bar', () => {
  const good = CORPUS.samples.filter((s) => s.shouldParse);
  const r = h.measureReliability(good.map((s) => ({ output: s.output, schema: CORPUS.schema })));
  assert.equal(r.parseRate, 1);
  assert.equal(r.meetsBar, true);
});

test('AC2 — a below-bar sample set does NOT clear the reliability bar (fleet not default reviewer)', () => {
  const mixed = CORPUS.samples.map((s) => ({ output: s.output, schema: CORPUS.schema }));
  const r = h.measureReliability(mixed); // includes the malformed ones → below 0.9
  assert.ok(r.parseRate < 0.9);
  assert.equal(r.meetsBar, false);
});

test('AC1 — constrainedToolDispatch retries on malformed then succeeds', async () => {
  const outputs = ['not json', '{"tool":"x"}', '{"tool":"x","args":{}}'];
  let i = 0;
  const prompts = [];
  const dispatch = async (prompt) => { prompts.push(prompt); return outputs[i++]; };
  const r = await h.constrainedToolDispatch('call a tool', CORPUS.schema, { dispatch, maxRetries: 3 });
  assert.equal(r.ok, true);
  assert.equal(r.attempts, 3);
  assert.match(prompts[1], /rejected/); // re-prompt reinforces the schema
});

test('AC1 — constrainedToolDispatch fails cleanly after exhausting retries (never throws)', async () => {
  const dispatch = async () => 'never valid';
  const r = await h.constrainedToolDispatch('x', CORPUS.schema, { dispatch, maxRetries: 2 });
  assert.equal(r.ok, false);
  assert.equal(r.attempts, 3);
});

test('AC1 — chain router: short well-specified chain → fleet; long chain → escalate', () => {
  assert.equal(h.routeToolChain([{ tool: 'a', schema: {} }]).route, 'fleet');
  assert.equal(h.routeToolChain([{ tool: 'a', schema: {} }, { tool: 'b', schema: {} }]).route, 'fleet');
  assert.equal(h.routeToolChain([{ tool: 'a', schema: {} }, { tool: 'b', schema: {} }, { tool: 'c', schema: {} }]).route, 'escalate');
});

test('AC1 — chain router escalates underspecified + empty chains', () => {
  assert.equal(h.routeToolChain([{ tool: 'a' }]).route, 'escalate'); // no schema
  assert.equal(h.routeToolChain([]).route, 'escalate');
});

test('parseToolCall never throws and rejects non-string / empty', () => {
  for (const bad of [undefined, null, 42, '', '{}']) {
    assert.doesNotThrow(() => h.parseToolCall(bad, CORPUS.schema));
  }
});
