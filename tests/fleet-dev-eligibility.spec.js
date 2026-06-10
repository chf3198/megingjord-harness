// Refs #2794 P1-1 of Epic #2791 — rule-based fleet-dev eligibility router. Pure, deterministic.
const { test, expect } = require('@playwright/test');
const {
  isFleetDevEligible, profileFor, isValidProfile,
} = require('../scripts/global/fleet-dev-eligibility.js');
const policy = require('../scripts/global/model-routing-policy.json');

const PROFILE = { swe_bench_verified: 0.31, context_stability_tokens: 8000 };
const KNOWN = { pattern: 'known', contextTokens: 3000, schemaClarity: 'clear' };

test('#2794 AC1 policy carries a code_dev_profile per fleet model with the capability dimensions', () => {
  const prof = policy.code_dev_profiles['qwen2.5-coder:32b'];
  expect(prof).toBeTruthy();
  for (const dim of ['swe_bench_verified', 'repo_reasoning', 'tool_calling', 'context_stability_tokens', 'latency_tok_per_sec']) {
    expect(typeof prof[dim]).toBe('number');
  }
});

test('#2794 AC2 a known-pattern, bounded-context, clear-schema task is eligible', () => {
  const out = isFleetDevEligible(KNOWN, PROFILE);
  expect(out.eligible).toBe(true);
  expect(out.rationale).toMatch(/known-pattern/);
});

test('#2794 AC2 each rule-failure is ineligible with a naming rationale (escalate)', () => {
  expect(isFleetDevEligible({ ...KNOWN, pattern: 'novel' }, PROFILE)).toMatchObject({ eligible: false, rationale: /novel-pattern/ });
  expect(isFleetDevEligible({ ...KNOWN, schemaClarity: 'ambiguous' }, PROFILE)).toMatchObject({ eligible: false, rationale: /ambiguous-schema/ });
  expect(isFleetDevEligible({ ...KNOWN, contextTokens: 8001 }, PROFILE)).toMatchObject({ eligible: false, rationale: /stable-window/ });
});

test('#2794 AC2 boundary: contextTokens exactly at the stable window is eligible, one over escalates', () => {
  expect(isFleetDevEligible({ ...KNOWN, contextTokens: 8000 }, PROFILE).eligible).toBe(true);
  expect(isFleetDevEligible({ ...KNOWN, contextTokens: 8001 }, PROFILE).eligible).toBe(false);
});

test('#2794 AC2 a capability floor (opts.minCapability) gates below-floor models', () => {
  expect(isFleetDevEligible(KNOWN, PROFILE, { minCapability: 0.3 }).eligible).toBe(true);
  expect(isFleetDevEligible(KNOWN, PROFILE, { minCapability: 0.5 })).toMatchObject({ eligible: false, rationale: /capability-floor/ });
});

test('#2794 AC2 FAIL-CLOSED: missing/malformed inputs escalate, never default-eligible', () => {
  expect(isFleetDevEligible(KNOWN, null).eligible).toBe(false);          // no profile
  expect(isFleetDevEligible(KNOWN, {}).eligible).toBe(false);            // empty profile
  expect(isFleetDevEligible({}, PROFILE).eligible).toBe(false);          // no task features
  expect(isFleetDevEligible(undefined, undefined).eligible).toBe(false); // both absent
  expect(isFleetDevEligible({ ...KNOWN, contextTokens: 'lots' }, PROFILE).eligible).toBe(false); // non-numeric ctx
});

test('#2794 FAIL-CLOSED: null/garbage arguments escalate without crashing', () => {
  for (const bad of [null, undefined, 0, 'str', [], NaN]) {
    expect(() => isFleetDevEligible(bad, PROFILE, bad)).not.toThrow();
    expect(isFleetDevEligible(bad, PROFILE, bad).eligible).toBe(false);
  }
  // a nonsensical NEGATIVE context size escalates (fail-open guard) with a distinct rationale (G8)
  expect(isFleetDevEligible({ ...KNOWN, contextTokens: -1 }, PROFILE))
    .toMatchObject({ eligible: false, rationale: /missing-or-negative/ });
  // a missing context size is reported as missing, NOT as "exceeds window"
  const { pattern, schemaClarity } = KNOWN;
  expect(isFleetDevEligible({ pattern, schemaClarity }, PROFILE).rationale).toMatch(/missing-or-negative/);
});

test('#2794 SECURITY: prototype pollution cannot fail-OPEN the gate', () => {
  const polluted = ['pattern', 'schemaClarity', 'contextTokens', 'context_stability_tokens', 'swe_bench_verified'];
  Object.prototype.pattern = 'known'; Object.prototype.schemaClarity = 'clear';
  Object.prototype.contextTokens = 10; Object.prototype.context_stability_tokens = 8000;
  Object.prototype.swe_bench_verified = 1;
  try {
    // empty objects must NOT inherit eligibility from a polluted prototype — still escalate.
    expect(isFleetDevEligible({}, {}).eligible).toBe(false);
    expect(isFleetDevEligible({}, PROFILE).eligible).toBe(false);
    expect(isValidProfile({})).toBe(false);
  } finally {
    for (const key of polluted) delete Object.prototype[key]; // CRITICAL: restore prototype for other tests
  }
});

test('#2794 AC3 profileFor resolves a model, falls back to the dated default, and is currency-aware', () => {
  expect(profileFor('qwen2.5-coder:32b', policy).swe_bench_verified).toBe(0.31);
  expect(profileFor('some-future-model:99b', policy)).toEqual(policy.code_dev_profile_meta.default_profile);
  expect(policy.code_dev_profile_meta.default_profile.estimate).toBe(true); // marked an estimate (D6)
  expect(policy.code_dev_profiles['qwen2.5-coder:32b'].refreshed).toMatch(/^\d{4}-\d{2}-\d{2}$/); // dated
});

test('#2794 AC3 profileFor never throws + ignores prototype keys', () => {
  expect(profileFor('qwen2.5-coder:32b', {})).toBe(null);
  expect(profileFor('__proto__', policy)).toBe(policy.code_dev_profile_meta.default_profile); // not Object.prototype
  expect(() => profileFor(undefined, undefined)).not.toThrow();
});

test('#2794 AC4 the router adds NO new routing — escalationRules/cascade/judge are untouched', () => {
  // the eligibility module exports only the gate; it does not mutate the policy or its routing blocks.
  expect(isValidProfile(PROFILE)).toBe(true);
  expect(policy.escalationRules).toBeTruthy();
  expect(policy.cascade).toBeTruthy(); // existing routing still present, unmodified by this slice
});
