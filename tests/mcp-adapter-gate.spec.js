// mcp-adapter-gate.spec.js -- Tests for the default-OFF MCP adapter opt-in gate.
// Refs #3793, Epic #3789. AC3: tdd-pyramid (default-OFF, enabled path, advisory emission).
'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const {
  mcpAdapterEnabled,
  isEnabled,
  emitOffAdvisory,
  FLAG,
} = require('../scripts/global/mcp-adapter-gate');
const {
  classifyFlag,
  BYPASS_FLAG_REGISTRY,
} = require('../scripts/global/baton-bypass/env-flag-classifier');

/** Capture writes to a fake stream so advisory emission is assertable. */
function makeSink() {
  const lines = [];
  return { lines, write: (text) => lines.push(text) };
}

describe('mcp-adapter-gate', () => {
  let savedFlag;
  let savedQuiet;
  beforeEach(() => {
    savedFlag = process.env[FLAG];
    savedQuiet = process.env.MEGINGJORD_QUIET_RESOLVER;
    delete process.env[FLAG];
    delete process.env.MEGINGJORD_QUIET_RESOLVER;
  });
  afterEach(() => {
    if (savedFlag === undefined) delete process.env[FLAG];
    else process.env[FLAG] = savedFlag;
    if (savedQuiet === undefined) delete process.env.MEGINGJORD_QUIET_RESOLVER;
    else process.env.MEGINGJORD_QUIET_RESOLVER = savedQuiet;
  });

  describe('default-OFF (fail-closed)', () => {
    it('is OFF when the flag is absent', () => {
      assert.equal(isEnabled(), false);
      assert.equal(mcpAdapterEnabled({ stream: makeSink() }).enabled, false);
    });

    it('is OFF for any value other than exactly "1"', () => {
      for (const value of ['0', 'true', 'yes', '', ' 1', '1 ']) {
        process.env[FLAG] = value;
        assert.equal(isEnabled(), false, `value ${JSON.stringify(value)} must be OFF`);
      }
    });
  });

  describe('enabled path', () => {
    it('is ON only when the flag is exactly "1"', () => {
      process.env[FLAG] = '1';
      assert.equal(isEnabled(), true);
      const sink = makeSink();
      const result = mcpAdapterEnabled({ stream: sink });
      assert.equal(result.enabled, true);
      assert.equal(result.flag, FLAG);
      assert.equal(result.advisory, null, 'no OFF advisory when enabled');
      assert.equal(sink.lines.length, 0);
    });
  });

  describe('advisory emission (non-silent OFF, G8)', () => {
    it('emits a non-silent advisory to the stream when OFF', () => {
      const sink = makeSink();
      const result = mcpAdapterEnabled({ stream: sink });
      assert.equal(result.enabled, false);
      assert.ok(result.advisory, 'advisory string returned');
      assert.equal(sink.lines.length, 1);
      assert.match(sink.lines[0], /mcp-adapter-gate/);
      assert.match(sink.lines[0], /fail-closed/);
      assert.match(sink.lines[0], new RegExp(FLAG));
    });

    it('is suppressed under MEGINGJORD_QUIET_RESOLVER=1', () => {
      process.env.MEGINGJORD_QUIET_RESOLVER = '1';
      const sink = makeSink();
      assert.equal(emitOffAdvisory({ stream: sink }), null);
      assert.equal(sink.lines.length, 0);
    });

    it('can be opted out via emitAdvisory:false', () => {
      const sink = makeSink();
      const result = mcpAdapterEnabled({ stream: sink, emitAdvisory: false });
      assert.equal(result.advisory, null);
      assert.equal(sink.lines.length, 0);
    });
  });

  describe('classifier registration (AC2)', () => {
    it('registers the flag as an opt-in-enabler with no CI authority', () => {
      const entry = BYPASS_FLAG_REGISTRY[FLAG];
      assert.ok(entry, `${FLAG} must be in the registry`);
      assert.equal(entry.classification, 'opt-in-enabler');
      assert.equal(entry.ci_authority, false);
      const classified = classifyFlag(FLAG);
      assert.equal(classified.known, true);
      assert.equal(classified.classification, 'opt-in-enabler');
      assert.equal(classified.ci_authority, false);
    });
  });
});
