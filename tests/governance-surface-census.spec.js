'use strict';
// Epic #3807 / #3808 — tests for the READ-ONLY governance-surface census.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const census = require('../scripts/global/governance-surface-census.js');

test('census returns a versioned snapshot with the invariant headline', () => {
  const c = census.census();
  assert.strictEqual(c.schema, 'governance-surface-census-v1');
  assert.strictEqual(typeof c.surface_units, 'number');
  // surface_units is the sum the net-negative invariant tracks
  assert.strictEqual(c.surface_units,
    c.validators.total + c.resident_instructions.files + c.bypass_flags.distinct);
});

test('census measures the real surface (non-trivial counts)', () => {
  const c = census.census();
  assert.ok(c.validators.total > 20, 'finds the validator surface');
  assert.ok(c.validators.advisory + c.validators.blocking === c.validators.total);
  assert.ok(c.workflows > 50 && c.hooks > 10 && c.tests > 100);
  assert.ok(c.resident_instructions.loc > 0);
  assert.ok(c.resident_instructions.loc <= c.resident_instructions.instruction_loc_total,
    'resident LOC is a subset of total instruction LOC');
});

test('advisory detection separates advisory from blocking validators', () => {
  // censusValidators trusts its file list (in production, git ls-files = real files only).
  // A megalint path in the list is counted; a spec file is excluded.
  const r = census.censusValidators(['scripts/global/megalint/foo.js', 'scripts/global/megalint/foo.spec.js']);
  assert.strictEqual(r.total, 1, 'counts the validator, excludes the .spec');
  // real run: advisory list length matches the advisory count, and is a subset of totals
  const c = census.census();
  assert.ok(c.validators.advisory <= c.validators.total);
  assert.strictEqual(c.validators.advisoryList.length, c.validators.advisory);
});

test('delta() flags net-negative correctly', () => {
  const base = { surface_units: 100, validators: { total: 55, advisory: 26 },
    resident_instructions: { files: 21, loc: 2335 }, bypass_flags: { distinct: 81 } };
  const shrunk = { surface_units: 95, validators: { total: 52, advisory: 22 },
    resident_instructions: { files: 20, loc: 2100 }, bypass_flags: { distinct: 78 } };
  const grown = { ...base, surface_units: 105 };
  assert.strictEqual(census.delta(shrunk, base).net_negative, true);
  assert.strictEqual(census.delta(shrunk, base).surface_units, -5);
  assert.strictEqual(census.delta(grown, base).net_negative, false);
  assert.strictEqual(census.delta(base, base).net_negative, true, 'flat counts as satisfying <= 0');
});

test('G4: snapshot carries no secret-looking values, only counts and paths', () => {
  const c = census.census();
  const json = JSON.stringify(c);
  // no obvious secret material
  assert.ok(!/sk-[a-zA-Z0-9]{20}/.test(json), 'no api-key-shaped strings');
  // bypass flags are NAMES only (uppercase identifiers), never assignments with values
  for (const f of c.bypass_flags.sample) assert.match(f, /^[A-Z][A-Z0-9_]*$/, 'flag is a bare name');
});

test('SAFETY: census does not write outside an explicitly-named snapshot path', () => {
  // Calling census() returns data and must not create files on its own.
  const before = fs.readdirSync(path.join(__dirname, '..', 'scripts', 'global')).length;
  census.census();
  const after = fs.readdirSync(path.join(__dirname, '..', 'scripts', 'global')).length;
  assert.strictEqual(before, after, 'census() created no files');
});

test('snapshot round-trips through delta for a re-run scoreboard', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'census-'));
  const c = census.census();
  const snap = path.join(dir, 'baseline.json');
  fs.writeFileSync(snap, JSON.stringify(c));
  const reloaded = JSON.parse(fs.readFileSync(snap, 'utf8'));
  assert.strictEqual(census.delta(c, reloaded).surface_units, 0, 'self-delta is zero');
  assert.strictEqual(census.delta(c, reloaded).net_negative, true);
});

test('flag scan ignores flag-names inside comments/prose (precision, xfam finding)', () => {
  // stripComments removes commentary so a mentioned flag name does not inflate the count.
  const code = "const a = process.env.MEGINGJORD_REAL_FLAG; // mentions MEGINGJORD_FAKE_FLAG in a comment";
  const cleaned = census.stripComments(code);
  assert.ok(cleaned.includes('MEGINGJORD_REAL_FLAG'), 'real code reference survives');
  assert.ok(!cleaned.includes('MEGINGJORD_FAKE_FLAG'), 'commented mention is stripped');
});
