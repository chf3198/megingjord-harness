#!/usr/bin/env node
'use strict';
// harness-confidence.js (#3631): one uniform cross-team runtime-capability probe.
// Emits a stable `harness-confidence/v1` JSON envelope with per-probe EVIDENCE (not booleans),
// so any orchestrator can answer "can I do governed work here, and if not, why" without log-scraping.
// Schema co-designed by the Codex team. Modes: --quick (default, zero network) | --smoke (live calls).
// Secret-safe (G4): key checks emit present|missing only, never values. Graceful (G5/G6): every probe
// degrades to fail/skipped with a `reason` rather than throwing.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const SCHEMA_VERSION = 'harness-confidence/v1';
const REQUIRED_KEYS = ['GROQ_API_KEY', 'CEREBRAS_API_KEY', 'MISTRAL_API_KEY', 'OPENROUTER_API_KEY'];
// When a check is `fail`, is that fail blocking (stops governed work) or a warning (fallback exists)?
const BLOCKS_WHEN_FAILED = new Set(['github', 'skills']);
const SH_TIMEOUT_MS = 8000; // per-subprocess probe budget
const SMOKE_TIMEOUT_MS = 20000; // per-provider budget for the --smoke free-cloud call

function sh(command) {
  try { return cp.execSync(command, { stdio: ['ignore', 'pipe', 'ignore'], timeout: SH_TIMEOUT_MS }).toString().trim(); }
  catch { return null; }
}
function binStatus(bin) { return sh(`command -v ${bin}`) ? 'available' : 'missing'; }

function repoInfo(cwd) {
  const root = sh(`git -C "${cwd}" rev-parse --show-toplevel`) || cwd;
  const branch = sh(`git -C "${cwd}" rev-parse --abbrev-ref HEAD`) || 'unknown';
  const gitDir = sh(`git -C "${cwd}" rev-parse --absolute-git-dir`) || '';
  const commonDir = sh(`git -C "${cwd}" rev-parse --path-format=absolute --git-common-dir`) || '';
  let worktreeKind = 'unknown';
  if (gitDir && commonDir) worktreeKind = gitDir === commonDir ? 'main' : 'ticket';
  return { root, branch, worktree_kind: worktreeKind, dirty: !!sh(`git -C "${cwd}" status --porcelain`) };
}

// --- checks: each returns { status, ...evidence }; never throws ---

function checkEnvHydration(root) {
  const envPath = path.join(root, '.env');
  const envFilePresent = fs.existsSync(envPath);
  let text = '';
  try { if (envFilePresent) text = fs.readFileSync(envPath, 'utf8'); } catch { /* unreadable -> treat as absent */ }
  const requiredKeys = {};
  let anyMissing = false;
  for (const key of REQUIRED_KEYS) {
    const inFile = new RegExp(`^(export\\s+)?${key}=`, 'm').test(text);
    const present = inFile || !!process.env[key]; // fill-don't-override parity with load-local-env
    requiredKeys[key] = present ? 'present' : 'missing';
    if (!present) anyMissing = true;
  }
  const source = anyMissing ? (envFilePresent ? '.env' : 'none') : (envFilePresent ? '.env' : 'process');
  return { status: anyMissing ? 'fail' : 'pass', source, env_file_present: envFilePresent, required_keys: requiredKeys };
}

function checkHamr(smoke) {
  const candidates = [
    path.join(process.env.HOME || '', '.codex/devenv-ops/hamr-config.json'),
    path.join(process.env.HOME || '', '.copilot/hamr-config.json'),
    path.join(process.env.HOME || '', '.claude/hamr-config.json'),
  ];
  const configPath = candidates.find((p) => fs.existsSync(p)) || null;
  const activated = !!configPath;
  let hookHealth = 'unknown';
  try { const { scanHookHealth } = require('./hook-symlink-health'); const scan = scanHookHealth();
    hookHealth = scan && scan.broken && scan.broken.length ? 'degraded' : 'ok'; } catch { hookHealth = 'unknown'; }
  if (!activated) return { status: 'fail', activated, config_path: null, doctor_tier: 'none', worker_reachable: null, hook_health: hookHealth };
  if (!smoke) { // quick: local evidence only, no network — a healthy hook state can reach pass
    return { status: hookHealth === 'degraded' ? 'degraded' : 'pass', activated, config_path: configPath, doctor_tier: 'skipped', worker_reachable: null, hook_health: hookHealth };
  }
  const out = sh('node scripts/global/hamr-doctor.js 2>/dev/null') || ''; // smoke: live tier from hamr:doctor
  const tier = (/tier1-full|tier2-degraded|tier3-offline/i.exec(out) || ['unknown'])[0].toLowerCase();
  const status = tier === 'tier1-full' ? 'pass' : tier === 'tier3-offline' ? 'fail' : tier === 'tier2-degraded' ? 'degraded' : 'degraded';
  return { status, activated, config_path: configPath, doctor_tier: tier, worker_reachable: tier === 'tier3-offline' ? false : tier === 'unknown' ? null : true, hook_health: hookHealth };
}

