'use strict';
// Refs #1293 — status:measuring state machine + recheck cron. Per Epic #1271 AC4.
// Sub-state of status:in-progress. Body schema: Recheck-after / Measure-window / Sensor.

const FIELD_RE = {
  recheck_after: /^Recheck-after:\s*(\d{4}-\d{2}-\d{2})/m,
  measure_window: /^Measure-window:\s*([^\n]+)/m,
  sensor: /^Sensor:\s*([^\n]+)/m,
};

function parseMeasuringFields(body) {
  const fields = {};
  for (const [k, re] of Object.entries(FIELD_RE)) {
    const m = (body || '').match(re);
    if (m) fields[k] = m[1].trim();
  }
  return fields;
}

function isOverdue(fields, today = new Date().toISOString().slice(0, 10)) {
  if (!fields.recheck_after) return false;
  return today >= fields.recheck_after;
}

function validateMeasuringSchema(body) {
  const fields = parseMeasuringFields(body);
  const errors = [];
  if (!fields.recheck_after) errors.push('Missing Recheck-after: <ISO-date>');
  if (!fields.measure_window) errors.push('Missing Measure-window: <duration>');
  if (!fields.sensor) errors.push('Missing Sensor: <owner>');
  return { fields, errors, valid: errors.length === 0 };
}

async function recheckRun({ github, context, core }) {
  const { owner, repo } = context.repo;
  const today = new Date().toISOString().slice(0, 10);
  const { data: issues } = await github.rest.issues.listForRepo({
    owner, repo, labels: 'status:measuring', state: 'open', per_page: 100,
  });
  const overdue = [];
  for (const issue of issues) {
    const { fields } = validateMeasuringSchema(issue.body || '');
    if (!isOverdue(fields, today)) continue;
    overdue.push(issue.number);
    await github.rest.issues.createComment({
      owner, repo, issue_number: issue.number,
      body: `📊 **status:measuring recheck**\n\nMeasure-window elapsed (Recheck-after: ${fields.recheck_after}). Please re-evaluate AC state and transition to \`status:in-progress\` or close per measurement outcome.\n\n_Auto-posted by Epic #1271 AC4 measuring-recheck cron._`,
    });
  }
  core.notice(`measuring-recheck: ${overdue.length} overdue Epic(s): ${overdue.join(', ')}`);
}

module.exports = { parseMeasuringFields, isOverdue, validateMeasuringSchema, recheckRun };
