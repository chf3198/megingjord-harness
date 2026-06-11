// Refs #2806 — stress for the fleet-dev module gate (Epic #2791 P1-8). CHAOS: the gate must fail-closed across
// the full env × manifest corpus (malformed tiers/flags, absent manifest) and never throw. PERF: a p99
// latency budget so the guard is free to call on every routing decision.
const { test, expect } = require('@playwright/test');
const { fleetDevAvailable } = require('../scripts/global/fleet-dev-module.js');
const manifest = require('../config/fleet-dev-module.json');

const TIER_VALUES = [undefined, '', '-1', '0', '1', '2', '3', '4', '5', '9', 'abc', ' 3 '];
const ENABLE_VALUES = [undefined, '', '1', 'true', '0', 'no', 'TRUE', 'garbage'];
const MANIFESTS = [manifest, null, { members: [] }, { members: ['x'] }];

// Independent oracle of the invariant: available iff installed (manifest names >=1 member) AND the flag is an
// accepted value AND MINIMUM_TIER is an integer 3..5.
function expected(man, enableRaw, tierRaw) {
  const installed = Boolean(man && Array.isArray(man.members) && man.members.length > 0);
  const values = man && Array.isArray(man.enableValues) ? man.enableValues : ['1', 'true'];
  const enabled = values.includes((enableRaw || '').trim());
  const trimmedTier = (tierRaw || '').trim();
  const tier = Number(trimmedTier);
  const tierOk = trimmedTier !== '' && Number.isInteger(tier) && tier >= 3 && tier <= 5;
  return installed && enabled && tierOk;
}

test('#2806 CHAOS: fail-closed across the full env × manifest corpus; never throws', () => {
  for (const man of MANIFESTS) {
    for (const enableRaw of ENABLE_VALUES) {
      for (const tierRaw of TIER_VALUES) {
        const env = {};
        if (enableRaw !== undefined) env.MEGINGJORD_FLEET_DEV_ENABLED = enableRaw;
        if (tierRaw !== undefined) env.MEGINGJORD_MINIMUM_TIER = tierRaw;
        let out;
        expect(() => { out = fleetDevAvailable({ manifest: man, env }); }).not.toThrow();
        expect(out.available).toBe(expected(man, enableRaw, tierRaw));
        expect(typeof out.reason).toBe('string'); // always an auditable reason (G8)
      }
    }
  }
});

test('#2806 install/uninstall lifecycle is deterministic + reversible', () => {
  const env = { MEGINGJORD_FLEET_DEV_ENABLED: '1', MEGINGJORD_MINIMUM_TIER: '3' };
  for (let cycle = 0; cycle < 50; cycle += 1) {
    expect(fleetDevAvailable({ manifest, env }).available).toBe(true);        // installed
    expect(fleetDevAvailable({ manifest: null, env }).available).toBe(false); // uninstalled → baseline
  }
});

test('#2806 PERF: fleetDevAvailable p99 < 1ms on the injected path', () => {
  const env = { MEGINGJORD_FLEET_DEV_ENABLED: '1', MEGINGJORD_MINIMUM_TIER: '3' };
  const durations = [];
  for (let i = 0; i < 5000; i += 1) {
    const start = process.hrtime.bigint();
    fleetDevAvailable({ manifest, env });
    durations.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  durations.sort((left, right) => left - right);
  expect(durations[Math.floor(durations.length * 0.99)]).toBeLessThan(1);
});
