'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const A = require('../scripts/global/instructional-coverage-audit.js');

function tmpdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ica-'));
}

test('extractStatements: detects MUST', () => {
  const out = A.extractStatements('foo bar\nThis MUST happen\nbaz');
  assert.equal(out.length, 1);
  assert.match(out[0].text, /MUST/);
  assert.equal(out[0].line, 2);
});

test('extractStatements: detects SHALL + REQUIRED', () => {
  const out = A.extractStatements('a SHALL be done\nThe item is REQUIRED');
  assert.equal(out.length, 2);
});

test('extractStatements: skips noise keywords', () => {
  const out = A.extractStatements('for example, you MUST also consider X');
  assert.equal(out.length, 0);
});

test('extractStatements: empty input', () => {
  assert.deepEqual(A.extractStatements(''), []);
  assert.deepEqual(A.extractStatements(null), []);
});

test('findValidatorHint: matches when name-as-words appears in statement', () => {
  const hint = A.findValidatorHint('the role baton linter MUST validate this', ['role-baton-linter']);
  assert.equal(hint, 'role-baton-linter');
});

test('findValidatorHint: no match returns null', () => {
  assert.equal(A.findValidatorHint('this MUST something', ['xyz']), null);
});

test('audit: all unguarded when no validators match', () => {
  const dir = tmpdir();
  fs.writeFileSync(path.join(dir, 'a.md'), 'X MUST do Y\nZ MUST do W');
  const result = A.audit({ instructionsDir: dir, validatorNames: [] });
  assert.equal(result.total_must_statements, 2);
  assert.equal(result.guarded_count, 0);
  assert.equal(result.unguarded_count, 2);
});

test('audit: all guarded when matching validator exists', () => {
  const dir = tmpdir();
  fs.writeFileSync(path.join(dir, 'b.md'), 'role baton linter MUST run\nrole baton linter MUST be wired');
  const result = A.audit({ instructionsDir: dir, validatorNames: ['role-baton-linter'] });
  assert.equal(result.guarded_count, 2);
  assert.equal(result.unguarded_count, 0);
  assert.equal(result.guarded_rate, 1);
});

test('audit: empty dir returns sane defaults', () => {
  const dir = tmpdir();
  const result = A.audit({ instructionsDir: dir, validatorNames: [] });
  assert.equal(result.total_must_statements, 0);
  assert.equal(result.guarded_rate, 1);
});

test('audit: live repo audit produces inventory', () => {
  const result = A.audit();
  assert.ok(result.files_scanned > 0);
  assert.ok(result.total_must_statements >= 0);
});

test('MUST_RE matches expected tokens', () => {
  for (const token of ['MUST', 'MUST NOT', 'SHALL', 'SHALL NOT', 'REQUIRED']) {
    A.MUST_RE.lastIndex = 0;
    assert.ok(A.MUST_RE.test(`prefix ${token} suffix`), `should match ${token}`);
  }
});

test('listInstructionFiles: only .md files', () => {
  const dir = tmpdir();
  fs.writeFileSync(path.join(dir, 'a.md'), '');
  fs.writeFileSync(path.join(dir, 'b.txt'), '');
  fs.writeFileSync(path.join(dir, 'c.md'), '');
  const files = A.listInstructionFiles(dir);
  assert.equal(files.length, 2);
  assert.ok(files.every(f => f.endsWith('.md')));
});

test('listInstructionFiles: missing dir returns empty', () => {
  assert.deepEqual(A.listInstructionFiles('/nonexistent-dir-xyz'), []);
});

test('listValidatorNames: excludes index.js', () => {
  const dir = tmpdir();
  fs.writeFileSync(path.join(dir, 'index.js'), '');
  fs.writeFileSync(path.join(dir, 'foo.js'), '');
  const names = A.listValidatorNames(dir);
  assert.deepEqual(names, ['foo']);
});
