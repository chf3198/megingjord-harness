'use strict';
// registry-tuple-coverage — FAILS when a declared autoModeCoverage (team,model)
// tuple resolves to the cross-team wildcard ('*' entry) or the defaultAliasSeed
// instead of a team-specific registry entry. This surfaces an unmapped Auto-mode
// model at add-time, not at park-time (#3029 C1 AC2; root cause of #2945/#3020,
// where copilot Auto-mode routed to qwen and fell through to the wildcard alias).
const { loadRegistry, matchRegistryEntry } = require('./signer-registry-check');

function findUnmappedTuples(registry) {
  const coverage = registry.autoModeCoverage || {};
  const unmapped = [];
  for (const [team, models] of Object.entries(coverage)) {
    if (team.startsWith('_')) continue; // _note and friends
    if (!Array.isArray(models)) continue;
    for (const model of models) {
      const entry = matchRegistryEntry(registry, team.toLowerCase(), String(model).toLowerCase(), '');
      if (!entry) {
        unmapped.push({ team, model, resolvedTo: 'defaultAliasSeed' });
      } else if (entry.team === '*') {
        unmapped.push({ team, model, resolvedTo: 'cross-team-wildcard', wildcardSeed: entry.aliasSeed });
      }
    }
  }
  return unmapped;
}

function checkCoverage(registryOverride) {
  const registry = loadRegistry(registryOverride);
  if (!registry) return { ok: false, reason: 'registry-unreadable', unmapped: [] };
  const unmapped = findUnmappedTuples(registry);
  return { ok: unmapped.length === 0, unmapped };
}

if (require.main === module) {
  const result = checkCoverage();
  if (result.ok) {
    process.stdout.write('registry-tuple-coverage: OK — all autoModeCoverage tuples map to a team-specific alias.\n');
    process.exit(0);
  }
  process.stderr.write('registry-tuple-coverage: FAIL — unmapped (team,model) tuples resolve to a generic alias:\n');
  for (const u of result.unmapped) {
    process.stderr.write(`  - ${u.team}:${u.model} -> ${u.resolvedTo}`
      + (u.wildcardSeed ? ` (${u.wildcardSeed})` : '')
      + ' — add an explicit registry entry so this team signs distinctly.\n');
  }
  process.exit(1);
}

module.exports = { findUnmappedTuples, checkCoverage };
