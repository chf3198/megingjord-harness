// Tests for label-provision.js + label-manifest.json — Refs #2785
'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { loadManifest, MANIFEST_PATH, provision } = require(
  path.resolve(__dirname, '..', 'scripts', 'global', 'label-provision.js')
);

describe('label-manifest.json', () => {
  it('loads without error', () => {
    const m = loadManifest();
    assert.ok(m.labels && m.labels.length > 0, 'labels array must be non-empty');
  });

  it('every label has name, color, description, group', () => {
    const { labels } = loadManifest();
    for (const l of labels) {
      assert.ok(l.name, `label missing name: ${JSON.stringify(l)}`);
      assert.ok(l.color, `${l.name}: missing color`);
      assert.ok(typeof l.description === 'string', `${l.name}: description must be string`);
      assert.ok(l.group, `${l.name}: missing group`);
      assert.ok(!/^#/.test(l.color), `${l.name}: color must not start with #`);
    }
  });

  it('contains all required baton role labels', () => {
    const { labels } = loadManifest();
    const names = new Set(labels.map(l => l.name));
    for (const role of ['role:manager', 'role:collaborator', 'role:admin', 'role:consultant']) {
      assert.ok(names.has(role), `manifest missing required role label: ${role}`);
    }
  });

  it('contains all 11-state status labels', () => {
    const { labels } = loadManifest();
    const names = new Set(labels.map(l => l.name));
    const required = [
      'status:backlog', 'status:queued', 'status:triage', 'status:ready',
      'status:in-progress', 'status:testing', 'status:review', 'status:done',
      'status:cancelled', 'status:dormant', 'status:deferred',
    ];
    for (const s of required) assert.ok(names.has(s), `manifest missing: ${s}`);
  });

  it('contains lane:code-change and lane:trivial', () => {
    const { labels } = loadManifest();
    const names = new Set(labels.map(l => l.name));
    assert.ok(names.has('lane:code-change'));
    assert.ok(names.has('lane:trivial'));
  });

  it('manifest is shared by label-rules.js (MANIFEST_PATH agrees)', () => {
    const R = require(path.resolve(__dirname, '..', 'scripts', 'global', 'label-rules.js'));
    assert.strictEqual(R.MANIFEST_PATH, MANIFEST_PATH);
    const mFromRules = R.loadManifest();
    assert.ok(mFromRules.labels.length > 0);
  });
});

describe('provision() dry-run', () => {
  it('AC2: returns total matching manifest length, zero errors, all dry-run', async () => {
    const result = await provision('owner/repo', { dryRun: true });
    const { labels } = loadManifest();
    assert.strictEqual(result.total, labels.length);
    assert.strictEqual(result.errors.length, 0);
    assert.strictEqual(result.dryRun, labels.length);
    assert.strictEqual(result.ok, 0);
  });

  it('AC4: receipts-api-mcp starting state — repo:role:manager only — ends with full role:* set', async () => {
    // Dry-run proves provisioner WOULD create all role labels.
    const result = await provision('chf3198/receipts-api-mcp', { dryRun: true });
    const { labels } = loadManifest();
    const roleLabels = labels.filter(l => l.group === 'role');
    const dryRunNames = new Set(result.results.filter(r => r.action === 'dry-run').map(r => r.name));
    for (const rl of roleLabels) {
      assert.ok(dryRunNames.has(rl.name), `provisioner would not seed ${rl.name}`);
    }
  });

  it('provision throws on missing repo argument', async () => {
    await assert.rejects(() => provision(''), /required/i);
  });
});
