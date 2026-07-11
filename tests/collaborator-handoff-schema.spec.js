// Unit tests for scripts/global/collaborator-handoff-schema.js (#1580).
// Covers the structured-field schema: parseHandoff extraction, validateStructure
// format checks, the prose-collision + markdown-bold canonical helpers, null-safety,
// and parity with the collaborator-self-check rules that now delegate to this module.
const { test, expect } = require('@playwright/test');
const path = require('path');
const S = require(path.resolve(__dirname, '..', 'scripts', 'global', 'collaborator-handoff-schema.js'));
const R = require(path.resolve(__dirname, '..', 'scripts', 'global', 'collaborator-self-check-rules.js'));

const VALID = [
  'COLLABORATOR_HANDOFF',
  'test_strategy: tdd-pyramid',
  '- [x] AC1: done',
  'cross_family_reviewer: qwen2.5:32b',
  'cross_family_rating: 9/10',
  'cross_family_findings: none blocking',
  'cross_family_receipt: a1b2c3d4e5f60718',
  'Pre-handoff verification (PASS)',
  'Signed-by: Orla Harper',
  'Team&Model: claude-code:claude-opus-4-8@local',
  'Role: collaborator',
].join('\n');

test('FIELD_SCHEMA declares the canonical structured fields incl. line-anchored Role', () => {
  const byKey = Object.fromEntries(S.FIELD_SCHEMA.map(f => [f.key, f]));
  expect(byKey.signedBy.label).toBe('Signed-by');
  expect(byKey.teamModel.label).toBe('Team&Model');
  expect(byKey.role).toMatchObject({ label: 'Role', expect: 'collaborator', ownLine: true });
  expect(byKey.crossFamilyReceipt.format).toBe('sha256-hex16');
});

test('parseHandoff extracts every canonical field from a well-formed body', () => {
  const parsed = S.parseHandoff(VALID);
  expect(parsed.signedBy).toBe('Orla Harper');
  expect(parsed.teamModel).toBe('claude-code:claude-opus-4-8@local');
  expect(parsed.role).toBe('collaborator');
  expect(parsed.testStrategy).toBe('tdd-pyramid');
  expect(parsed.crossFamily.reviewer).toBe('qwen2.5:32b');
  expect(parsed.crossFamily.receipt).toBe('a1b2c3d4e5f60718');
  expect(parsed.preHandoffVerification).toBe('PASS');
});

test('parseHandoff returns null for fields that are absent', () => {
  const parsed = S.parseHandoff('Signed-by: Orla Harper');
  expect(parsed.signedBy).toBe('Orla Harper');
  expect(parsed.teamModel).toBeNull();
  expect(parsed.role).toBeNull();
  expect(parsed.crossFamily.receipt).toBeNull();
  expect(parsed.preHandoffVerification).toBeNull();
});

test('parseHandoff extracts an indented Role field', () => {
  expect(S.parseHandoff('  Role: collaborator').role).toBe('collaborator');
});

test('parseHandoff reads PASS / FAIL / SKIPPED verification states', () => {
  expect(S.parseHandoff('Pre-handoff verification (FAIL)').preHandoffVerification).toBe('FAIL');
  expect(S.parseHandoff('Pre-handoff verification: SKIPPED (override-waived)').preHandoffVerification).toBe('SKIPPED');
});

test('fieldValue is line-anchored — a Label: embedded mid-prose is not captured', () => {
  expect(S.fieldValue('explanation says Team&Model: x then end', 'Team&Model')).toBeNull();
  expect(S.fieldValue('Team&Model: claude-code:opus@local', 'Team&Model')).toBe('claude-code:opus@local');
});

test('detectProseColonCollision flags a Team&Model: embedded in prose', () => {
  const out = S.detectProseColonCollision('explanation says Team&Model: line then end');
  expect(out.collision).toBe(true);
  expect(out.violators.length).toBe(1);
});

test('detectProseColonCollision passes a clean canonical body', () => {
  expect(S.detectProseColonCollision('Team&Model: x\nRole: collaborator').collision).toBe(false);
  expect(S.detectProseColonCollision('plain prose with no collision').collision).toBe(false);
});

test('detectProseColonCollision flags a test_strategy: embedded in prose', () => {
  expect(S.detectProseColonCollision('I picked the test_strategy: tdd here').collision).toBe(true);
});

test('detectProseColonCollision does NOT count **test_strategy bold as a collision', () => {
  // bold is a separate rule; collision must not double-report it
  expect(S.detectProseColonCollision('**test_strategy:** tdd-pyramid').collision).toBe(false);
});

