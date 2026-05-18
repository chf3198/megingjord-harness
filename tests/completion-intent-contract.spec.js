const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function read(rel) {
  const repo = path.resolve(__dirname, '..');
  return fs.readFileSync(path.join(repo, rel), 'utf8');
}

test('copilot adapter defines completion intent contract', () => {
  const text = read('.github/copilot-instructions.md');
  assert.match(text, /Completion intent is strict/);
  assert.match(text, /execute full baton delivery through Admin and Consultant gates/);
  assert.match(text, /do not stop at implementation/);
});

test('feature completion governance defines completion intent semantics', () => {
  const text = read('instructions/feature-completion-governance.instructions.md');
  assert.match(text, /Completion intent semantics are strict/);
  assert.match(text, /"complete", "finish", or "ship" means terminal workflow delivery/);
  assert.match(text, /Do not pause after implementation/);
  assert.match(text, /Escalate only for blockers, missing evidence, or explicit design\/UAT decisions/);
});
