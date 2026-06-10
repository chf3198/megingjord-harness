// Refs #2798 — Least-Agency protected-path deny-list (Epic #2791 P1-5). Pure unit tests against the REAL
// policy deny-list (proves AC1 wiring); MEGINGJORD_NO_TELEMETRY suppresses the deny-log prod write.
process.env.MEGINGJORD_NO_TELEMETRY = '1';
const { test, expect } = require('@playwright/test');
const {
  screenFleetDev, fleetDevDenyGate, matchesDeny, denyPatternsFrom, normalizePath,
} = require('../scripts/global/fleet-dev-deny-paths.js');
const policy = require('../scripts/global/model-routing-policy.json');

const patterns = denyPatternsFrom(policy);
// A capability profile that would EASILY pass #2794 — to prove the deny-list wins "regardless of score" (AC2).
const STRONG = { context_stability_tokens: 100000, swe_bench_verified: 0.99 };
const OK_TASK = { pattern: 'known', contextTokens: 500, schemaClarity: 'clear' };

test('AC1 the real policy ships a non-empty deny-list', () => {
  expect(Array.isArray(patterns)).toBe(true);
  expect(patterns.length).toBeGreaterThan(0);
});

test('matchesDeny flags high-blast-radius paths, allows ordinary ones', () => {
  expect(matchesDeny('scripts/global/pretool_guard.py', patterns).denied).toBe(true);
  expect(matchesDeny('src/auth/login.js', patterns).denied).toBe(true);
  expect(matchesDeny('.github/workflows/release.yml', patterns).denied).toBe(true);
  expect(matchesDeny('scripts/global/crypto/keys/sign.js', patterns).denied).toBe(true);
  expect(matchesDeny('dashboard/js/panel-anim.js', patterns).denied).toBe(false);
  expect(matchesDeny('scripts/global/wiki-search.js', patterns).denied).toBe(false);
});

test('matchesDeny fail-closes on an unparseable path', () => {
  expect(matchesDeny(null, patterns).denied).toBe(true);
  expect(matchesDeny(123, patterns).denied).toBe(true);
  expect(matchesDeny('', patterns).denied).toBe(true);
});

test('F1 canonicalization defeats URL-encoded + homoglyph + traversal evasion (fail-closed)', () => {
  expect(matchesDeny('src/x/%63rypto/k.js', patterns).denied).toBe(true);          // %63 → c → crypto
  expect(matchesDeny('src/%2563rypto/x.js', patterns).denied).toBe(true);          // double-encoded → crypto
  expect(matchesDeny('src/сrypto/keys.js', patterns).denied).toBe(true);      // Cyrillic с → non-ASCII fail-closed
  expect(matchesDeny('lib/unrelated/../crypto/s.js', patterns).denied).toBe(true); // .. collapses onto crypto
  expect(matchesDeny('docs/file%C3%28.md', patterns).denied).toBe(true);           // malformed UTF-8 → fail-closed
  expect(matchesDeny('config/session./refresh.js', patterns).denied).toBe(true);   // Windows trailing-dot dodge
  expect(matchesDeny('src/auth /x.js', patterns).denied).toBe(true);               // Windows trailing-space dodge
  expect(matchesDeny('src/.../login.js', patterns).denied).toBe(true);             // all-dots segment → fail-closed
  expect(matchesDeny('a/   /b.js', patterns).denied).toBe(true);                    // all-space segment → fail-closed
  expect(matchesDeny('src/auth%00/innocuous.js', patterns).denied).toBe(true);     // null-byte injection → fail-closed
  expect(matchesDeny('docs/readme\tx.md', patterns).denied).toBe(true);            // control char (TAB) → fail-closed
  expect(matchesDeny('src/a*h/login.js', patterns).denied).toBe(true);             // glob metachar (*) → fail-closed
  expect(matchesDeny('src/AUTH~1/x.js', patterns).denied).toBe(true);              // 8.3 shortname (~) → fail-closed
  expect(matchesDeny('-rf/x.js', patterns).denied).toBe(true);                     // arg-injection (-rf flag) → deny
  expect(matchesDeny('src/--force.js', patterns).denied).toBe(true);               // arg-injection (--force) → deny
});

