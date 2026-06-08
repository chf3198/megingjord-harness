// tests/github-bundle-client.spec.js — unit tests for GitHub-native bundle client. Refs #2751.
'use strict';
const assert = require('node:assert/strict');
const { describe, it, before } = require('node:test');
const path = require('node:path');

let publishBundle, fetchBundle;
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
          const resp = mockResponses.shift() || makeRes(200, '{}');
          cb(resp);
          return { write() {}, end() {}, on() {} };
        },
      };
    }
    if (req === 'node:child_process') return { execSync: () => 'tok' };
    return origLoad.apply(this, arguments);
  };
  const modulePath = path.resolve(__dirname, '../scripts/global/github-bundle-client');
  delete require.cache[require.resolve(modulePath)];
  ({ publishBundle, fetchBundle } = require(modulePath));
});

describe('fetchBundle', () => {
  it('returns null when release not found', async () => {
    mockResponses.push(makeRes(404, '{}'));
    const result = await fetchBundle('owner', 'repo', 'test.json');
    assert.equal(result, null);
  });

  it('returns null when asset not in release', async () => {
    mockResponses.push(makeRes(200, JSON.stringify({ assets: [] })));
    const result = await fetchBundle('owner', 'repo', 'missing.json');
    assert.equal(result, null);
  });

  it('returns asset content when found', async () => {
    const release = { assets: [{ id: 1, name: 'bundle.json' }] };
    mockResponses.push(makeRes(200, JSON.stringify(release)));
    mockResponses.push(makeRes(200, '{"data":"test"}'));
    const result = await fetchBundle('owner', 'repo', 'bundle.json');
    assert.equal(result, '{"data":"test"}');
  });
});

describe('publishBundle', () => {
  it('creates release and uploads asset', async () => {
    mockResponses.push(makeRes(404, '{}')); // release not found
    mockResponses.push(makeRes(201, JSON.stringify({ id: 42 }))); // create release
    mockResponses.push(makeRes(201, JSON.stringify({ name: 'test.json', id: 99 }))); // upload
    const result = await publishBundle('owner', 'repo', 'test.json', '{}');
    assert.equal(result.name, 'test.json');
  });

  it('throws when upload fails', async () => {
    mockResponses.push(makeRes(200, JSON.stringify({ id: 1 }))); // existing release
    mockResponses.push(makeRes(422, '{"message":"Unprocessable"}'));
    await assert.rejects(() => publishBundle('owner', 'repo', 'fail.json', '{}'), /bundle upload failed/);
  });
});
