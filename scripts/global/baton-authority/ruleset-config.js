// ruleset-config.js -- GitHub repository ruleset config-as-code.
// Exports the ruleset JSON that requires the baton-authority/merge check on
// main. Refs #3315, #3290, Epic #3284.
// AC2: empty bypass list with active admin enforcement (stricter than a named
// break-glass actor). Break-glass is handled at the WORKFLOW level via the
// `merge-bypass:admin-exception` label, which makes the merge gate pass -- so
// no ruleset bypass actor (and no meaningless placeholder actor_id) is needed.
'use strict';

const OWNER = 'chf3198';
// Canonical repo slug (rebranded from `devenv-ops` -> `megingjord-harness`).
// This is the FALLBACK only: apply-ruleset resolves the live slug at runtime via
// `gh repo view` so a future rename cannot re-break live apply (the #3315 AC3
// 307-on-POST regression: gh follows the rename redirect for GET, not POST).
const REPO = 'megingjord-harness';
const RULESET_NAME = 'baton-authority-merge-gate';

// Status-check contexts that are actually reported, unconditionally, on every
// PR to main. A required context MUST be in this allowlist: requiring a context
// that no workflow reports leaves PRs stuck "Expected -- waiting for status"
// (the #3290/#3315 bricking root cause). `baton-authority/merge` qualifies --
// its job runs on `pull_request: branches:[main]` with no path filter and
// always completes (the "Skip -- no linked issue" step still finishes green).
// `baton-fsm-conformance` is intentionally absent: its job is
// `fsm-conformance-advisory` (continue-on-error + paths-filtered), so the
// context is never reported. It joins this list only when promoted to blocking
// via the #3288 replay-eval gate (precision >= 0.85, auto-revoking).
const KNOWN_REPORTING_CONTEXTS = Object.freeze(['baton-authority/merge']);

/**
 * Build the GitHub repository ruleset configuration object.
 */
function buildRulesetConfig() {
  return {
    name: RULESET_NAME,
    target: 'branch',
    enforcement: 'active',
    conditions: {
      ref_name: {
        include: ['refs/heads/main'],
        exclude: [],
      },
    },
    // Empty -- admins are enforced too. Break-glass is the
    // merge-bypass:admin-exception label honored by the merge workflow.
    bypass_actors: [],
    rules: [
      {
        type: 'required_status_checks',
        parameters: {
          strict_required_status_checks_policy: true,
          // `integration_id` is intentionally OMITTED: the GitHub Rulesets API
          // rejects `integration_id: null` (HTTP 422 "data matches no possible
          // input"). It is only needed to disambiguate a context reported by a
          // specific GitHub App; `baton-authority/merge` is an Actions check, so
          // context alone is the correct, API-valid shape.
          required_status_checks: [
            {
              context: 'baton-authority/merge',
            },
          ],
        },
      },
      {
        type: 'non_fast_forward',
      },
    ],
  };
}

/**
 * Validate a ruleset config against required invariants.
 * Returns { valid, violations[] }.
 */
function validateRulesetConfig(config) {
  const violations = [];
  if (!config || typeof config !== 'object') {
    return { valid: false, violations: ['config-not-an-object'] };
  }
  if (config.enforcement !== 'active') {
    violations.push('enforcement-not-active');
  }
  const statusRule = (config.rules || []).find(
    (rule) => rule.type === 'required_status_checks'
  );
  if (!statusRule) {
    violations.push('missing-required-status-checks-rule');
  } else {
    const checks = statusRule.parameters?.required_status_checks || [];
    const contexts = checks.map((chk) => chk.context);
    if (!contexts.includes('baton-authority/merge')) {
      violations.push('missing-baton-authority-merge-check');
    }
    // Anti-recurrence: every required context must actually be reported.
    for (const ctx of contexts) {
      if (!KNOWN_REPORTING_CONTEXTS.includes(ctx)) {
        violations.push('unreportable-required-context: ' + ctx);
      }
    }
  }
  const nffRule = (config.rules || []).find(
    (rule) => rule.type === 'non_fast_forward'
  );
  if (!nffRule) {
    violations.push('missing-non-fast-forward-rule');
  }
  // Bypass actors must be empty (preferred) or documented break-glass entries.
  const bypassActors = config.bypass_actors || [];
  const nonBreakGlass = bypassActors.filter(
    (actor) => !actor.description || !actor.description.includes('break-glass')
  );
  if (nonBreakGlass.length !== 0) {
    violations.push('undocumented-bypass-actors: ' + nonBreakGlass.length);
  }
  const included = config.conditions?.ref_name?.include || [];
  if (!included.includes('refs/heads/main')) {
    violations.push('does-not-target-main');
  }
  return { valid: violations.length === 0, violations };
}

module.exports = {
  buildRulesetConfig,
  validateRulesetConfig,
  RULESET_NAME,
  KNOWN_REPORTING_CONTEXTS,
  OWNER,
  REPO,
};
