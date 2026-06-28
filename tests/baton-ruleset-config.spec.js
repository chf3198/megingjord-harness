// baton-ruleset-config.spec.js -- Tests for ruleset config and apply-ruleset.
// Asserts AC2: both checks required on main, bypass_actors empty except
// documented break-glass, apply-ruleset dry-run prints without mutating.
// Refs #3290, Epic #3284.
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { buildRulesetConfig, validateRulesetConfig, RULESET_NAME, BREAK_GLASS_ACTOR } = require('../scripts/global/baton-authority/ruleset-config');
const { main, formatDryRun, buildApiUrl } = require('../scripts/global/baton-authority/apply-ruleset');

describe('Ruleset config - required status checks (AC2)', () => {
  it('requires baton-authority/merge check on main', () => {
    const config = buildRulesetConfig();
    const statusRule = config.rules.find(
      (rule) => rule.type === 'required_status_checks'
    );
    assert.ok(statusRule, 'must have required_status_checks rule');
    const contexts = statusRule.parameters.required_status_checks.map(
      (chk) => chk.context
    );
    assert.ok(
      contexts.includes('baton-authority/merge'),
      'must require baton-authority/merge check'
    );
  });

  it('requires baton-fsm-conformance check on main', () => {
    const config = buildRulesetConfig();
    const statusRule = config.rules.find(
      (rule) => rule.type === 'required_status_checks'
    );
    const contexts = statusRule.parameters.required_status_checks.map(
      (chk) => chk.context
    );
    assert.ok(
      contexts.includes('baton-fsm-conformance'),
      'must require baton-fsm-conformance check'
    );
  });
});

describe('Ruleset config - enforcement on admins (AC2)', () => {
  it('has enforcement set to active', () => {
    const config = buildRulesetConfig();
    assert.equal(config.enforcement, 'active');
  });

  it('bypass_actors contains only the documented break-glass entry', () => {
    const config = buildRulesetConfig();
    assert.equal(config.bypass_actors.length, 1, 'exactly one bypass actor');
    const actor = config.bypass_actors[0];
    assert.ok(
      actor.description.includes('break-glass'),
      'bypass actor must be documented break-glass'
    );
  });

  it('no undocumented bypass actors', () => {
    const config = buildRulesetConfig();
    const nonBreakGlass = config.bypass_actors.filter(
      (actor) => !actor.description || !actor.description.includes('break-glass')
    );
    assert.equal(nonBreakGlass.length, 0, 'no undocumented bypass actors');
  });
});

describe('Ruleset config - targets main branch', () => {
  it('conditions include refs/heads/main', () => {
    const config = buildRulesetConfig();
    assert.ok(
      config.conditions.ref_name.include.includes('refs/heads/main'),
      'must target main'
    );
  });
});

describe('Ruleset config - non_fast_forward rule', () => {
  it('includes non_fast_forward rule', () => {
    const config = buildRulesetConfig();
    const nffRule = config.rules.find(
      (rule) => rule.type === 'non_fast_forward'
    );
    assert.ok(nffRule, 'must have non_fast_forward rule');
  });
});

describe('Ruleset config - validator', () => {
  it('validates a correct config', () => {
    const config = buildRulesetConfig();
    const result = validateRulesetConfig(config);
    assert.equal(result.valid, true, 'built config should be valid');
    assert.equal(result.violations.length, 0);
  });

  it('rejects config with missing status checks', () => {
    const config = buildRulesetConfig();
    config.rules = [{ type: 'non_fast_forward' }];
    const result = validateRulesetConfig(config);
    assert.equal(result.valid, false);
    assert.ok(result.violations.includes('missing-required-status-checks-rule'));
  });

  it('rejects config with undocumented bypass actors', () => {
    const config = buildRulesetConfig();
    config.bypass_actors.push({ actor_id: 999, actor_type: 'User', bypass_mode: 'always' });
    const result = validateRulesetConfig(config);
    assert.equal(result.valid, false);
    assert.ok(
      result.violations.some((violation) => violation.includes('undocumented-bypass-actors'))
    );
  });

  it('rejects null config', () => {
    const result = validateRulesetConfig(null);
    assert.equal(result.valid, false);
  });
});

describe('apply-ruleset dry-run (AC2)', () => {
  it('dry-run prints API call without mutating', () => {
    const result = main([]);
    assert.equal(result.action, 'dry-run');
    assert.ok(result.config, 'should include config');
    assert.ok(result.output.includes('DRY RUN'), 'output should say DRY RUN');
    assert.ok(result.output.includes('baton-authority/merge'), 'should mention the check');
    assert.ok(result.output.includes('baton-fsm-conformance'), 'should mention conformance check');
  });

  it('apply mode prints instructions without executing', () => {
    const result = main(['--apply']);
    assert.equal(result.action, 'apply-instructions');
    assert.ok(result.cmd.includes('gh api'), 'should print gh api command');
  });
});

describe('buildApiUrl', () => {
  it('builds correct base URL', () => {
    const url = buildApiUrl();
    assert.ok(url.includes('chf3198/devenv-ops/rulesets'));
  });

  it('appends ruleset ID when provided', () => {
    const url = buildApiUrl(123);
    assert.ok(url.endsWith('/123'));
  });
});
