'use strict';
// harness-add-runtime-plan.js — buildPlan helpers (one action builder per surface).
// Each exported function returns one planned-action object for buildPlan() to collect.
// Descriptor action checks disk existence; all other helpers are pure (no IO).

const fs = require('node:fs');
const path = require('node:path');
const surfaces = require('./harness-add-runtime-surfaces');

function descriptorAction(runtimeId, repoRoot) {
  const filePath = path.join(repoRoot, 'inventory', 'runtimes', `${runtimeId}.json`);
  const alreadyPresent = fs.existsSync(filePath);
  return {
    surface: surfaces.SURFACE_DESCRIPTOR,
    file: filePath,
    op: alreadyPresent ? 'already-present' : 'create-file',
    detail: alreadyPresent
      ? `runtime descriptor inventory/runtimes/${runtimeId}.json already exists`
      : `Create runtime descriptor inventory/runtimes/${runtimeId}.json`,
  };
}

function githubActorMapAction(runtimeId, repoRoot, actors) {
  const filePath = path.join(repoRoot, 'inventory', 'github-actor-team-map.json');
  const actorKey = `${runtimeId}-agent`;
  const alreadyPresent = Object.values(actors || {}).includes(runtimeId);
  return {
    surface: surfaces.SURFACE_GITHUB_ACTOR_MAP,
    file: filePath,
    op: alreadyPresent ? 'already-present' : 'insert-registry-member',
    detail: alreadyPresent
      ? `team "${runtimeId}" already in actors map`
      : `Add actor "${actorKey}": "${runtimeId}" to actors`,
  };
}

function routingAdaptersAction(runtimeId, repoRoot, runtimeKinds) {
  const filePath = path.join(repoRoot, 'scripts', 'global', 'routing-provider-adapters.json');
  const alreadyPresent = (runtimeKinds || []).includes(runtimeId);
  return {
    surface: surfaces.SURFACE_ROUTING_ADAPTERS,
    file: filePath,
    op: alreadyPresent ? 'already-present' : 'insert-registry-member',
    detail: alreadyPresent
      ? `"${runtimeId}" already in runtimeKinds`
      : `Add "${runtimeId}" to runtimeKinds[]`,
  };
}

function leaderElectionAction(runtimeId, repoRoot, validTeams) {
  const filePath = path.join(repoRoot, 'scripts', 'xteam-mcp', 'leader-election.js');
  const alreadyPresent = (validTeams || []).includes(runtimeId);
  return {
    surface: surfaces.SURFACE_LEADER_ELECTION,
    file: filePath,
    op: alreadyPresent ? 'already-present' : 'insert-registry-member',
    detail: alreadyPresent
      ? `"${runtimeId}" already in VALID_TEAMS`
      : `Add "${runtimeId}" to VALID_TEAMS array`,
  };
}

function detectRuntimeAction(runtimeId, repoRoot, knownRuntimes) {
  const filePath = path.join(repoRoot, 'scripts', 'global', 'detect-runtime.js');
  const alreadyPresent = (knownRuntimes || []).includes(runtimeId);
  return {
    surface: surfaces.SURFACE_DETECT_RUNTIME,
    file: filePath,
    op: alreadyPresent ? 'already-present' : 'insert-registry-member',
    detail: alreadyPresent
      ? `"${runtimeId}" already in KNOWN + PRIMARY`
      : `Add "${runtimeId}" to KNOWN[] and PRIMARY[] with env-marker detection`,
  };
}

function teamSignaturesAction(runtimeId, repoRoot, teamValues) {
  const filePath = path.join(repoRoot, 'inventory', 'team-model-signatures.json');
  const alreadyPresent = (teamValues || []).includes(runtimeId);
  return {
    surface: surfaces.SURFACE_TEAM_SIGNATURES,
    file: filePath,
    op: alreadyPresent ? 'already-present' : 'insert-registry-member',
    detail: alreadyPresent
      ? `"${runtimeId}" already in teamValues + substrateTeamMap + autoModeCoverage`
      : `Add "${runtimeId}" to teamValues[], substrateTeamMap, autoModeCoverage`,
  };
}

function selfTestRegistryAction(runtimeId, repoRoot, adapterExemptions) {
  const filePath = path.join(repoRoot, 'inventory', 'harness-self-test-registry.json');
  const alreadyPresent = Boolean(adapterExemptions && adapterExemptions[runtimeId]);
  return {
    surface: surfaces.SURFACE_SELF_TEST_REGISTRY,
    file: filePath,
    op: alreadyPresent ? 'already-present' : 'insert-registry-member',
    detail: alreadyPresent
      ? `"${runtimeId}" already in adapter_exemptions`
      : `Add "${runtimeId}" entry to adapter_exemptions`,
  };
}

function orcParityAction(runtimeId, repoRoot, orcRuntimes) {
  const filePath = path.join(repoRoot, 'inventory', 'orchestrator-governance-parity.json');
  const alreadyPresent = (orcRuntimes || []).includes(runtimeId);
  return {
    surface: surfaces.SURFACE_ORC_PARITY,
    file: filePath,
    op: alreadyPresent ? 'already-present' : 'insert-registry-member',
    detail: alreadyPresent
      ? `"${runtimeId}" already in runtimes[] + stateStoreParity.runtimes`
      : `Add "${runtimeId}" to runtimes[] and stateStoreParity.runtimes`,
  };
}

function deployShAction(runtimeId, repoRoot, deployTargets) {
  const filePath = path.join(repoRoot, 'scripts', 'deploy.sh');
  const alreadyPresent = (deployTargets || []).includes(runtimeId);
  return {
    surface: surfaces.SURFACE_DEPLOY_SH,
    file: filePath,
    op: alreadyPresent ? 'already-present' : 'add-deploy-target',
    detail: alreadyPresent
      ? `"${runtimeId}" already a deploy target in deploy.sh`
      : `Add --target ${runtimeId} branch to deploy.sh and TARGET_DIRS`,
  };
}

function packageDeployAction(runtimeId, repoRoot, pkgScripts) {
  const filePath = path.join(repoRoot, 'package.json');
  const deployKey = `deploy:${runtimeId}`;
  const alreadyPresent = Boolean(pkgScripts && pkgScripts[deployKey]);
  return {
    surface: surfaces.SURFACE_PKG_DEPLOY,
    file: filePath,
    op: alreadyPresent ? 'already-present' : 'add-npm-script',
    detail: alreadyPresent
      ? `"${deployKey}" already in package.json scripts`
      : `Add "deploy:${runtimeId}" and "deploy:${runtimeId}:apply" npm scripts`,
  };
}

function packageHarnessScriptAction(runtimeId, repoRoot, pkgScripts) {
  const filePath = path.join(repoRoot, 'package.json');
  const scriptKey = 'harness:add-runtime';
  const alreadyPresent = Boolean(pkgScripts && pkgScripts[scriptKey]);
  return {
    surface: surfaces.SURFACE_PKG_SCRIPT,
    file: filePath,
    op: alreadyPresent ? 'already-present' : 'add-npm-script',
    detail: alreadyPresent
      ? `"${scriptKey}" already in package.json scripts`
      : `Add "harness:add-runtime" npm script pointing to harness-add-runtime.js`,
    before: `Note: runtimeId=${runtimeId} — script is shared, not runtime-specific`,
  };
}

module.exports = {
  descriptorAction,
  githubActorMapAction,
  routingAdaptersAction,
  leaderElectionAction,
  detectRuntimeAction,
  teamSignaturesAction,
  selfTestRegistryAction,
  orcParityAction,
  deployShAction,
  packageDeployAction,
  packageHarnessScriptAction,
};
