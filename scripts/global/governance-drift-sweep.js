'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { loadLocalEnvOnce } = require('./load-local-env');
const { listOpenTickets } = require('./governance-audit');
const { parseBody } = require('../ticket-normalizer');

const ROOT = path.resolve(__dirname, '..', '..');
const REPORT_FILE = path.join(ROOT, 'logs', 'governance-drift-sweep.json');
const D_CLASS_IDS = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8'];

function labelNames(issue) {
  return (issue.labels || []).map((label) => (typeof label === 'string' ? label : label.name));
}

function hasLabel(labels, prefix) {
  return labels.some((label) => label === prefix || label.startsWith(`${prefix}:`));
}

function classifyIssue(issue, byNumber = new Map()) {
  const labels = labelNames(issue);
  const classes = [];
  const body = parseBody(issue.body || null);
  const parent = body.parent_issue ? byNumber.get(body.parent_issue) : null;
  const parentLabels = parent ? labelNames(parent) : [];
  const parentActive = parentLabels.includes('type:epic')
    && !parentLabels.some((label) => ['status:backlog', 'status:done', 'status:cancelled'].includes(label));

  if (!hasLabel(labels, 'type') && !hasLabel(labels, 'status') && !hasLabel(labels, 'priority')) classes.push('D1');
  if (labels.includes('status:in-progress') && !labels.some((label) => label.startsWith('role:'))) classes.push('D2');
  if (/^(?:[a-z]+(?:\([^)]+\))?:\s|\[[^\]]+\]\s)/i.test(issue.title || '')) classes.push('D3');
  if (issue.state === 'open' && hasLabel(labels, 'resolution')) classes.push('D4');
  if (labels.includes('status:backlog') && parentActive) classes.push('D5');
  if (labels.includes('type:epic') && (labels.includes('status:dormant') || labels.includes('status:deferred'))
    && !/EPIC_REVIEW/i.test(issue.body || '')) classes.push('D6');
  if (labels.includes('coordinator:cross-team-needs-hand-off')) classes.push('D7');
  if (labels.includes('type:epic') && labels.includes('phase-gate:phase-1')) classes.push('D8');

  return classes;
}

function classifyIssues(issues) {
  const byNumber = new Map(issues.map((issue) => [issue.number, issue]));
  const details = Object.fromEntries(D_CLASS_IDS.map((id) => [id, []]));
  for (const issue of issues) {
    for (const classId of classifyIssue(issue, byNumber)) details[classId].push(issue.number);
  }
  const counts = Object.fromEntries(D_CLASS_IDS.map((id) => [id, details[id].length]));
  return { counts, details, total: Object.values(counts).reduce((sum, value) => sum + value, 0) };
}

function buildReport(issues = []) {
  const scan = classifyIssues(issues);
  return {
    generatedAt: new Date().toISOString(),
    mode: 'scan',
    route: 'deterministic',
    premiumLaneProhibited: true,
    totalDrift: scan.total,
    counts: scan.counts,
    details: scan.details,
    status: scan.total === 0 ? 'pass' : 'fail',
  };
}

async function run(argv = process.argv.slice(2), deps = {}) {
  loadLocalEnvOnce();
  if (argv.includes('--help')) {
    console.log('Usage: node scripts/global/governance-drift-sweep.js [--scan] [--json]');
    return true;
  }
  if (argv.includes('--fix') || argv.includes('--rollback')) {
    console.error('governance-drift-sweep: only --scan is implemented in Phase-1 child #2988.');
    return false;
  }
  const issues = deps.listOpenTickets ? deps.listOpenTickets() : listOpenTickets();
  const report = buildReport(issues);
  fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));
  if (argv.includes('--json') || !argv.includes('--scan')) console.log(JSON.stringify(report, null, 2));
  else {
    const summary = D_CLASS_IDS.map((id) => `${id}=${report.counts[id]}`).join(' ');
    console.log(`governance-drift-sweep: ${report.status.toUpperCase()} | ${summary}`);
  }
  return report.status === 'pass';
}

if (require.main === module) {
  run().then((ok) => process.exit(ok ? 0 : 1)).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { run, buildReport, classifyIssue, classifyIssues, REPORT_FILE };
