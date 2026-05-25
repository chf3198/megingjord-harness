// signer-lint wiring tests for D-1407-03 (#1422, Epic #1407 AC4).
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const Sig = require(path.resolve(__dirname, '..', 'scripts', 'global', 'megalint', 'signer-fidelity.js'));

test('signer-lint workflow YAML wires megalint signer-fidelity validator', () => {
  const yaml = fs.readFileSync(
    path.resolve(__dirname, '..', '.github', 'workflows', 'signer-lint.yml'), 'utf-8'
  );
  expect(yaml).toContain('require(\'./scripts/global/megalint/signer-fidelity.js\')');
  expect(yaml).toContain('issues:');
  expect(yaml).toContain('opened, edited, reopened');
  expect(yaml).toContain('marker = \'<!-- megalint-signer-fidelity -->\'');
  // Advisory mode for soak period per #1406 risk mitigation
  expect(yaml).toContain('core.warning');
});

test('signer-lint: validator clears OK on worker-aliased body', () => {
  const r = Sig.validate({ body: 'Signed-by: Soren Mason\nTeam&Model: copilot:claude-sonnet-4-6@github' });
  expect(r.ok).toBe(true);
});

test('signer-lint: validator catches Curtis Franks signer', () => {
  const r = Sig.validate({ body: 'Signed-by: Curtis Franks\nTeam&Model: copilot:claude-sonnet-4-6@github' });
  expect(r.ok).toBe(false);
  expect(r.violations[0].rule).toBe('client-identity-as-signer');
});

test('signer-lint: workflow has issues + issue_comment triggers (not pull_request)', () => {
  const yaml = fs.readFileSync(
    path.resolve(__dirname, '..', '.github', 'workflows', 'signer-lint.yml'), 'utf-8'
  );
  expect(yaml).toMatch(/on:\s*\n\s*issues:/);
  expect(yaml).toContain('issue_comment:'); // #1890: comment iteration trigger
  expect(yaml).not.toContain('pull_request:');
});

// #1890 — comment iteration coverage
test('#1890: signer-lint workflow YAML iterates comments (not just issue body)', () => {
  const yaml = fs.readFileSync(
    path.resolve(__dirname, '..', '.github', 'workflows', 'signer-lint.yml'), 'utf-8'
  );
  expect(yaml).toContain('#1890');
  expect(yaml).toMatch(/for \(const cm of comments\)/);
  expect(yaml).toMatch(/cm\.body\.includes\('Signed-by'\)/);
});

test('#1890: suggested-fix text uses canonical Orla Mason (not invented Cole Mason)', () => {
  const yaml = fs.readFileSync(
    path.resolve(__dirname, '..', '.github', 'workflows', 'signer-lint.yml'), 'utf-8'
  );
  expect(yaml).toContain('Orla Mason');
  expect(yaml).not.toContain('Cole Mason');
});

test('#1890: validator catches invented alias in comment-body simulation', () => {
  // sanity check that validate() flags an invented Mason-family alias
  const r = Sig.validate({ body: 'Signed-by: Cole Mason\nTeam&Model: claude-code:opus-4-7@local\nRole: manager' });
  expect(r.ok).toBe(false);
  expect(r.violations.find(v => v.rule === 'signer-alias-not-registry-derived')).toBeTruthy();
});

test('#1890: validator passes on canonical Orla Mason alias', () => {
  const r = Sig.validate({ body: 'Signed-by: Orla Mason\nTeam&Model: claude-code:opus-4-7@local\nRole: manager' });
  expect(r.ok).toBe(true);
});
