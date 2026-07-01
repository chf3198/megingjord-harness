'use strict';
// harness-add-runtime-surfaces.js — surface definitions for harness:add-runtime scaffold.
// Each surface describes one registry file a new runtime must be wired into.
// Kept in a separate module so harness-add-runtime.js functions stay ≤30 lines.

const SURFACE_GITHUB_ACTOR_MAP = 'github-actor-team-map';
const SURFACE_ROUTING_ADAPTERS = 'routing-provider-adapters';
const SURFACE_LEADER_ELECTION = 'leader-election';
const SURFACE_DETECT_RUNTIME = 'detect-runtime';
const SURFACE_TEAM_SIGNATURES = 'team-model-signatures';
const SURFACE_SELF_TEST_REGISTRY = 'harness-self-test-registry';
const SURFACE_ORC_PARITY = 'orchestrator-governance-parity';
const SURFACE_DEPLOY_SH = 'deploy-sh';
const SURFACE_PKG_DEPLOY = 'package-json-deploy';
const SURFACE_PKG_SCRIPT = 'package-json-harness-script';
const SURFACE_DESCRIPTOR = 'runtime-descriptor';

const SURFACE_ORDER = [
  SURFACE_DESCRIPTOR,
  SURFACE_GITHUB_ACTOR_MAP,
  SURFACE_ROUTING_ADAPTERS,
  SURFACE_LEADER_ELECTION,
  SURFACE_DETECT_RUNTIME,
  SURFACE_TEAM_SIGNATURES,
  SURFACE_SELF_TEST_REGISTRY,
  SURFACE_ORC_PARITY,
  SURFACE_DEPLOY_SH,
  SURFACE_PKG_DEPLOY,
  SURFACE_PKG_SCRIPT,
];

module.exports = {
  SURFACE_ORDER,
  SURFACE_DESCRIPTOR,
  SURFACE_GITHUB_ACTOR_MAP,
  SURFACE_ROUTING_ADAPTERS,
  SURFACE_LEADER_ELECTION,
  SURFACE_DETECT_RUNTIME,
  SURFACE_TEAM_SIGNATURES,
  SURFACE_SELF_TEST_REGISTRY,
  SURFACE_ORC_PARITY,
  SURFACE_DEPLOY_SH,
  SURFACE_PKG_DEPLOY,
  SURFACE_PKG_SCRIPT,
};
