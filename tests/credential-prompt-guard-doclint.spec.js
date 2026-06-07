'use strict';
// #2569 AC6 (drift-lint): the policy instruction must keep its forbidden-behavior clause + wiring, so the
// operator rule stays testable and cannot silently drift away.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const INSTRUCTION = path.join(__dirname, '..', 'instructions', 'credential-prompt-guard.instructions.md');
const CLAUDE_MD = path.join(__dirname, '..', 'CLAUDE.md');

test('AC6: the policy instruction exists and forbids asking the client for a local secret', () => {
  const text = fs.readFileSync(INSTRUCTION, 'utf8');
  assert.match(text, /MUST NOT ask the client for a credential/i);
  assert.match(text, /never request the raw secret value in chat/i);
  assert.match(text, /preCredentialPromptCheck/);
});

test('AC6: the instruction is wired into CLAUDE.md', () => {
  const claude = fs.readFileSync(CLAUDE_MD, 'utf8');
  assert.match(claude, /@instructions\/credential-prompt-guard\.instructions\.md/);
});

test('AC1: the instruction catalogs the secret-prompt paths', () => {
  const text = fs.readFileSync(INSTRUCTION, 'utf8');
  assert.match(text, /AskUserQuestion/);
  assert.match(text, /interactive auth/i);
});
