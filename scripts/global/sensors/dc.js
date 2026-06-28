'use strict';
// Refs #1290 — GHS sensor: declared_complete_unmet_ac (Epic #1271 AC2).
// Weight 0.10 (locked equal to existing oo sensor). Reuses #1153 sensor framework.
// Detects Epics where Manager-narrative claims completion AND reconciler says unmet.
// Backfill mitigation (R4): gate on since=2026-05-10 until C8 backfill landed.

const SINCE_DEFAULT = '2026-05-10';

const NARRATIVE_RE = /\bEpic\b\W*(\#\d+\W*)?(complete|done|shipped|finished)\b/i;

function matchesNarrative(text) {
  return NARRATIVE_RE.test(text || '');
}

function compute({ epicComments = [], reconciledByEpic = {}, since = SINCE_DEFAULT } = {}) {
  let drift = 0; const evidence = [];
  for (const comment of epicComments) {
    if (!comment || !comment.epic) continue;
    if (comment.created_at && comment.created_at < since) continue;
    if (!matchesNarrative(comment.body)) continue;
    const reconciled = reconciledByEpic[comment.epic] || [];
    const unmet = reconciled.filter(row => row.truth_status === 'UNMET' && !row.rescope_ref);
    if (unmet.length) {
      drift += 1;
      evidence.push(`epic=${comment.epic} unmet_acs=${unmet.map(row => row.ac_id).join(',')}`);
    }
  }
  return { value: drift, evidence };
}

module.exports = { compute, matchesNarrative, SINCE_DEFAULT };
