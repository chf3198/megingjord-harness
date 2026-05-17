'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  classify, meanToScore100, bandFor, BANDS,
  POLICY_VERSION, DEFAULT_CONF_THRESHOLD, DEFAULT_AGREE_THRESHOLD,
} = require('../scripts/global/review-score-classifier.js');

test('meanToScore100 multiplies and rounds', () => {
  assert.equal(meanToScore100(8.7), 87);
  assert.equal(meanToScore100(7.0), 70);
  assert.equal(meanToScore100(9.94), 99);
  assert.equal(meanToScore100(0), 0);
  assert.equal(meanToScore100(10), 100);
});

test('bandFor maps each boundary correctly', () => {
  assert.equal(bandFor(100).letter, 'A');
  assert.equal(bandFor(90).letter, 'A');
  assert.equal(bandFor(89).letter, 'B');
  assert.equal(bandFor(80).letter, 'B');
  assert.equal(bandFor(79).letter, 'C');
  assert.equal(bandFor(70).letter, 'C');
  assert.equal(bandFor(69).letter, 'D');
  assert.equal(bandFor(60).letter, 'D');
  assert.equal(bandFor(59).letter, 'F');
  assert.equal(bandFor(0).letter, 'F');
});

test('classify produces expected band+tier+action at each band center', () => {
  assert.equal(classify(9.5).action, 'none');         // A
  assert.equal(classify(9.5).tier, 0);
  assert.equal(classify(8.5).action, 'log-tier1-event');                 // B
  assert.equal(classify(7.5).action, 'file-tier2-followon-p3');           // C
  assert.equal(classify(6.5).action, 'file-tier2-followon-p2');           // D
});

test('classify Tier-3 requires both confidence AND agreement thresholds', () => {
  // No confidence/agreement provided → downgrade to low-confidence log
  assert.equal(classify(5.0).action, 'log-tier1-event-low-confidence');
  // Confidence high, agreement high → file Tier-3
  assert.equal(classify(5.0, { confidence: 0.9, agreement: 0.9 }).action, 'file-tier3-self-anneal-p1');
  // Confidence low, agreement high → downgrade
  assert.equal(classify(5.0, { confidence: 0.5, agreement: 0.9 }).action, 'log-tier1-event-low-confidence');
  // Confidence high, agreement low → downgrade
  assert.equal(classify(5.0, { confidence: 0.9, agreement: 0.5 }).action, 'log-tier1-event-low-confidence');
  // Confidence high, agreement null (single-reviewer) → accept Tier-3
  assert.equal(classify(5.0, { confidence: 0.9, agreement: null }).action, 'file-tier3-self-anneal-p1');
});

test('classify output shape includes audit-trail fields', () => {
  const r = classify(8.7, { confidence: 0.85, llmJudgeScore: 80 });
  assert.equal(r.score, 87);
  assert.equal(r.band, 'B');
  assert.equal(r.tier, 1);
  assert.equal(r.policy_version, POLICY_VERSION);
  assert.equal(r.rubric_version, 'g1-g9-v2');
  assert.equal(r.confidence, 0.85);
  assert.equal(r.llm_judge_score, 80);
  assert.equal(r.provisional, false);
});

test('BANDS exposes exactly 5 entries A-F', () => {
  assert.equal(BANDS.length, 5);
  const letters = BANDS.map(b => b.letter);
  assert.deepEqual(letters, ['A', 'B', 'C', 'D', 'F']);
});

test('defaults are sane', () => {
  assert.ok(DEFAULT_CONF_THRESHOLD >= 0.5 && DEFAULT_CONF_THRESHOLD <= 1);
  assert.ok(DEFAULT_AGREE_THRESHOLD >= 0.5 && DEFAULT_AGREE_THRESHOLD <= 1);
  assert.ok(typeof POLICY_VERSION === 'string' && POLICY_VERSION.length > 0);
});

// #1750 / #1811: closeout-schema validator accepts rubric_provisional flag.
const cc = require('../scripts/global/megalint/consultant-closeout.js');
const sigBlock = '\nSigned-by: Orla Vale\nTeam&Model: claude-code:opus-4-7@anthropic\nRole: consultant';

test('closeout-schema accepts rubric_provisional:true as bridge until calibration corpus exists', () => {
  const body = `## CONSULTANT_CLOSEOUT\nverification-timestamp: 2026-05-17T00:00:00Z\nverdict: approve\nrubric_provisional: true${sigBlock}`;
  const result = cc.validate({ comments: [{ body }] });
  const missingRubric = result.violations.find(v => v.rule === 'missing-rubric');
  assert.equal(missingRubric, undefined, 'missing-rubric should NOT fire when rubric_provisional:true present');
  const advisory = result.violations.find(v => v.rule === 'rubric-provisional-advisory');
  assert.ok(advisory, 'rubric-provisional-advisory should be emitted');
  assert.equal(advisory.severity, 'advisory');
});

test('closeout-schema still rejects missing rubric AND missing provisional flag', () => {
  const body = `## CONSULTANT_CLOSEOUT\nverification-timestamp: 2026-05-17T00:00:00Z\nverdict: approve${sigBlock}`;
  const result = cc.validate({ comments: [{ body }] });
  assert.ok(result.violations.find(v => v.rule === 'missing-rubric'));
});
