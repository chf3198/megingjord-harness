// tests/github-mcp-dispatch.spec.js — unit tests for GitHub-native MCP dispatch. Refs #2752.
'use strict';
const assert = require('node:assert/strict');
const { describe, it, before } = require('node:test');
const path = require('node:path');

let dispatch;
let mockResponses = [];

function makeRes(status, body) {
  return {
    statusCode: status,
    headers: {},
    on(ev, cb) { if (ev === 'data') cb(body); if (ev === 'end') cb(); return this; },
  };
}

before(() => {
  const Module = require('node:module');
  const origLoad = Module._load;
  Module._load = function(req, parent, isMain) {
    if (req === 'node:https') {
      return {
        request(opts, cb) {
          const resp = mockResponses.shift() || makeRes(204, '');
          cb(resp);
          return { write() {}, end() {}, on() {} };
        },
      };
    }
    if (req === 'node:child_process') return { execSync: () => 'tok' };
    return origLoad.apply(this, arguments);
  };
  const modulePath = path.resolve(__dirname, '../scripts/global/github-mcp-dispatch');
  delete require.cache[require.resolve(modulePath)];
  ({ dispatch } = require(modulePath));
});

describe('dispatch', () => {
  it('returns dispatch object on success', async () => {
    mockResponses.push(makeRes(204, ''));
    const result = await dispatch('owner', 'repo', 'mcp-review');
    assert.equal(result.dispatched, true);
    assert.equal(result.event_type, 'mcp-review');
    assert.ok(result.timestamp);
  });

  it('dispatches with custom event type', async () => {
    mockResponses.push(makeRes(204, ''));
    const result = await dispatch('owner', 'repo', 'custom-event', { key: 'val' });
    assert.equal(result.event_type, 'custom-event');
    assert.equal(result.dispatched, true);
  });

  it('throws on HTTP error', async () => {
    mockResponses.push(makeRes(422, '{"message":"bad"}'));
    await assert.rejects(() => dispatch('owner', 'repo', 'bad'), /dispatch failed/);
  });
});
