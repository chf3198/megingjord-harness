'use strict';
// Tests for session-id-emit.js — Epic #2091 Phase-1 C1.
// node:test tdd-pyramid: unit tests for all ACs.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

// Use isolated tmp dir so tests don't pollute ~/.megingjord/session.id
function withTmpHome(fn) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sid-test-'));
  const origHome = process.env.HOME;
  const origVar = process.env.MEGINGJORD_SESSION_ID;
  process.env.HOME = tmp;
  delete process.env.MEGINGJORD_SESSION_ID;
  // Bust require cache so SESSION_ID_FILE uses new HOME
  const modPath = require.resolve('../scripts/global/session-id-emit.js');
  delete require.cache[modPath];
  try {
    fn(tmp, require('../scripts/global/session-id-emit.js'));
  } finally {
    process.env.HOME = origHome;
    if (origVar !== undefined) process.env.MEGINGJORD_SESSION_ID = origVar;
    else delete process.env.MEGINGJORD_SESSION_ID;
    delete require.cache[modPath];
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

test('AC1: emitSessionId returns valid UUID v4', () => {
  withTmpHome((_tmp, mod) => {
    const id = mod.emitSessionId();
    assert.ok(mod.validateSessionId(id), `expected valid UUID, got: ${id}`);
  });
});

test('AC1: two emitSessionId calls produce different IDs', () => {
  withTmpHome((tmp, mod) => {
    const a = mod.emitSessionId();
    // Delete the file so second call emits fresh
    fs.rmSync(path.join(tmp, '.megingjord', 'session.id'), { force: true });
    const b = mod.emitSessionId();
    assert.notEqual(a, b);
  });
});

test('AC2: session.id file exists with mode 0600 after emit', () => {
  withTmpHome((tmp, mod) => {
    mod.emitSessionId();
    const file = path.join(tmp, '.megingjord', 'session.id');
    assert.ok(fs.existsSync(file), 'session.id file must exist');
    const mode = fs.statSync(file).mode & 0o777;
    assert.equal(mode, 0o600, `expected 0600, got 0${mode.toString(8)}`);
  });
});

test('AC3: MEGINGJORD_SESSION_ID env var takes precedence', () => {
  withTmpHome((_tmp, mod) => {
    const override = '12345678-1234-4234-a234-123456789abc';
    process.env.MEGINGJORD_SESSION_ID = override;
    assert.equal(mod.getSessionId(), override);
  });
});

test('AC4: validateSessionId rejects IDs with path traversal', () => {
  withTmpHome((_tmp, mod) => {
    assert.equal(mod.validateSessionId('../evil'), false);
    assert.equal(mod.validateSessionId('/abs/path'), false);
    assert.equal(mod.validateSessionId('valid\0null'), false);
    assert.equal(mod.validateSessionId(42), false);
  });
});

test('AC4: validateSessionId accepts valid UUID v4', () => {
  withTmpHome((_tmp, mod) => {
    assert.equal(mod.validateSessionId('12345678-1234-4234-a234-123456789abc'), true);
  });
});

test('getSessionId stable on second call without env var', () => {
  withTmpHome((_tmp, mod) => {
    const first = mod.getSessionId();
    const second = mod.getSessionId();
    assert.equal(first, second, 'getSessionId must be stable within a session');
  });
});