function checkFreeCloudSmoke(smoke) {
  if (!smoke) return { status: 'skipped', provider: null, reason: 'quick-mode', latency_ms: null, content_matched: null };
  try {
    const { callProvider } = require('./free-cloud-dispatch');
    const started = Date.now();
    return callProvider('groq', 'reply with the single token OK', { timeoutMs: SMOKE_TIMEOUT_MS })
      .then((r) => ({
        status: r && r.ok ? 'pass' : 'fail', provider: 'groq', reason: r && r.ok ? null : (r && r.reason) || 'no_response',
        latency_ms: Date.now() - started, content_matched: !!(r && r.ok && /ok/i.test(r.content || '')),
      }))
      .catch((e) => ({ status: 'fail', provider: 'groq', reason: String(e && e.message || e), latency_ms: null, content_matched: false }));
  } catch (e) {
    return { status: 'fail', provider: null, reason: `dispatch-unavailable:${e.message}`, latency_ms: null, content_matched: false };
  }
}

function checkFleetSmoke(smoke) {
  if (!smoke) return { status: 'skipped', inventory_reachable: null, dispatch_ok: null, route_attempted: null, reason: 'quick-mode', fallback_tier: null };
  let cascade;
  try { ({ cascade } = require('./cascade-dispatch')); }
  catch (e) { return { status: 'fail', inventory_reachable: null, dispatch_ok: false, route_attempted: null, reason: `cascade-unavailable:${e.message}`, fallback_tier: null }; }
  // Live dispatch: tier 'local' = fleet answered; 'free-cloud' = reachable-but-fell-back; else failed.
  return cascade('reply with the single token OK', {}).then((result) => {
    const fleetOk = !!(result && result.ok && result.tier === 'local');
    const fellBack = !!(result && result.tier === 'free-cloud');
    return {
      status: fleetOk ? 'pass' : fellBack ? 'degraded' : 'fail',
      inventory_reachable: fleetOk || fellBack ? true : null,
      dispatch_ok: fleetOk,
      route_attempted: result && result.tier === 'local' ? 'ollama' : 'ollama->free-cloud',
      reason: fleetOk ? null : (result && result.reason) || 'fleet dispatch failed',
      fallback_tier: fellBack ? 'free-cloud' : null,
    };
  }).catch((e) => ({ status: 'fail', inventory_reachable: null, dispatch_ok: false, route_attempted: 'ollama', reason: String((e && e.message) || e), fallback_tier: null }));
}

