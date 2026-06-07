'use strict';
// tier: 3
// collaborator-preflight — quality gates before COLLABORATOR_HANDOFF. Refs #2438.
// Gates: lint → tests → changelog-fragment → fleet cross-family review.

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..', '..');

function runLint(cwd = ROOT) {
  const r = spawnSync('npm', ['run', 'lint'], { cwd, encoding: 'utf8' });
  return { ok: r.status === 0, output: r.stderr || r.stdout };
}

function runTests(cwd = ROOT) {
  const r = spawnSync('npm', ['test'], { cwd, encoding: 'utf8' });
  return { ok: r.status === 0, output: r.stderr || r.stdout };
}

function checkChangelogFragment(ticket, cwd = ROOT) {
  const p = path.join(cwd, '.changes', 'unreleased', `${ticket}.md`);
  return { ok: fs.existsSync(p), path: p };
}

async function runFleetReview(content, ticket) {
  const { dispatchRedTeam } = require('./fleet-red-team-dispatch.js');
  const result = await dispatchRedTeam({
    artifactType: 'collaborator-handoff', content,
    taskContext: { ticket },
  });
  const rating = parseInt(
    (result.raw || '').match(/rating[:\s]+(\d+)/i)?.[1] || '70', 10);
  // #2646: when the fleet was unreachable and the review failed over to the $0
  // free-cloud tier, surface that substituted reviewer (not the fleet host).
  const host = result.hamrStats?.substituted ? 'free-cloud'
    : result.hamrStats?.ok ? '100.91.113.16:11434' : 'unavailable';
  return {
    reviewer: `${result.modelUsed || 'qwen2.5-coder:7b'}@${host}`,
    rating,
    findings: (result.findings || []).map(f => f.detail || f).join('; ')
      || (result.raw || '').slice(0, 200) || 'none',
  };
}

async function run(argv = process.argv.slice(2), opts = {}) {
  const ticket = (argv.find(a => a.startsWith('--ticket=')) || '')
    .replace('--ticket=', '');
  if (!ticket) { console.error('[preflight] --ticket=N required'); return false; }

  const lint = opts.runLint ? opts.runLint() : runLint();
  if (!lint.ok) { console.error('[preflight] lint failed'); return false; }

  const tests = opts.runTests ? opts.runTests() : runTests();
  if (!tests.ok) { console.error('[preflight] tests failed'); return false; }

  const changelog = opts.checkChangelog
    ? opts.checkChangelog(ticket) : checkChangelogFragment(ticket);
  if (!changelog.ok) {
    console.error(`[preflight] missing changelog fragment: ${changelog.path}`);
    return false;
  }

  const diffFiles = (argv.find(a => a.startsWith('--diff-files=')) || '')
    .replace('--diff-files=', '').split(',').filter(Boolean);
  const content = diffFiles.map(f => {
    try { return fs.readFileSync(path.resolve(f), 'utf8'); } catch (_) { return ''; }
  }).join('\n');
  const review = opts.runFleetReview
    ? await opts.runFleetReview(content, ticket)
    : await runFleetReview(content, ticket);

  console.log('\n=== COLLABORATOR_HANDOFF cross-family fields ===');
  console.log(`cross_family_reviewer: ${review.reviewer}`);
  console.log(`cross_family_rating: ${review.rating}/100`);
  console.log(`cross_family_findings: ${review.findings}`);
  return true;
}

if (require.main === module) {
  if (process.argv.includes('--help')) {
    console.log('Usage: node collaborator-preflight.js --ticket=N [--diff-files=a,b,...]');
    process.exit(0);
  }
  run().then(ok => process.exit(ok ? 0 : 1));
}

module.exports = { run, runLint, runTests, checkChangelogFragment };
