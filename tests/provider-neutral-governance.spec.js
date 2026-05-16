const { test, expect } = require('@playwright/test');
const fs = require('fs');

const DOC = 'instructions/provider-neutral-governance.instructions.md';

function section(text, heading) {
  const start = text.indexOf(`## ${heading}`);
  const next = text.indexOf('\n## ', start + 1);
  return text.slice(start, next === -1 ? text.length : next);
}

test('provider-neutral governance names every runtime adapter', () => {
  const text = fs.readFileSync(DOC, 'utf8');
  for (const runtime of ['Codex', 'Copilot', 'Claude Code']) {
    expect(text).toContain(`### ${runtime} Adapter`);
  }
});

test('shared contract avoids single-runtime governance ownership', () => {
  const shared = section(fs.readFileSync(DOC, 'utf8'), 'Shared Contract');
  const counts = ['Codex', 'Copilot', 'Claude Code'].map(name =>
    (shared.match(new RegExp(name, 'g')) || []).length);
  expect(new Set(counts).size).toBe(1);
});

test('compatibility checklist keeps Codex in shared coordination coverage', () => {
  const text = fs.readFileSync(DOC, 'utf8');
  expect(section(text, 'Compatibility Checklist')).toContain('Codex');
  expect(text).toContain('Do not infer Codex compatibility');
});
