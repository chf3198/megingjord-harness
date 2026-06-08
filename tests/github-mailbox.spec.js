// tests/github-mailbox.spec.js — unit tests for GitHub-native mailbox. Refs #2750.
'use strict';
const assert = require('node:assert/strict');
const { describe, it, before, after } = require('node:test');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

// We test via a patched require that overrides https and child_process.
let writeMessage, readMessages;
let capturedRequests = [];
let mockResponses = [];

function makeRes(status, body, etag) {
  return {
    statusCode: status,
    headers: { etag },
    on(ev, cb) { if (ev === 'data') cb(body); if (ev === 'end') cb(); return this; },
  };
}

before(() => {
  // Patch State path to a tmp dir
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mbox-'));
  process.chdir(tmpDir);

  // Stub https.request
  const Module = require('node:module');
  const origLoad = Module._load;
  Module._load = function(req, parent, isMain) {
    if (req === 'node:https') {
      return {
        request(opts, cb) {
          const resp = mockResponses.shift() || makeRes(200, '[]', '"v1"');
          capturedRequests.push({ method: opts.method, path: opts.path });
          cb(resp);
          return { write() {}, end() {}, on() {} };
        },
      };
    }
    if (req === 'node:child_process') return { execSync: () => 'tok' };
    return origLoad.apply(this, arguments);
  };

  // Clear require cache and load module fresh
  const modulePath = path.resolve(__dirname, '../scripts/global/github-mailbox');
  delete require.cache[require.resolve(modulePath)];
  ({ writeMessage, readMessages } = require(modulePath));
});

after(() => {
  const Module = require('node:module');
  // Restore not strictly needed in tests but good practice
  capturedRequests = [];
});

describe('readMessages', () => {
  it('returns [] when no state file exists', async () => {
    capturedRequests = [];
    const result = await readMessages('owner', 'repo');
    assert.deepEqual(result, []);
    assert.equal(capturedRequests.length, 0);
  });

  it('returns [] on HTTP 304 (ETag cache hit)', async () => {
    // Set up state with issue_number and etag
    fs.mkdirSync('.dashboard', { recursive: true });
    fs.writeFileSync('.dashboard/mailbox-etag.json', JSON.stringify({ issue_number: 1, etag: '"v1"' }));
    mockResponses.push(makeRes(304, '', '"v1"'));
    const result = await readMessages('owner', 'repo');
    assert.deepEqual(result, []);
  });

  it('returns filtered comments when since is provided', async () => {
    fs.writeFileSync('.dashboard/mailbox-etag.json', JSON.stringify({ issue_number: 1, etag: '"v2"' }));
    const comments = [{ id: 10, body: 'old' }, { id: 20, body: 'new' }];
    mockResponses.push(makeRes(200, JSON.stringify(comments), '"v3"'));
    const result = await readMessages('owner', 'repo', 15);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 20);
  });
});

describe('writeMessage', () => {
  it('creates coordination issue and posts comment', async () => {
    fs.writeFileSync('.dashboard/mailbox-etag.json', JSON.stringify({}));
    // findOrCreateIssue: search returns empty, then create returns issue #5
    mockResponses.push(makeRes(200, '[]', null));
    mockResponses.push(makeRes(201, JSON.stringify({ number: 5 }), null));
    // post comment
    mockResponses.push(makeRes(201, JSON.stringify({ id: 100 }), null));
    await assert.doesNotReject(() => writeMessage('owner', 'repo', 'hello'));
    const state = JSON.parse(fs.readFileSync('.dashboard/mailbox-etag.json', 'utf8'));
    assert.equal(state.issue_number, 5);
  });

  it('throws when comment POST fails', async () => {
    fs.writeFileSync('.dashboard/mailbox-etag.json', JSON.stringify({ issue_number: 5 }));
    mockResponses.push(makeRes(403, '{"message":"Forbidden"}', null));
    await assert.rejects(() => writeMessage('owner', 'repo', 'fail'), /mailbox write failed/);
  });
});
