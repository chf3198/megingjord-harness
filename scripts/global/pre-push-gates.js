#!/usr/bin/env node
'use strict';

const { spawnSync } = require('node:child_process');
const bypassTracker = require('./session-bypass-tracker');

const BYPASSED_GATES = [
  'branch-name regex check',
  'npm run lint',
  'npm run lint:readability:ci',
  'npm run lint:js',
  'npm run lint:md',
  'npm run lint:py',
  'npm run lint:sh',
  'node scripts/global/megalint/index.js',
  'node scripts/global/test-evidence-validator.js --diff-only',
];

function warnBypass(source) {
  console.log(`⚠️ pre-push bypass active (${source})`);
  console.log(`⚠️ bypassed gates: ${BYPASSED_GATES.join('; ')}`);
}

function shouldBypass(argv, env) {
  if (argv.includes('--bypass')) return 'cli-flag';
  if (env.PUSH_GATES_BYPASS === '1') return 'PUSH_GATES_BYPASS=1';
  return null;
}

function run(argv = process.argv.slice(2), env = process.env) {
  const bypass = shouldBypass(argv, env);
  if (bypass) {
    warnBypass(bypass);
    bypassTracker.record(env);
    return 0;
  }

  if (env.SKIP_DRIFT_LINT === 'true') {
    console.log(`⚠️ SKIP_DRIFT_LINT active — bypass recorded`);
    const file = require('path').join(require('os').homedir(), '.megingjord', 'incidents.jsonl');
    try {
      require('fs').mkdirSync(require('path').dirname(file), { recursive: true });
      require('fs').appendFileSync(file, JSON.stringify({ timestamp: new Date().toISOString(), pattern_id: 'ticket-drift-lint-bypass', message: 'skipped pre-push linter' }) + '\n');
    } catch {}
  } else {
    try {
      const { lintEpicDrift } = require('./lint-epic-drift.js');
      const raw = require('child_process').execFileSync('gh', ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'], { encoding: 'utf8' }).trim();
      const [owner, repo] = raw.split('/');
      const findings = lintEpicDrift(owner, repo);
      if (findings.length) {
        console.error('❌ pre-push-gates: Ticket Governance Drift Detected:');
        findings.forEach(f => console.error(`  - [Class ${f.class}] ${f.message}`));
        return 1;
      }
    } catch (e) {
      console.log(`⚠️ pre-push-gates: epic-drift-check skipped or fetch error: ${e.message}`);
    }
  }

  if (env.PRE_PUSH_GATES_FAKE_STATUS) {
    return Number(env.PRE_PUSH_GATES_FAKE_STATUS);
  }
  const child = spawnSync('npx', ['lefthook', 'run', 'pre-push'], { stdio: 'inherit', env });
  if (typeof child.status === 'number') return child.status;
  console.error('pre-push-gates: lefthook execution failed');
  return 1;
}

if (require.main === module) process.exit(run());

module.exports = { run, BYPASSED_GATES, shouldBypass };