test('arg-injection guard is path-side only — the -gate.js deny pattern still fires', () => {
  expect(matchesDeny('scripts/global/baton-gate.js', patterns).denied).toBe(true); // -gate.js pattern intact
  expect(matchesDeny('a/-/b.js', patterns).denied).toBe(false);                    // bare '-' stdin token allowed
});

test('the char allow-list still accepts ordinary repo paths (no over-block)', () => {
  expect(matchesDeny('dashboard/js/panel-anim.js', patterns).denied).toBe(false);
  expect(matchesDeny('scripts/global/wiki_search.js', patterns).denied).toBe(false);
  expect(matchesDeny('docs/howto/sub-issues.md', patterns).denied).toBe(false);
});

test('leading-slash patterns stay anchored after normalization (no un-anchor regression)', () => {
  // '/auth' must not match 'oauth2/token.js' (no leading-slash auth) but must match '/auth/x' and 'auth/'.
  expect(matchesDeny('lib/myauth-helper.js', patterns).denied).toBe(false); // not /auth, not auth/
  expect(matchesDeny('src/auth/x.js', patterns).denied).toBe(true);         // auth/
});

test('F3 coverage: added categories (sso, .pem, .tf) are denied', () => {
  expect(matchesDeny('src/sso/handler.js', patterns).denied).toBe(true);
  expect(matchesDeny('configs/service.pem', patterns).denied).toBe(true);
  expect(matchesDeny('infra/main.tf', patterns).denied).toBe(true);
});

test('denyPatternsFrom is prototype-pollution safe + null on absence', () => {
  expect(denyPatternsFrom({})).toBeNull();
  expect(denyPatternsFrom(null)).toBeNull();
  expect(denyPatternsFrom(Object.create({ fleet_dev_deny_paths: { patterns: ['x'] } }))).toBeNull(); // inherited ignored
});

test('AC3 fail-closed: a missing/empty deny-list DENIES (+ logs via injected emit)', () => {
  const seen = [];
  const out = fleetDevDenyGate(['dashboard/js/panel.js'], {}, { emit: (rec) => seen.push(rec) });
  expect(out.denied).toBe(true);
  expect(out.reason).toBe('deny-list-missing-or-empty');
  expect(seen[0].event).toBe('fleet-dev-deny');
});

test('AC3 fail-closed: an undeclared path set DENIES (cannot prove avoidance)', () => {
  expect(fleetDevDenyGate([], policy).denied).toBe(true);
  expect(fleetDevDenyGate(undefined, policy).reason).toBe('no-paths-declared');
});

test('fleetDevDenyGate: a protected path in the set denies the whole task; all-clean passes', () => {
  const mixed = fleetDevDenyGate(['dashboard/js/panel.js', 'src/auth/session/refresh.js'], policy);
  expect(mixed.denied).toBe(true);
  expect(mixed.matches[0].path).toContain('auth');
  expect(fleetDevDenyGate(['dashboard/js/panel.js', 'docs/howto/x.md'], policy).denied).toBe(false);
});

test('AC2 a denied path → premium/human-only REGARDLESS of a strong capability score', () => {
  const out = screenFleetDev({ touchedPaths: ['scripts/global/baton-gates.js'], taskFeatures: OK_TASK,
    profile: STRONG, policy, opts: { emit: () => {} } });
  expect(out.eligible).toBe(false);
  expect(out.decision).toBe('premium-or-human');
  expect(out.denied).toBe(true);
});

test('AC4 an allowed path delegates to the #2794 capability gate (eligible → fleet)', () => {
  const out = screenFleetDev({ touchedPaths: ['dashboard/js/panel.js'], taskFeatures: OK_TASK, profile: STRONG, policy });
  expect(out.denied).toBe(false);
  expect(out.eligible).toBe(true);
  expect(out.decision).toBe('fleet');
});

test('AC4 an allowed path with a weak/unmeasurable profile escalates via #2794 (not denied)', () => {
  const out = screenFleetDev({ touchedPaths: ['dashboard/js/panel.js'], taskFeatures: OK_TASK, profile: {}, policy });
  expect(out.denied).toBe(false);
  expect(out.eligible).toBe(false);
  expect(out.decision).toBe('escalate'); // capability gate, not the deny-list
});

test('normalizePath canonicalizes separators + case', () => {
  expect(normalizePath('.\\Auth\\Login.JS')).toBe('auth/login.js');
  expect(normalizePath(42)).toBeNull();
});
