'use strict';
// override-contract (Epic #2892 P1-a) — fail-closed enforcement of the Tier-H
// hard-floor: a per-repo override that names a hard-floor (security/provenance)
// control is REJECTED. There is no self-serve or approval path for Tier-H.
const fs = require('fs');
const path = require('path');

const HARD_FLOOR_PATH = path.join(__dirname, '..', '..', '..', 'config', 'override-hard-floor.json');

/** Normalize a key/flag/id to a comparable token (lowercase, non-alnum -> '-'). */
function norm(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Load the hard-floor set as normalized token -> control-id. Returns null on failure (fail-closed). */
function loadHardFloor(floorPath = HARD_FLOOR_PATH) {
  try {
    const data = JSON.parse(fs.readFileSync(floorPath, 'utf8'));
    if (!data || !Array.isArray(data.hard_floor)) return null;
    const map = new Map();
    for (const entry of data.hard_floor) {
      if (!entry || !entry.id) continue;
      map.set(norm(entry.id), entry.id);
      for (const a of entry.aliases || []) map.set(norm(a), entry.id);
    }
    return map;
  } catch {
    return null; // fail-closed: unreadable floor -> reject all overrides
  }
}

/**
 * Check a repo's declared overrides against the hard-floor.
 * @param {object} overrides  map of override key -> value from the repo override source.
 * @param {Map|null} floor    output of loadHardFloor(); null => fail-closed.
 * @returns {{ok:boolean, violations:Array}}
 */
function checkOverrides(overrides = {}, floor = loadHardFloor()) {
  const keys = Object.keys(overrides || {});
  if (floor === null) {
    if (keys.length === 0) return { ok: true, violations: [] };
    return { ok: false, violations: keys.map((key) => ({
      rule: 'hard-floor-config-unavailable', key,
      detail: 'override-hard-floor.json unreadable; overrides rejected fail-closed',
    })) };
  }
  const violations = [];
  for (const key of keys) {
    const control = floor.get(norm(key));
    if (control) {
      violations.push({ rule: 'hard-floor-override-rejected', key, control,
        detail: `override "${key}" targets hard-floor control "${control}" — never overridable (security-weakening carve-out)` });
    }
  }
  return { ok: violations.length === 0, violations };
}

/** True when a single override key targets a hard-floor control. */
function isHardFloor(key, floor = loadHardFloor()) {
  return floor !== null && floor.has(norm(key));
}

/** megalint entry: input.repoOverrides is the repo's declared override map (default none). */
function validate(input = {}) {
  const { ok, violations } = checkOverrides(input.repoOverrides || {}, loadHardFloor(input.hardFloorPath));
  return { ok, violations, found: Object.keys(input.repoOverrides || {}).length > 0 };
}

/** Load a repo-local override map from .megingjord/overrides.{yml,yaml,json}; {} if absent. */
function loadRepoOverrides(cwd = process.cwd()) {
  for (const name of ["overrides.yml", "overrides.yaml", "overrides.json"]) {
    const fp = path.join(cwd, ".megingjord", name);
    if (!fs.existsSync(fp)) continue;
    try {
      const raw = fs.readFileSync(fp, "utf8");
      const data = name.endsWith(".json") ? JSON.parse(raw) : require("js-yaml").load(raw);
      return (data && typeof data === "object") ? (data.overrides || data) : {};
    } catch { return {}; }
  }
  return {};
}

module.exports = { validate, checkOverrides, isHardFloor, loadHardFloor, loadRepoOverrides, norm };

// CLI dispatch surface (ci:override-contract.yml): fail-closed on a hard-floor override.
if (require.main === module) {
  const { ok, violations } = checkOverrides(loadRepoOverrides());
  if (!ok) {
    process.stderr.write("override-contract: hard-floor override rejected:\n");
    for (const v of violations) process.stderr.write("  - " + v.detail + "\n");
    process.exit(1);
  }
  process.stdout.write("override-contract: OK (no hard-floor override)\n");
}
