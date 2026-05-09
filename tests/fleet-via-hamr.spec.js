'use strict';
const { test, expect } = require('@playwright/test');
const path = require('node:path');
const { resolveNode, FLEET_NODES, fleetCall } = require(path.resolve(__dirname, '../scripts/global/fleet-via-hamr.js'));

test.describe('fleet-via-hamr (#1149)', () => {
  test('resolveNode picks correct host per tier', () => {
    expect(resolveNode('fleet-large').host).toBe('100.91.113.16');
    expect(resolveNode('fleet-standard').host).toBe('100.78.22.13');
    expect(resolveNode('fleet-fast').default_model).toBe('starcoder2:3b');
    expect(resolveNode('unknown-tier').host).toBe('100.78.22.13');
  });

  test('FLEET_NODES has required tiers', () => {
    expect(Object.keys(FLEET_NODES)).toEqual(
      expect.arrayContaining(['fleet-fast', 'fleet-quality', 'fleet-standard', 'fleet-large'])
    );
  });

  test('fleetCall returns wrapped shape on disabled HAMR', async () => {
    process.env.MEGINGJORD_HAMR_DISABLED = '1';
    try {
      const originalFetch = global.fetch;
      global.fetch = async () => ({
        status: 200,
        json: async () => ({ response: 'ok' }),
        headers: new Map(),
      });
      const result = await fleetCall({ tier: 'fleet-standard', prompt: 'test' });
      expect(result.ok).toBe(true);
      expect(result.hamr_disabled).toBe(true);
      global.fetch = originalFetch;
    } finally { delete process.env.MEGINGJORD_HAMR_DISABLED; }
  });
});