test('testStrategyMarkdownBold true on **test_strategy wrap, false on plain field', () => {
  expect(S.testStrategyMarkdownBold('**test_strategy:** tdd-pyramid')).toBe(true);
  expect(S.testStrategyMarkdownBold('test_strategy: tdd-pyramid')).toBe(false);
});

test('validateStructure passes a fully valid handoff', () => {
  // #3678 (F1): a cited cross_family_receipt is now ledger-verified, so a "fully
  // valid" handoff must carry a GENUINE receipt present in the consensus ledger.
  // Build a real 2-family ledger fixture and cite its computed receipt.
  const rc = require(path.resolve(__dirname, '..', 'scripts', 'global', 'cross-family-receipt.js'));
  const os = require('os');
  const fs = require('fs');
  const lp = path.join(os.tmpdir(), `xfr-valid-${process.pid}-${Date.now()}.jsonl`);
  const base = { prompt_sha256: 'p'.repeat(64), response_sha256: 'r'.repeat(64) };
  rc.appendEntry({ ticket: 7777, kind: 'review', provider: 'groq', family: 'meta', verdict: 'PASS', ts: '2026-07-11T00:00:00Z', ...base }, lp);
  rc.appendEntry({ ticket: 7777, kind: 'review', provider: 'mistral', family: 'mistral', verdict: 'PASS', ts: '2026-07-11T00:00:01Z', ...base }, lp);
  const ledger = rc.readLedger(lp);
  fs.unlinkSync(lp);
  const genuine = [...S.ledgerReceiptSet(ledger)][0];
  const body = VALID.replace(/cross_family_receipt: [0-9a-f]{16}/, `cross_family_receipt: ${genuine}`);
  const out = S.validateStructure(body, { ledger });
  expect(out.ok).toBe(true);
  expect(out.violations).toEqual([]);
});

test('validateStructure flags a Role field that is not line-anchored to collaborator', () => {
  const out = S.validateStructure('Role: collaborator and admin');
  expect(out.ok).toBe(false);
  expect(out.violations.map(v => v.rule)).toContain('role-not-line-anchored');
});

test('validateStructure flags a malformed (non 16-hex) cross_family_receipt', () => {
  const out = S.validateStructure('Role: collaborator\ncross_family_receipt: NOTHEX');
  expect(out.ok).toBe(false);
  expect(out.violations.map(v => v.rule)).toContain('cross-family-receipt-format');
});

test('validateStructure accepts a valid 16-hex cross_family_receipt', () => {
  const out = S.validateStructure('Role: collaborator\ncross_family_receipt: 00ff00ff00ff00ff');
  expect(out.violations.map(v => v.rule)).not.toContain('cross-family-receipt-format');
});

test('validateStructure flags markdown-bold test_strategy', () => {
  const out = S.validateStructure('Role: collaborator\n**test_strategy:** tdd');
  expect(out.violations.map(v => v.rule)).toContain('test-strategy-markdown-bold');
});

test('validateStructure flags a prose-colon collision', () => {
  const out = S.validateStructure('Role: collaborator\nexplanation says Team&Model: leak');
  expect(out.violations.map(v => v.rule)).toContain('prose-colon-collision');
});

test('null-safety: parseHandoff / validateStructure / helpers never throw on bad input', () => {
  for (const bad of [null, undefined, 42, {}, []]) {
    expect(() => S.parseHandoff(bad)).not.toThrow();
    expect(() => S.validateStructure(bad)).not.toThrow();
    expect(() => S.detectProseColonCollision(bad)).not.toThrow();
    expect(() => S.testStrategyMarkdownBold(bad)).not.toThrow();
  }
  expect(S.parseHandoff(null).role).toBeNull();
  expect(S.validateStructure(null).ok).toBe(true);
});

test('parity: self-check no-prose-colon-collision rule matches the schema helper', () => {
  for (const body of ['Team&Model: x\nRole: collaborator', 'says Team&Model: leak', 'clean prose']) {
    const ruleOk = R.noProseColonCollision(body).ok;
    const schemaClean = !S.detectProseColonCollision(body).collision;
    expect(ruleOk).toBe(schemaClean);
  }
});

test('parity: self-check no-markdown-bold rule matches the schema helper', () => {
  for (const body of ['test_strategy: tdd-pyramid', '**test_strategy:** tdd-pyramid']) {
    expect(R.noMarkdownBoldOnTestStrategy(body).ok).toBe(!S.testStrategyMarkdownBold(body));
  }
});
