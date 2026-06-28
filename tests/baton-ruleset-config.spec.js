// baton-ruleset-config.spec.js -- Tests for ruleset config and apply-ruleset.
// Asserts the #3315 non-bricking contract: only baton-authority/merge is
// required (a context that is actually reported), bypass_actors is empty with
// active enforcement, the validator rejects unreportable required contexts, and
// --apply performs an idempotent POST/PUT (create vs update-by-name).
// Refs #3315, #3290, Epic #3284.
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  buildRulesetConfig,
  validateRulesetConfig,
  KNOWN_REPORTING_CONTEXTS,
  RULESET_NAME,
} = require('../scripts/global/baton-authority/ruleset-config');
const {
  main,
  formatDryRun,
  buildApiUrl,
  findExistingRulesetId,
  applyRuleset,
} = require('../scripts/global/baton-authority/apply-ruleset');

describe('Ruleset config - required status checks (AC1)', () => {
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

  it('does NOT require baton-fsm-conformance (never-reported context)', () => {
    const config = buildRulesetConfig();
    const statusRule = config.rules.find(
      (rule) => rule.type === 'required_status_checks'
    );
    const contexts = statusRule.parameters.required_status_checks.map(
      (chk) => chk.context
    );
    assert.ok(
      !contexts.includes('baton-fsm-conformance'),
      'must not require the never-reported conformance context'
    );
  });

  it('every required context is in the known-reporting allowlist', () => {
    const config = buildRulesetConfig();
    const statusRule = config.rules.find(
      (rule) => rule.type === 'required_status_checks'
    );
    for (const chk of statusRule.parameters.required_status_checks) {
      assert.ok(
        KNOWN_REPORTING_CONTEXTS.includes(chk.context),
        chk.context + ' must be a known-reporting context'
      );
    }
  });
});

describe('Ruleset config - bypass + enforcement (AC2)', () => {
  it('has enforcement set to active', () => {
    const config = buildRulesetConfig();
    assert.equal(config.enforcement, 'active');
  });

  it('bypass_actors is empty (admins enforced; no placeholder actor)', () => {
    const config = buildRulesetConfig();
    assert.equal(config.bypass_actors.length, 0, 'bypass list must be empty');
  });

  it('contains no placeholder actor_id:0 entry', () => {
    const config = buildRulesetConfig();
    const placeholder = config.bypass_actors.find((a) => a.actor_id === 0);
    assert.equal(placeholder, undefined, 'no placeholder actor_id:0');
  });
});

describe('Ruleset config - targets main + non_fast_forward', () => {
  it('conditions include refs/heads/main', () => {
    const config = buildRulesetConfig();
    assert.ok(
      config.conditions.ref_name.include.includes('refs/heads/main'),
      'must target main'
    );
  });

  it('includes non_fast_forward rule', () => {
    const config = buildRulesetConfig();
    const nffRule = config.rules.find((rule) => rule.type === 'non_fast_forward');
    assert.ok(nffRule, 'must have non_fast_forward rule');
  });
});

describe('Ruleset config - validator', () => {
  it('validates the built config', () => {
    const result = validateRulesetConfig(buildRulesetConfig());
    assert.equal(result.valid, true, 'built config should be valid');
    assert.equal(result.violations.length, 0);
  });

  it('rejects an unreportable required context (anti-recurrence)', () => {
    const config = buildRulesetConfig();
    config.rules
      .find((r) => r.type === 'required_status_checks')
      .parameters.required_status_checks.push({
        context: 'baton-fsm-conformance',
        integration_id: null,
      });
    const result = validateRulesetConfig(config);
    assert.equal(result.valid, false);
    assert.ok(
      result.violations.some((v) =>
        v.includes('unreportable-required-context: baton-fsm-conformance')
      )
    );
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
      result.violations.some((v) => v.includes('undocumented-bypass-actors'))
    );
  });

  it('rejects null config', () => {
    assert.equal(validateRulesetConfig(null).valid, false);
  });
});

describe('apply-ruleset dry-run', () => {
  it('dry-run prints API call without mutating', () => {
    const result = main([]);
    assert.equal(result.action, 'dry-run');
    assert.ok(result.config, 'should include config');
    assert.ok(result.output.includes('DRY RUN'), 'output should say DRY RUN');
    assert.ok(
      result.output.includes('baton-authority/merge'),
      'should mention the required check'
    );
    assert.ok(
      !result.output.includes('baton-fsm-conformance'),
      'should not mention the dropped conformance check'
    );
  });
});

describe('apply-ruleset --apply idempotency (AC3)', () => {
  it('POSTs (creates) when no ruleset of that name exists', () => {
    const calls = [];
    const runGh = (args, input) => {
      calls.push({ args, input });
      if (args[1] === 'api' && args.length === 2) return '[]';
      if (args.includes('-X')) return JSON.stringify({ id: 42, name: RULESET_NAME });
      return '[]';
    };
    // first call is the list lookup: args = ['api', '<path>']
    const result = main(['--apply'], { runGh });
    assert.equal(result.action, 'applied');
    assert.equal(result.method, 'POST');
    assert.equal(result.id, 42);
    const mutate = calls.find((c) => c.args.includes('-X'));
    assert.ok(mutate.args.includes('POST'), 'must POST to create');
  });

  it('PUTs (updates) idempotently when a ruleset of that name exists', () => {
    const existing = JSON.stringify([{ id: 7, name: RULESET_NAME }]);
    const runGh = (args) => {
      if (args.length === 2 && args[0] === 'api') return existing;
      if (args.includes('-X')) return JSON.stringify({ id: 7, name: RULESET_NAME });
      return existing;
    };
    const result = main(['--apply'], { runGh });
    assert.equal(result.method, 'PUT');
    assert.equal(result.id, 7);
    assert.ok(result.path.endsWith('/7'), 'PUT path targets existing id');
  });

  it('findExistingRulesetId is fail-soft on gh error (offline)', () => {
    const runGh = () => { throw new Error('gh not found'); };
    assert.equal(findExistingRulesetId(runGh), null);
  });

  it('applyRuleset keeps the discovered id when the gh response is not JSON', () => {
    // cross-family finding #1/#3: cover the non-JSON / unexpected gh response.
    const runGh = (args) => {
      if (args.length === 2) return JSON.stringify([{ id: 5, name: RULESET_NAME }]);
      return 'not-json-output'; // PUT response is garbage
    };
    const result = applyRuleset(buildRulesetConfig(), runGh);
    assert.equal(result.method, 'PUT');
    assert.equal(result.id, 5, 'falls back to the discovered id, no crash');
  });

  it('applyRuleset sends the full config as JSON body', () => {
    let sentBody = null;
    const runGh = (args, input) => {
      if (args.length === 2) return '[]';
      sentBody = input;
      return JSON.stringify({ id: 1 });
    };
    applyRuleset(buildRulesetConfig(), runGh);
    const parsed = JSON.parse(sentBody);
    assert.equal(parsed.name, RULESET_NAME);
    assert.equal(parsed.enforcement, 'active');
  });
});

describe('buildApiUrl', () => {
  it('builds correct base URL', () => {
    assert.ok(buildApiUrl().includes('chf3198/devenv-ops/rulesets'));
  });

  it('appends ruleset ID when provided', () => {
    assert.ok(buildApiUrl(123).endsWith('/123'));
  });
});
