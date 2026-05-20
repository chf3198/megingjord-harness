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
  if (env.PRE_PUSH_GATES_FAKE_STATUS) {
    return Number(env.PRE_PUSH_GATES_FAKE_STATUS);
  }
  const child = spawnSync('npx', ['lefthook', 'run', 'pre-push'], {
    stdio: 'inherit',
    env,
  });
  if (typeof child.status === 'number') return child.status;
  console.error('pre-push-gates: lefthook execution failed');
  return 1;
}

if (require.main === module) process.exit(run());

module.exports = { run, BYPASSED_GATES, shouldBypass };
