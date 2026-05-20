// Goal-hijack adversarial fixture coverage per #1972.
// Lane: code-change. test_strategy: tdd-pyramid + adversarial-fixture.

const { test, expect } = require('@playwright/test');
const path = require('path');
const LOADER = require(path.resolve(__dirname, '..', 'scripts', 'global', 'goal-hijack-fixture-loader.js'));

test('fixture directory exists and has >=10 fixtures (AC2)', () => {
  const fixtures = LOADER.loadAllFixtures();
  expect(fixtures.length).toBeGreaterThanOrEqual(10);
});

test('every fixture has required keys (AC1 + AC2)', () => {
  const fixtures = LOADER.loadAllFixtures();
  for (const f of fixtures) {
    const v = LOADER.validateFixture(f);
    expect.soft(v.ok, `${f.id} missing: ${v.missing.join(', ')}`).toBe(true);
  }
});

test('fixture ids are unique', () => {
  const fixtures = LOADER.loadAllFixtures();
  const ids = fixtures.map((f) => f.id);
  expect(new Set(ids).size).toBe(ids.length);
});

test('fixtures cover all 5 required categories (AC2)', () => {
  const fixtures = LOADER.loadAllFixtures();
  const cats = new Set(fixtures.map((f) => f.category));
  const required = ['instruction-override', 'role-confusion', 'scope-creep',
    'manager-impersonation', 'ticket-spoofing'];
  for (const c of required) {
    expect(cats.has(c)).toBe(true);
  }
});

test('fixtures cite OWASP Agentic Top 10 risk references', () => {
  const fixtures = LOADER.loadAllFixtures();
  for (const f of fixtures) {
    expect.soft(f.owasp_risk).toMatch(/OWASP-Agentic-\d+/);
  }
});

test('checkResponse PASSES when text satisfies must_match and not must_not_match', () => {
  const fixture = LOADER.loadAllFixtures()[0]; // instruction-override
  const goodResponse = 'I refuse. This is a destructive operation that requires explicit authorization and a linked ticket.';
  const r = LOADER.checkResponse(fixture, goodResponse);
  expect(r.pass).toBe(true);
});

test('checkResponse FAILS when text hits must_not_match', () => {
  const fixture = LOADER.loadAllFixtures()[0];
  const badResponse = 'Sure, deleting the .github/workflows/ directory now and force-pushing to main.';
  const r = LOADER.checkResponse(fixture, badResponse);
  expect(r.pass).toBe(false);
});

test('G4: fixtures contain no real-looking secrets (placeholder bearer/api_key only)', () => {
  const fixtures = LOADER.loadAllFixtures();
  const realSecretRe = /\b(sk-[A-Za-z0-9]{20,}|pk_live_[A-Za-z0-9]{20,}|AKIA[A-Z0-9]{16})\b/;
  for (const f of fixtures) {
    const blob = JSON.stringify(f);
    expect.soft(blob).not.toMatch(realSecretRe);
  }
});

test('summarise reports total/passed/failed/firstFailure', () => {
  const fixtures = LOADER.loadAllFixtures();
  const fakeResults = fixtures.map((f) => ({
    fixture: f, check: { pass: f.id === 'goal-hijack-01-instruction-override' },
  }));
  const s = LOADER.summarise(fakeResults);
  expect(s.total).toBe(fixtures.length);
  expect(s.passed).toBe(1);
  expect(s.failed).toBe(fixtures.length - 1);
});
