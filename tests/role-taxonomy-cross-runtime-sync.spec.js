'use strict';
// role-taxonomy-cross-runtime-sync — AC6 test for #2321 / Epic #2299
// Verifies all 4 runtime config files reference the 7-role taxonomy.
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const ROLES = ['Manager', 'Collaborator', 'Admin', 'Consultant', 'IT', 'Red-Team', 'Client'];

function readFile(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

// Files required to reference the 7-role taxonomy (AC6 cross-runtime requirement)
const RUNTIME_FILES = [
  'instructions/role-baton-routing.instructions.md',
  'instructions/operator-identity-context.instructions.md',
  'AGENTS.md',
  '.github/copilot-instructions.md',
];

test.describe('Role taxonomy cross-runtime sync (#2321)', () => {
  for (const file of RUNTIME_FILES) {
    test(`${file} references 7-role taxonomy`, () => {
      const content = readFile(file);
      for (const role of ROLES) {
        expect(
          content,
          `${file} must reference role "${role}"`
        ).toContain(role);
      }
    });
  }

  test('role-baton-routing has Role Taxonomy section header', () => {
    const content = readFile('instructions/role-baton-routing.instructions.md');
    expect(content).toContain('## Role Taxonomy');
    expect(content).toContain('Guest-Collaborator');
    expect(content).toContain('RESERVED');
  });

  test('operator-identity-context has disambiguation section', () => {
    const content = readFile('instructions/operator-identity-context.instructions.md');
    expect(content).toContain('meta-term');
    expect(content).toContain('7-role');
    expect(content).toContain('role-baton-routing.instructions.md');
  });

  test('AGENTS.md has Role Taxonomy section', () => {
    const content = readFile('AGENTS.md');
    expect(content).toContain('## Role Taxonomy');
    expect(content).toContain('role-baton-routing.instructions.md');
  });

  test('copilot-instructions within 100-line limit', () => {
    const content = readFile('.github/copilot-instructions.md');
    const lineCount = content.split('\n').filter((_, i, arr) =>
      i < arr.length - 1 || arr[i] !== ''
    ).length;
    expect(lineCount).toBeLessThanOrEqual(100);
  });
});