function checkGithub() {
  const authLine = sh('gh auth status 2>&1') || '';
  const authenticated = /Logged in to/i.test(authLine);
  const scopes = (/Token scopes: (.+)/i.exec(authLine) || [])[1];
  return {
    status: authenticated ? 'pass' : 'fail',
    gh_cli: binStatus('gh') === 'missing' ? 'missing' : authenticated ? 'authenticated' : 'unauthenticated',
    mcp_tools: 'lazy-loadable',
    scopes: scopes ? scopes.replace(/['"]/g, '').split(',').map((s) => s.trim()).filter(Boolean) : [],
  };
}

function dirCount(dir) { try { return fs.readdirSync(dir).filter((f) => !f.startsWith('.')).length; } catch { return 0; } }

function checkSkills() {
  const home = process.env.HOME || '';
  const registries = [path.join(home, '.agents/skills'), path.join(home, '.copilot/skills'), path.join(home, '.codex/skills')];
  const agentsCount = dirCount(path.join(home, '.agents/skills'));
  const codexDir = path.join(home, '.codex/skills');
  const registryAvailable = registries.some((dir) => dirCount(dir) > 0);
  const required = ['operator-identity-context', 'cross-family-review'];
  const requiredSkills = {};
  let anyMissing = false;
  for (const name of required) {
    // Resolve the NAMED skill's SKILL.md, not just "some registry has entries" (avoids false positives).
    const found = registries.some((dir) => fs.existsSync(path.join(dir, name, 'SKILL.md')));
    requiredSkills[name] = found ? 'available' : 'missing';
    if (!found) anyMissing = true;
  }
  return {
    status: anyMissing ? 'fail' : 'pass',
    registry_available: registryAvailable, codex_skill_dir_present: fs.existsSync(codexDir),
    codex_skill_dir_count: dirCount(codexDir), agents_skill_dir_count: agentsCount, required_skills: requiredSkills,
  };
}

function checkTooling() {
  const tools = { rg: binStatus('rg'), git: binStatus('git'), node: binStatus('node'), npm: binStatus('npm') };
  const coreMissing = ['git', 'node', 'npm'].some((t) => tools[t] === 'missing');
  return { status: coreMissing ? 'fail' : tools.rg === 'missing' ? 'degraded' : 'pass', ...tools };
}

function checkDeployParity() {
  // Correct surface: the HAMR script + gate-corpus parity (hamr-sync-verify), NOT skill-dir counts.
  let result;
  try { result = require('./hamr-sync-verify').run(); }
  catch (e) { return { status: 'degraded', reason: `sync-verify-unavailable:${e.message}`, copilot: 'unknown', codex: 'unknown', cursor: 'unknown', antigravity: 'unknown' }; }
  const per = { copilot: 'unknown', codex: 'unknown', cursor: 'unknown', antigravity: 'unknown' };
  for (const target of result.targets || []) per[target.team] = target.exists && !(target.missing || []).length ? 'pass' : 'missing-scripts';
  for (const gate of (result.gate_corpus && result.gate_corpus.results) || []) per[gate.runtime] = gate.ok ? 'pass' : 'missing-gate-corpus';
  // Codex ruling: missing Cursor/Antigravity targets are degraded+warning, not blocking (outside rollout).
  const anyMissing = Object.values(per).some((state) => state !== 'pass' && state !== 'unknown');
  return { status: anyMissing ? 'degraded' : 'pass', ...per };
}

function deriveOverall(checks, rollout) {
  const blocking = [];
  const warnings = [];
  for (const [name, result] of Object.entries(checks)) {
    if (result.status === 'fail') {
      (BLOCKS_WHEN_FAILED.has(name) ? blocking : warnings).push(name);
    } else if (result.status === 'degraded') {
      // deploy_parity degraded is blocking ONLY under an explicit cross-orchestrator rollout (Codex ruling).
      (rollout && name === 'deploy_parity' ? blocking : warnings).push(name);
    }
  }
  const status = blocking.length ? 'fail' : warnings.length ? 'degraded' : 'pass';
  return { status, blocking, warnings };
}

/** Runtime identity + execution surface. @param {boolean} smoke @returns {object} */
function runtimeInfo(smoke) {
  return {
    team: process.env.HAMR_TEAM || 'unknown', model: process.env.HAMR_MODEL || 'unknown',
    host: process.env.HAMR_HOST || 'unknown',
    execution_surface: { shell: true, node: true, network: smoke ? true : null, filesystem: 'full' },
  };
}

function buildEnvelope(opts = {}) {
  const cwd = opts.cwd || process.cwd();
  const smoke = !!opts.smoke;
  const repo = repoInfo(cwd);
  const checks = {
    env_hydration: checkEnvHydration(repo.root),
    hamr: checkHamr(smoke),
    free_cloud_smoke: checkFreeCloudSmoke(smoke),
    fleet_smoke: checkFleetSmoke(smoke),
    github: checkGithub(),
    skills: checkSkills(),
    tooling: checkTooling(),
    deploy_parity: checkDeployParity(),
  };
  return Promise.all([Promise.resolve(checks.free_cloud_smoke), Promise.resolve(checks.fleet_smoke)]).then(([freeCloud, fleet]) => {
    checks.free_cloud_smoke = freeCloud;
    checks.fleet_smoke = fleet;
    return {
      schema_version: SCHEMA_VERSION,
      generated_at: opts.now || null, // stamped by caller/CI; probe stays deterministic
      repo: { root: repo.root, branch: repo.branch, worktree_kind: repo.worktree_kind, dirty: repo.dirty },
      runtime: runtimeInfo(smoke),
      overall: deriveOverall(checks, !!opts.rollout),
      checks,
    };
  });
}

module.exports = {
  buildEnvelope, deriveOverall, checkEnvHydration, checkSkills, checkHamr, checkDeployParity,
  SCHEMA_VERSION, REQUIRED_KEYS,
};

if (require.main === module) {
  const argv = process.argv.slice(2);
  const smoke = argv.includes('--smoke');
  const rollout = argv.includes('--rollout');
  buildEnvelope({ smoke, rollout }).then((env) => {
    process.stdout.write(`${JSON.stringify(env, null, argv.includes('--json') ? 0 : 2)}\n`);
    process.exit(env.overall.status === 'fail' ? 1 : 0);
  });
}
