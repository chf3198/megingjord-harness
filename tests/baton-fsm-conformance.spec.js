// baton-fsm-conformance.spec.js — Golden-file conformance tests for the baton FSM.
// Strategy: golden-file. Asserts JS/WASM byte-identity, W-method completeness,
// adversarial DENY invariant, and corpus freshness. Refs #3288, Epic #3284.
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');

const { runConformance, loadCorpus } = require(
  '../scripts/global/baton-fsm/conformance-runner'
);
const { generateCorpus } = require(
  '../scripts/global/baton-fsm/corpus-generate'
);
const {
  STATES, STATE_COUNT, EVENTS, EVENT_COUNT, TRANSITIONS, DECISIONS,
} = require('../scripts/global/baton-fsm/transitions');

const CORPUS_DIR = join(__dirname, 'fixtures', 'baton-fsm-corpus');

describe('baton-fsm conformance', function () {

  it('runConformance reports zero failures over the committed corpus', async function () {
    const result = await runConformance(CORPUS_DIR);
    assert.equal(result.failed, 0,
      'Conformance failures: ' + JSON.stringify(result.failures));
    assert.equal(result.mismatches, 0,
      'JS/WASM mismatches detected: ' + result.mismatches);
    assert.ok(result.total > 0, 'Corpus must contain at least one case');
  });

  it('JS and WASM produce byte-identical packed i32 for every corpus case', async function () {
    const result = await runConformance(CORPUS_DIR);
    assert.equal(result.mismatches, 0,
      'JS/WASM byte-identity violated in ' + result.mismatches + ' cases');
  });

  it('corpus covers every state in STATES', function () {
    const cases = loadCorpus(CORPUS_DIR);
    const coveredStates = new Set(cases.map(function (tc) { return tc.state; }));
    for (let stateIdx = 0; stateIdx < STATE_COUNT; stateIdx++) {
      assert.ok(coveredStates.has(stateIdx),
        'State ' + stateIdx + ' not covered in corpus');
    }
  });

  it('corpus covers every event in EVENTS', function () {
    const cases = loadCorpus(CORPUS_DIR);
    const coveredEvents = new Set(cases.map(function (tc) { return tc.event; }));
    for (let eventIdx = 0; eventIdx < EVENT_COUNT; eventIdx++) {
      assert.ok(coveredEvents.has(eventIdx),
        'Event ' + eventIdx + ' not covered in corpus');
    }
  });

  it('corpus covers every TRANSITIONS row (W-method completeness)', function () {
    const cases = loadCorpus(CORPUS_DIR);
    const corpusKeys = new Set(cases.map(
      function (tc) { return tc.state + ':' + tc.event; }
    ));
    for (const row of TRANSITIONS) {
      const key = row.fromState + ':' + row.event;
      assert.ok(corpusKeys.has(key),
        'TRANSITIONS row ' + key + ' not covered in corpus');
    }
  });

  it('every adversarial fixture yields DENY (never ALLOW)', function () {
    const adversarialPath = join(CORPUS_DIR, 'adversarial.json');
    const adversarialCases = JSON.parse(readFileSync(adversarialPath, 'utf8'));
    assert.ok(adversarialCases.length > 0, 'Adversarial corpus must not be empty');
    for (const tc of adversarialCases) {
      assert.equal(tc.expected.decision, DECISIONS.DENY,
        'Adversarial case ' + tc.name + ' should expect DENY');
    }
  });

  it('committed corpus matches corpus-generate.js output (golden-file)', function () {
    const generated = generateCorpus();
    const committedFiles = readdirSync(CORPUS_DIR).filter(
      function (fileName) { return fileName.endsWith('.json'); }
    ).sort();
    const generatedCategories = Object.keys(generated).sort();
    assert.deepStrictEqual(committedFiles, generatedCategories.map(
      function (cat) { return cat + '.json'; }
    ), 'Corpus file names must match generated categories');

    for (const category of generatedCategories) {
      const committedPath = join(CORPUS_DIR, category + '.json');
      const committedData = JSON.parse(readFileSync(committedPath, 'utf8'));
      assert.deepStrictEqual(committedData, generated[category],
        'Committed corpus for "' + category + '" differs from generator output');
    }
  });

  it('corpus contains all 11 states x 12 events coverage (exhaustive pair set)', function () {
    const cases = loadCorpus(CORPUS_DIR);
    const coveredPairs = new Set(cases.map(
      function (tc) { return tc.state + ':' + tc.event; }
    ));
    const expectedPairCount = STATE_COUNT * EVENT_COUNT;
    assert.equal(coveredPairs.size, expectedPairCount,
      'Expected ' + expectedPairCount + ' unique state:event pairs, got ' +
      coveredPairs.size);
  });
});
