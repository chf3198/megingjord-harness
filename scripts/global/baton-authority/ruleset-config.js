// ruleset-config.js -- GitHub repository ruleset config-as-code.
// Exports the ruleset JSON that requires baton-authority/merge and
// baton-fsm-conformance checks on main. Refs #3290, Epic #3284.
// AC2: enforced on admins with empty bypass except break-glass.
'use strict';

const OWNER = 'chf3198';
const REPO = 'devenv-ops';
const RULESET_NAME = 'baton-authority-merge-gate';

// The break-glass actor: a deploy-key or machine user that can
// bypass in genuine emergencies. Documented for audit trail.
// actor_id 0 = placeholder; replace with real deploy-key ID.
const BREAK_GLASS_ACTOR = Object.freeze({
  actor_id: 0,
  actor_type: 'RepositoryRole',
  bypass_mode: 'always',
  description: 'break-glass: deploy-key for genuine emergencies only',
});

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
    bypass_actors: [BREAK_GLASS_ACTOR],
    rules: [
      {
        type: 'required_status_checks',
        parameters: {
          strict_required_status_checks_policy: true,
          required_status_checks: [
            {
              context: 'baton-authority/merge',
              integration_id: null,
            },
            {
              context: 'baton-fsm-conformance',
              integration_id: null,
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
    if (!contexts.includes('baton-fsm-conformance')) {
      violations.push('missing-baton-fsm-conformance-check');
    }
  }
  const nffRule = (config.rules || []).find(
    (rule) => rule.type === 'non_fast_forward'
  );
  if (!nffRule) {
    violations.push('missing-non-fast-forward-rule');
  }
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
  BREAK_GLASS_ACTOR,
  OWNER,
  REPO,
};
