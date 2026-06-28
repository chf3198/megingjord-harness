// baton-fsm-loader-contract.spec.js — Tests for evidence-loader contract checker.
// Asserts compliant loader passes and broken loader fails on each property.
// Refs #3289, Epic #3284.
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  verifyLoaderContract,
  buildCompliantLoader,
  buildBrokenLoader,
} = require('../scripts/global/baton-fsm/verify/evidence-loader-contract');

// ---- Compliant loader ----

describe('compliant evidence loader', () => {
  const loader = buildCompliantLoader();
  const result = verifyLoaderContract(loader);

  it('passes all three contract properties', () => {
    assert.equal(result.pass, true,
      'Compliant loader should pass; violations: ' +
      JSON.stringify(result.violations, null, 2));
  });

  it('has zero violations', () => {
    assert.equal(result.violations.length, 0);
  });
});

// ---- Broken loader ----

describe('broken evidence loader', () => {
  const loader = buildBrokenLoader();
  const result = verifyLoaderContract(loader);

  it('fails the contract', () => {
    assert.equal(result.pass, false,
      'Broken loader should fail the contract');
  });

  it('detects TOTALITY violation', () => {
    const totalityViolations = result.violations.filter(
      violation => violation.property === 'TOTALITY'
    );
    assert.ok(totalityViolations.length > 0,
      'Should detect at least one TOTALITY violation');
    // The first transition returns undefined
    assert.ok(
      totalityViolations.some(
        violation => violation.detail.reason === 'returned undefined'
      ),
      'Should report undefined return'
    );
  });

  it('detects DETERMINISM violation', () => {
    const determinismViolations = result.violations.filter(
      violation => violation.property === 'DETERMINISM'
    );
    assert.ok(determinismViolations.length > 0,
      'Should detect at least one DETERMINISM violation');
  });

  it('detects NO-PARTIAL-EVIDENCE violation', () => {
    const partialViolations = result.violations.filter(
      violation => violation.property === 'NO-PARTIAL-EVIDENCE'
    );
    assert.ok(partialViolations.length > 0,
      'Should detect at least one NO-PARTIAL-EVIDENCE violation');
    // The broken loader omits the signer field
    assert.ok(
      partialViolations.some(
        violation => violation.detail.missingField === 'signer'
      ),
      'Should detect missing signer field'
    );
  });
});

// ---- Edge cases ----

describe('evidence-loader contract edge cases', () => {
  it('loader returning null for all inputs passes (explicit absence)', () => {
    const nullLoader = () => null;
    const result = verifyLoaderContract(nullLoader);
    // null is explicit absence — totality is satisfied (defined return),
    // determinism is satisfied (same null each time),
    // no-partial-evidence is satisfied (null is not partial).
    assert.equal(result.pass, true,
      'Null-returning loader should pass; violations: ' +
      JSON.stringify(result.violations));
  });

  it('loader that throws fails TOTALITY', () => {
    const throwingLoader = () => { throw new Error('boom'); };
    const result = verifyLoaderContract(throwingLoader);
    assert.equal(result.pass, false);
    const totalityViolations = result.violations.filter(
      violation => violation.property === 'TOTALITY'
    );
    assert.ok(totalityViolations.length > 0,
      'Throwing loader should fail TOTALITY');
  });

  it('loader returning non-object non-null fails NO-PARTIAL-EVIDENCE', () => {
    const stringLoader = () => 'not-an-object';
    const result = verifyLoaderContract(stringLoader);
    assert.equal(result.pass, false);
    const partialViolations = result.violations.filter(
      violation => violation.property === 'NO-PARTIAL-EVIDENCE'
    );
    assert.ok(partialViolations.length > 0,
      'String-returning loader should fail NO-PARTIAL-EVIDENCE');
  });
});
