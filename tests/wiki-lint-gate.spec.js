// Refs #2156 - YAML schema test for wiki-lint-gate workflow
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WF_PATH = path.join(__dirname, '..', '.github', 'workflows', 'wiki-lint-gate.yml');

function getYaml() { return fs.readFileSync(WF_PATH, 'utf8'); }

test('workflow file exists', () => {
  assert.ok(fs.existsSync(WF_PATH));
});

test('declares name: wiki-lint-gate', () => {
  assert.match(getYaml(), /^name:\s*wiki-lint-gate\s*$/m);
});

test('triggers on pull_request', () => {
  assert.match(getYaml(), /^on:\s*$/m);
  assert.match(getYaml(), /^\s+pull_request:\s*$/m);
});

test('path filter includes wiki/, README.md, vscode-extension/README.md', () => {
  const text = getYaml();
  assert.match(text, /wiki\/\*\*/);
  assert.match(text, /'README\.md'/);
  assert.match(text, /vscode-extension\/README\.md/);
});

test('permissions: read-all baseline', () => {
  assert.match(getYaml(), /^permissions:\s*read-all\s*$/m);
});

test('has timeout-minutes ≤ 5', () => {
  const match = getYaml().match(/timeout-minutes:\s*(\d+)/);
  assert.ok(match);
  assert.ok(Number(match[1]) <= 5);
});

test('invokes npm run wiki:lint', () => {
  assert.match(getYaml(), /npm run wiki:lint/);
});

test('uses pinned setup-node@v4', () => {
  assert.match(getYaml(), /actions\/setup-node@v4/);
});

test('uses pinned checkout@v4', () => {
  assert.match(getYaml(), /actions\/checkout@v4/);
});
