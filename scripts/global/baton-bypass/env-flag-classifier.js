// env-flag-classifier.js -- Classify legacy env bypass flags.
// Refs #3292, Epic #3284 (W4). AC3: local env var can NEVER relax CI authority.
// The BYPASS_FLAG_REGISTRY is the allow-list (the #2892 per-repo config surface).
'use strict';

/**
 * Registry of known bypass env flags and their classification.
 * ux-local-only: may downgrade LOCAL hook behavior; CI ignores.
 * authority-affecting: was historically CI-authority-relaxing; that power
 *   is REMOVED. Must become a server-visible label + approver.
 * opt-in-enabler: default-OFF flag that ENABLES a dark-launched feature when set
 *   (NOT a bypass — it grants nothing and relaxes no gate; absence = fail-closed).
 *   Registered so the allow-list documents the flag; ci_authority is always false.
 *
 * ci_authority: false means the flag has NO power to relax CI gates.
 */
const BYPASS_FLAG_REGISTRY = {
  // -- UX-local-only flags (safe; CI ignores them) --
  MEGINGJORD_HAMR_DISABLED: {
    classification: 'ux-local-only',
    ci_authority: false,
    description: 'Opt out of HAMR provider routing locally',
  },
  MEGINGJORD_MCP_DISABLED: {
    classification: 'ux-local-only',
    ci_authority: false,
    description: 'Disable MCP server; fall back to gh CLI',
  },
  MEGINGJORD_FLEET_DIRECT_BLOCK: {
    classification: 'ux-local-only',
    ci_authority: false,
    description: 'Block direct fleet calls locally',
  },
  MEGINGJORD_REBASE_DISCIPLINE_DISABLED: {
    classification: 'ux-local-only',
    ci_authority: false,
    description: 'Air-gapped operators bypass rebase contract',
  },
  MEGINGJORD_NO_DOTENV: {
    classification: 'ux-local-only',
    ci_authority: false,
    description: 'Disable .env auto-hydration',
  },
  MEGINGJORD_NO_TELEMETRY: {
    classification: 'ux-local-only',
    ci_authority: false,
    description: 'Disable review cost telemetry locally',
  },
  MEGINGJORD_PROJECTS_V2_DISABLED: {
    classification: 'ux-local-only',
    ci_authority: false,
    description: 'Disable Projects v2 state sync',
  },
  MEGINGJORD_MODEL_REVIEW_DISABLED: {
    classification: 'ux-local-only',
    ci_authority: false,
    description: 'Disable pre-merge model review locally',
  },
  MEGINGJORD_MULTI_JUDGE_DISABLED: {
    classification: 'ux-local-only',
    ci_authority: false,
    description: 'Disable multi-judge orchestrator',
  },
  MEGINGJORD_BLAST_RADIUS_DISABLED: {
    classification: 'ux-local-only',
    ci_authority: false,
    description: 'Disable blast radius cap locally',
  },
  MEGINGJORD_QUIET_RESOLVER: {
    classification: 'ux-local-only',
    ci_authority: false,
    description: 'Suppress role-resolver stderr in CI/cron',
  },
  MEGINGJORD_SKIP_REGISTRY_INTEGRITY: {
    classification: 'ux-local-only',
    ci_authority: false,
    description: 'Skip signer registry integrity check locally',
  },
  TEST_FLOOR_DISABLED: {
    classification: 'ux-local-only',
    ci_authority: false,
    description: 'Disable test-floor classifier (rollback no-op)',
  },
  DOC_COVERAGE_GATE_ADVISORY: {
    classification: 'ux-local-only',
    ci_authority: false,
    description: 'Downgrade doc-coverage gate to advisory locally',
  },
  // -- Opt-in enablers (default-OFF; enable a dark-launched feature; not a bypass) --
  MEGINGJORD_MCP_ADAPTER_ENABLED: {
    classification: 'opt-in-enabler',
    ci_authority: false,
    description: 'Opt in to the HAMR MCP adapter (default-OFF, fail-closed). '
      + 'Narrow, adapter-scoped; orthogonal to the global MEGINGJORD_HAMR_DISABLED '
      + 'kill-switch (audit C-8, Epic #3789).',
  },
  // -- Authority-affecting flags (CI authority REMOVED) --
  SKIP_CLOSEOUT_PREFLIGHT: {
    classification: 'authority-affecting',
    ci_authority: false,
    description: 'Was: skip closeout preflight. Now: local-only; CI ignores',
  },
  PUSH_GATES_BYPASS: {
    classification: 'authority-affecting',
    ci_authority: false,
    description: 'Was: bypass push gates. Now: local-only; CI ignores',
  },
  PHASE0_GATE_BYPASS: {
    classification: 'authority-affecting',
    ci_authority: false,
    description: 'Was: downgrade phase0 gate. Now: requires label + approver',
  },
  SKIP_DRIFT_LINT: {
    classification: 'authority-affecting',
    ci_authority: false,
    description: 'Was: skip drift lint. Now: local-only; CI ignores',
  },
  PRE_COMMIT_DOCS_BYPASS: {
    classification: 'authority-affecting',
    ci_authority: false,
    description: 'Was: bypass pre-commit docs check. Now: local-only',
  },
  MEGINGJORD_REVIEW_BYPASS_BLOCK: {
    classification: 'authority-affecting',
    ci_authority: false,
    description: 'Review bypass block; must use label + approver path',
  },
  MEGINGJORD_PLANNING_CONSENSUS_OVERRIDE: {
    classification: 'authority-affecting',
    ci_authority: false,
    description: 'Was: override planning consensus. Now: requires label',
  },
};

/**
 * Classify a single env flag by name.
 * @param {string} name - The env var name to classify.
 * @returns {{name, classification, ci_authority, description, known}|{name, known:false}}
 */
function classifyFlag(name) {
  const entry = BYPASS_FLAG_REGISTRY[name];
  if (!entry) {
    return { name, known: false };
  }
  return {
    name,
    known: true,
    classification: entry.classification,
    ci_authority: entry.ci_authority,
    description: entry.description,
  };
}

/**
 * Return all flags of a given classification.
 * @param {string} classification - 'ux-local-only' or 'authority-affecting'.
 * @returns {string[]} List of flag names matching.
 */
function flagsByClassification(classification) {
  return Object.keys(BYPASS_FLAG_REGISTRY).filter(
    function matchClass(key) {
      return BYPASS_FLAG_REGISTRY[key].classification === classification;
    }
  );
}

module.exports = { classifyFlag, flagsByClassification, BYPASS_FLAG_REGISTRY };
