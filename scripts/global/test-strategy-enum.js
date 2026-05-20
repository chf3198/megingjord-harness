#!/usr/bin/env node
'use strict';
// #1236 — single source of truth for test_strategy enum.
// Consumed by test-evidence-validator.js and drift-detection spec.
// Adding a new strategy here requires updating instructions/test-methodology-matrix.instructions.md.

const ALLOWED_STRATEGIES = [
  'tdd-pyramid', 'tdd-trophy', 'contract-test', 'golden-file',
  'eval-harness', 'visual-regression', 'drift-lint', 'peer-review',
  'manual-verify', 'none',
  // stress-test is composable (e.g. tdd-pyramid+stress-test); not a standalone strategy value.
];

const NONE_PERMITTED_LANES = [
  'lane:trivial', 'lane:docs-research', 'lane:docs-only',
  'lane:research', 'lane:config-only',
];

const PEER_REVIEW_RUBRIC_THRESHOLD = 7;

module.exports = { ALLOWED_STRATEGIES, NONE_PERMITTED_LANES, PEER_REVIEW_RUBRIC_THRESHOLD };
