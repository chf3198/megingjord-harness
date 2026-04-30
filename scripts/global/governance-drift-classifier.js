#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..', '..');
const logsDir = path.join(root, 'logs');
const args = process.argv.slice(2);
const asJson = args.includes('--json');

// Issue strings matching closed/done tickets missing terminal artifacts.
const TERMINAL_PATTERNS = [
  /missing CONSULTANT_CLOSEOUT/,
  /missing GitHub Evidence Block/,
  /closed status contains role label/,
];

// Issue strings that indicate epic-level integrity failures.
const EPIC_PATTERNS = [
  /epic closed with open children/,
];

/**
 * Classify a single governance issue string into one of:
 *   'epic' | 'terminal' | 'open'
 * @param {string} issue
 * @returns {'epic'|'terminal'|'open'}
 */
function classifyIssue(issue) {
  if (EPIC_PATTERNS.some(rx => rx.test(issue))) return 'epic';
  if (TERMINAL_PATTERNS.some(rx => rx.test(issue))) return 'terminal';
  return 'open';
}

/**
 * Classify a list of governance issue strings into drift classes.
 * @param {string[]} issues
 * @returns {{ open: object[], terminal: object[], epic: object[] }}
 */
function classify(issues) {
  const classes = { open: [], terminal: [], epic: [] };
  for (const message of issues) {
    const driftClass = classifyIssue(message);
    classes[driftClass].push({ message, driftClass });
  }
  return classes;
}

function runVerify() {
  try {
    return execSync('node scripts/global/governance-verify.js --json', {
      cwd: root, encoding: 'utf8',
    });
  } catch (err) {
    return err.stdout || '{}';
  }
}

function buildReport(verifyData) {
  const classes = classify(verifyData.issues || []);
  const total = verifyData.failedChecks || 0;
  return {
    generatedAt: new Date().toISOString(),
    checkedTickets: verifyData.checkedTickets || 0,
    totalDrift: total,
    driftByClass: { open: classes.open.length, terminal: classes.terminal.length, epic: classes.epic.length },
    details: classes,
    status: total === 0 ? 'no-drift' : 'drift-detected',
  };
}

function run() {
  const report = buildReport(JSON.parse(runVerify()));
  fs.mkdirSync(logsDir, { recursive: true });
  fs.writeFileSync(
    path.join(logsDir, 'governance-drift.json'),
    JSON.stringify(report, null, 2)
  );
  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    const { open, terminal, epic } = report.driftByClass;
    console.log(`Drift: ${report.status} | open=${open} terminal=${terminal} epic=${epic}`);
  }
  process.exit(report.totalDrift ? 1 : 0);
}

module.exports = { classify, classifyIssue };
if (require.main === module) run();
