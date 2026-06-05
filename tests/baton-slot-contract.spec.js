// Unit tests for the irreducible-3 slot contract (Epic #2037 P1.3, Refs #2673).
// Uses @playwright/test to run in the quality-gates deterministic unit-test list.
// Covers: deterministic structured render, only-the-named-slot-is-free-text,
// narrative-leak rejection, unknown-field rejection, anneal decision enum, and
// byte-identical determinism of the structured portion.
const { test, expect } = require('@playwright/test');
const {
  SLOT_CONTRACTS, ANNEAL_DECISIONS, getContract,
  renderStructured, validateSlotContract, renderWithSlot,
} = require('../scripts/global/baton-slot-contract');

test('exactly three irreducible cases, one slot each', () => {
  expect(Object.keys(SLOT_CONTRACTS).sort()).toEqual(
    ['ANNEAL_DECISION', 'CONSULTANT_EPIC_CLOSEOUT', 'PER_AC_VERIFICATION'],
  );
  for (const name of Object.keys(SLOT_CONTRACTS)) {
    expect(typeof getContract(name).slot).toBe('string');
  }
});

test('structured render is deterministic and slot-free', () => {
  const fields = { ac_id: 'AC1', verdict: 'PASS', narrative: 'ran the spec, all green' };
  const once = renderStructured('PER_AC_VERIFICATION', fields);
  expect(once).toBe('ac_id: AC1\nverdict: PASS');
  expect(once).toBe(renderStructured('PER_AC_VERIFICATION', fields)); // byte-identical
});

test('renderWithSlot composes structured block + the single free-text slot', () => {
  const out = renderWithSlot('PER_AC_VERIFICATION', { ac_id: 'AC1', verdict: 'PASS', narrative: 'multi\nline\nprose' });
  expect(out).toBe('ac_id: AC1\nverdict: PASS\n\nnarrative:\nmulti\nline\nprose\n');
});

test('narrative leaking into a structured field is rejected', () => {
  const result = validateSlotContract('PER_AC_VERIFICATION', { ac_id: 'AC1\nsmuggled prose', verdict: 'PASS', narrative: 'x' });
  expect(result.ok).toBe(false);
  expect(result.violations.join(';')).toMatch(/must be single-line/);
});

test('unknown field (not structured, not slot) is rejected', () => {
  const result = validateSlotContract('ANNEAL_DECISION', { flaw: 'f', decision: 'file-ticket', artifact: '#9', rationale: 'r', extra: 'nope' });
  expect(result.ok).toBe(false);
  expect(result.violations.join(';')).toMatch(/unknown field 'extra'/);
});

test('empty or missing slot is rejected', () => {
  expect(validateSlotContract('ANNEAL_DECISION', { flaw: 'f', decision: 'file-ticket', artifact: '#9', rationale: '   ' }).ok).toBe(false);
  expect(validateSlotContract('ANNEAL_DECISION', { flaw: 'f', decision: 'file-ticket', artifact: '#9' }).ok).toBe(false);
});

test('anneal decision must be in the enum', () => {
  const bad = validateSlotContract('ANNEAL_DECISION', { flaw: 'f', decision: 'invented', artifact: '#9', rationale: 'r' });
  expect(bad.ok).toBe(false);
  expect(bad.violations.join(';')).toMatch(/decision must be one of/);
  const good = validateSlotContract('ANNEAL_DECISION', { flaw: 'f', decision: ANNEAL_DECISIONS[0], artifact: '#9', rationale: 'r' });
  expect(good.ok).toBe(true);
});

test('missing structured field throws at render', () => {
  expect(() => renderWithSlot('CONSULTANT_EPIC_CLOSEOUT', { epic: '#2037', verdict: 'approve', rubric_rating: '9/10', synthesis: 's' }))
    .toThrow(/missing structured field 'children_closed'/);
});

test('unknown case name throws', () => {
  expect(() => getContract('NOT_A_CASE')).toThrow(/unknown slot-contract case/);
});
