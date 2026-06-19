'use strict';
// Refs #2712 (C1 hard block), #2713 (split matrix), #2714 (N/A enum), #2715 (change_type)
// DOC_COVERAGE_GATE_ADVISORY removed — this gate is now a hard block (#2712)
const { loadMatrix, parseYamlSurfaces, surfacesForLabels,
  valueViolation } = require('./doc-coverage-helpers');
const { verifyDeclaredSurfaces } = require('./doc-coverage-diff-verify');

const LANE_SKIP = new Set(['lane:docs-research', 'lane:config-only']);

function parseDocBlock(body) {
  const lines = (body || '').split('\n');
  let inBlock = false; const entries = {};
  for (const line of lines) {
    // Accept both the canonical `doc-coverage:` and the baton-builder's `doc_coverage:`
    // field-key form (#3016) — otherwise builder-produced handoffs parse as "no block".
    if (!inBlock && /^\s*doc[-_]coverage\s*:/i.test(line)) { inBlock = true; continue; }
    if (!inBlock) continue;
    if (/^\S/.test(line)) break;
    const m = line.match(/^\s+([^:]+):\s*(.+)/);
    if (m) entries[m[1].trim()] = m[2].trim();
  }
  return inBlock ? entries : null;
}

function findSurfaceValue(block, surface) {
  const key = block && Object.keys(block).find(k => k.startsWith(surface) || surface.startsWith(k));
  return key ? block[key] : null;
}

// #3121 (Epic #2707): verify that surfaces declared UPDATED/DONE actually appear in the
// PR diff. Delegates to the (previously-unwired) #2716 module — single source of truth —
// running diff-membership only (structural:false) and advisory-first: a declared-but-absent
// surface is the gaming hole the #3095 handback surfaced, but a hard block would break
// in-flight PRs, so the check ships advisory and promotes per the replay-eval-gated model.
// Skipped entirely when prFiles is unavailable (local pre-push / no PR context).
function diffVerifyViolations(block, requiredSurfaces, prFiles) {
  if (!Array.isArray(prFiles)) return [];
  const declaredUpdated = requiredSurfaces.filter((surface) => {
    const value = findSurfaceValue(block, surface);
    return value && /^(?:DONE|UPDATED)\b/i.test(String(value).trim());
  });
  if (!declaredUpdated.length) return [];
  const result = verifyDeclaredSurfaces(declaredUpdated, null,
    { changedFiles: prFiles, structural: false });
  return result.violations.map((viol) => ({
    rule: 'doc-coverage-updated-not-in-diff', severity: 'advisory',
    detail: `surface "${viol.surface}" declared UPDATED but no matching file is in the PR diff` }));
}

function checkBlock(body, labels, matrix, changeType, prFiles) {
  const expected = surfacesForLabels(labels, matrix, changeType);
  if (!expected.required.length) return [];
  const block = parseDocBlock(body);
  if (!block) return [{ rule: 'doc-coverage-missing', severity: 'error',
    detail: `missing doc-coverage block; required: ${expected.required.join(', ')}` }];
  const violations = expected.required.flatMap((surface) => {
    const value = findSurfaceValue(block, surface);
    if (!value) return [{ rule: 'doc-coverage-missing', severity: 'error',
      detail: `required surface "${surface}" not found in doc-coverage block` }];
    const violation = valueViolation(surface, value);
    return violation ? [violation] : [];
  });
  return violations.concat(diffVerifyViolations(block, expected.required, prFiles));
}

function validate(input) {
  const lane = input.lane || '';
  if (LANE_SKIP.has(lane)) return { ok: true, violations: [], reason: 'lane-skip' };
  let matrix = input.matrix; // caller-injected matrix (testability); else load from config.
  if (!matrix) {
    try { matrix = loadMatrix(); } catch (e) {
      return { ok: false, violations: [{ rule: 'doc-coverage-matrix-load-failed',
        severity: 'error', detail: e.message }] };
    }
  }
  if (!Object.keys(matrix).length) return { ok: false, violations: [{
    rule: 'doc-coverage-missing', severity: 'error',
    detail: 'doc-coverage matrix is empty — check config files' }] };
  const changeType = input.change_type || null;
  const handoff = (input.comments || []).slice().reverse()
    .find(c => /(^|\n)\s*(?:##\s*)?COLLABORATOR_HANDOFF\b/i.test(c.body || ''));
  const body = handoff ? handoff.body : (input.body || '');
  const violations = checkBlock(body, input.labels, matrix, changeType, input.prFiles);
  // Advisory violations (the diff-verification check, advisory-first) surface but do not block.
  return { ok: violations.every((v) => v.severity === 'advisory'), violations };
}

module.exports = { validate, loadMatrix, parseYamlSurfaces, surfacesForLabels,
  parseDocBlock, checkBlock, diffVerifyViolations };

if (require.main === module) {
  const { readFileSync } = require('fs');
  const argv = process.argv.slice(2);
  const bi = argv.indexOf('--body');
  if (bi === -1 || !argv[bi + 1]) { process.stderr.write('Usage: doc-coverage.js --body <file> [--labels <json>] [--lane <lane>]\n'); process.exit(2); }
  const body = readFileSync(argv[bi + 1], 'utf8');
  const li = argv.indexOf('--labels'); const lni = argv.indexOf('--lane');
  const labels = li !== -1 ? JSON.parse(argv[li + 1]) : [];
  const lane = lni !== -1 ? argv[lni + 1] : 'lane:code-change';
  const result = validate({ body, labels, lane, comments: [] });
  if (!result.ok) { result.violations.forEach(v => process.stderr.write(`[${v.severity}] ${v.rule}: ${v.detail}\n`)); process.exit(1); }
  process.stdout.write('doc-coverage: OK\n');
}
