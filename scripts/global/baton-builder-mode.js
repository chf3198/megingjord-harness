'use strict';
// Builder-as-default promotion state (Epic #2037 P1.5, Refs #2675). The programmatic
// builders ship OPT-IN: the legacy hand/template path stays default until the
// replay-eval gate (>=0.85, baton-replay-eval.js) is met over the full historical
// corpus. One env flag is the opt-in switch now, and becomes the ROLLBACK switch
// (set to 0) after promotion — so promotion is a doc/default change, not a code change.
const DEFAULT_ENV = 'MEGINGJORD_BATON_BUILDER_DEFAULT';
const TRUTHY = new Set(['1', 'true', 'on', 'yes']);

// true  => use the programmatic builder as the default artifact path
// false => legacy path (advisory default until replay-eval promotion)
function isBuilderDefault(env = process.env) {
  return TRUTHY.has(String(env[DEFAULT_ENV] || '').trim().toLowerCase());
}

// Observable promotion state for /quota-style introspection + closeout evidence.
function promotionState(env = process.env) {
  return {
    envFlag: DEFAULT_ENV,
    builderDefault: isBuilderDefault(env),
    gate: 'replay-eval >= 0.85 (no calendar threshold, per #1771/#1875)',
  };
}

module.exports = { isBuilderDefault, promotionState, DEFAULT_ENV };
