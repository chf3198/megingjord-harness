#!/usr/bin/env node
'use strict';
// collaborator-preflight (#2438) — pre-handoff gate: validates doc-coverage
// block + cross-family review fields before posting COLLABORATOR_HANDOFF.
// Usage: node collaborator-preflight.js --lane lane:code-change --labels area:governance --body "..."

const path = require('path');
const args = process.argv.slice(2);
const get = k => { const i = args.indexOf(k); return i !== -1 ? args[i + 1] : null; };
const lane = get('--lane') || 'lane:code-change';
const labels = (get('--labels') || '').split(',').map(s => s.trim()).filter(Boolean);
const body = get('--body') || '';

const docCoverage = require(path.join(__dirname, 'megalint', 'doc-coverage.js'));
const { LIGHTWEIGHT } = require(path.join(__dirname, 'lane-enum.js'));

function checkCrossFamily(handoffBody) {
  const violations = [];
  if (!/cross_family_reviewer:/i.test(handoffBody)) {
    violations.push({ rule: 'missing-cross-family-reviewer',
      detail: 'COLLABORATOR_HANDOFF missing cross_family_reviewer: field',
      severity: 'advisory' });
  }
  if (!/cross_family_rating:/i.test(handoffBody)) {
    violations.push({ rule: 'missing-cross-family-rating',
      detail: 'COLLABORATOR_HANDOFF missing cross_family_rating: field',
      severity: 'advisory' });
  }
  if (!/reviewer_family:/i.test(handoffBody)) {
    violations.push({ rule: 'missing-reviewer-family',
      detail: 'COLLABORATOR_HANDOFF missing reviewer_family: field',
      severity: 'advisory' });
  }
  return violations;
}

function check(handoffBody, ticketLane, ticketLabels) {
  if (LIGHTWEIGHT.includes(ticketLane)) return { ok: true, violations: [] };
  const violations = [];
  if (ticketLane === 'lane:code-change') {
    let matrix;
    try { matrix = docCoverage.loadMatrix(); } catch (_) { matrix = null; }
    if (matrix) violations.push(...docCoverage.checkBlock(handoffBody, ticketLabels, matrix));
    violations.push(...checkCrossFamily(handoffBody));
  }
  const blocking = violations.filter(v => v.severity !== 'advisory');
  return { ok: blocking.length === 0, violations };
}

if (require.main === module) {
  const result = check(body, lane, labels);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exit(result.ok ? 0 : 1);
}

module.exports = { check, checkCrossFamily };
