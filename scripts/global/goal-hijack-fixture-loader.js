#!/usr/bin/env node
// goal-hijack-fixture-loader — loads + validates goal-hijack adversarial fixtures.
// Per #1972 AC1-AC7. Fixtures live under tests/fixtures/goal-hijack/.
// Each fixture asserts an OWASP Agentic Top 10 invariant against the harness baseline.

'use strict';
const fs = require('fs');
const path = require('path');

const FIXTURE_DIR = path.join(__dirname, '..', '..', 'tests', 'fixtures', 'goal-hijack');

/** Load all fixture JSON files from the fixture directory.
 * @returns {Array} array of fixture objects with computed source path. */
function loadAllFixtures() {
  if (!fs.existsSync(FIXTURE_DIR)) return [];
  return fs.readdirSync(FIXTURE_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const fullPath = path.join(FIXTURE_DIR, f);
      return { ...JSON.parse(fs.readFileSync(fullPath, 'utf8')), _path: fullPath };
    });
}

/** Validate a fixture has all required keys.
 * @param {object} fixture - the fixture object.
 * @returns {object} { ok, missing } */
function validateFixture(fixture) {
  const required = ['id', 'owasp_risk', 'category', 'adversarial_prompt',
    'expected_invariant', 'expected_response_must_match', 'expected_response_must_not_match'];
  const missing = required.filter((k) => !(k in fixture));
  return { ok: missing.length === 0, missing };
}

/** Check whether a candidate response satisfies a fixture's pass/fail criteria.
 * @param {object} fixture - the fixture object.
 * @param {string} response - text to evaluate against fixture invariants.
 * @returns {object} { pass, must_match_hit, must_not_match_hit }. */
function checkResponse(fixture, response) {
  const text = String(response || '');
  const must_match_hit = new RegExp(fixture.expected_response_must_match, 'i').test(text);
  const must_not_match_hit = new RegExp(fixture.expected_response_must_not_match, 'i').test(text);
  return {
    pass: must_match_hit && !must_not_match_hit,
    must_match_hit,
    must_not_match_hit,
  };
}

/** Summarise a fixtures-run report.
 * @param {Array} results - per-fixture {fixture, check} pairs.
 * @returns {object} aggregated counts + first-failure detail. */
function summarise(results) {
  const total = results.length;
  const passed = results.filter((r) => r.check.pass).length;
  const failed = total - passed;
  const firstFailure = results.find((r) => !r.check.pass);
  return { total, passed, failed, firstFailure };
}

if (require.main === module) {
  const fixtures = loadAllFixtures();
  const report = { loaded: fixtures.length, ids: fixtures.map((f) => f.id) };
  console.log(JSON.stringify(report, null, 2));
}

module.exports = { loadAllFixtures, validateFixture, checkResponse, summarise, FIXTURE_DIR };
