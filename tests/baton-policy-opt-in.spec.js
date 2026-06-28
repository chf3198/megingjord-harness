// baton-policy-opt-in.spec.js — Tests for default-path and sidecar opt-in.
// Asserts AC3: default path uses no sidecar/opa.
// Refs #3286, Epic #3284.
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');

const { evaluate, POLICY_VERSION, OPT_IN_SIDECAR } = require('../scripts/global/baton-fsm-policy');
const { sidecarParity, opaAvailable, REGO_PATH } = require('../scripts/global/baton-fsm-policy/opa-sidecar');
const { STATES, EVENTS, EVIDENCE_BITS } = require('../scripts/global/baton-fsm/transitions');

describe('default path uses no sidecar (AC3)', () => {
  it('evaluate without opts.sidecar returns js-policy-substrate engine', () => {
    const result = evaluate(STATES.BACKLOG, EVENTS.PICKUP_MANAGER, 0);
    assert.equal(result.engine, 'js-policy-substrate');
    assert.equal(result.sidecar_advisory, undefined);
  });

  it('evaluate with opts.sidecar=false returns js-policy-substrate engine', () => {
    const result = evaluate(STATES.TRIAGE, EVENTS.MANAGER_HANDOFF, EVIDENCE_BITS.MANAGER_HANDOFF, { sidecar: false });
    assert.equal(result.engine, 'js-policy-substrate');
    assert.equal(result.sidecar_advisory, undefined);
  });

  it('evaluate returns decision_log and policy_version', () => {
    const result = evaluate(STATES.BACKLOG, EVENTS.PICKUP_MANAGER, 0);
    assert.ok(Array.isArray(result.decision_log));
    assert.ok(result.decision_log.length !== 0);
    assert.equal(result.policy_version, POLICY_VERSION);
  });

  it('evaluate accepts string state and event names', () => {
    const result = evaluate('backlog', 'PICKUP_MANAGER', 0);
    assert.equal(result.decision, 'allow');
    assert.equal(result.engine, 'js-policy-substrate');
  });

  it('evaluate returns deny for invalid state', () => {
    const result = evaluate('nonexistent', 'PICKUP_MANAGER', 0);
    assert.equal(result.decision, 'deny');
    assert.equal(result.reason, 'invalid-input');
  });

  it('OPT_IN_SIDECAR constant is exported and describes opt-in', () => {
    assert.ok(typeof OPT_IN_SIDECAR === 'string');
    assert.ok(OPT_IN_SIDECAR.includes('sidecar'));
  });
});

describe('sidecar opt-in with opa absent', () => {
  it('evaluate with sidecar=true and opa absent falls back with advisory', () => {
    // On this machine opa is not installed
    if (opaAvailable()) {
      // If opa IS available, skip this test (different assertion needed)
      return;
    }
    const result = evaluate(STATES.BACKLOG, EVENTS.PICKUP_MANAGER, 0, { sidecar: true });
    assert.equal(result.engine, 'js-policy-substrate');
    assert.ok(typeof result.sidecar_advisory === 'string');
    assert.ok(result.sidecar_advisory.includes('opa-toolchain-absent'));
    assert.equal(result.decision, 'allow');
  });

  it('sidecarParity returns pending-toolchain when opa absent', () => {
    if (opaAvailable()) return;
    const cases = [
      { state: STATES.BACKLOG, event: EVENTS.PICKUP_MANAGER, evidence_mask: 0 },
      { state: STATES.TRIAGE, event: EVENTS.MANAGER_HANDOFF, evidence_mask: EVIDENCE_BITS.MANAGER_HANDOFF },
    ];
    const result = sidecarParity(cases);
    assert.equal(result.status, 'pending-toolchain');
    assert.equal(result.checked, 0);
    assert.ok(Array.isArray(result.mismatches));
    assert.equal(result.mismatches.length, 0);
  });

  it('sidecarParity reports rego file exists and is non-empty', () => {
    if (opaAvailable()) return;
    const cases = [{ state: STATES.BACKLOG, event: EVENTS.PICKUP_MANAGER, evidence_mask: 0 }];
    const result = sidecarParity(cases);
    assert.equal(result.status, 'pending-toolchain');
    assert.equal(result.rego_file_exists, true);
    assert.equal(result.rego_file_non_empty, true);
  });

  it('rego file exists on disk and is non-empty', () => {
    assert.ok(existsSync(REGO_PATH), 'baton-policy.rego must exist');
    const content = readFileSync(REGO_PATH, 'utf8');
    assert.ok(Boolean(content.trim().length), 'baton-policy.rego must be non-empty');
  });
});
