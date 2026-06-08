'use strict';
// Refs #2712 (C1 hard block), #2713 (split matrix), #2714 (N/A enum), #2715 (change_type)
// DOC_COVERAGE_GATE_ADVISORY removed — this gate is now a hard block (#2712)
const { loadMatrix, parseYamlSurfaces, surfacesForLabels,
  valueViolation } = require('./doc-coverage-helpers');

const LANE_SKIP = new Set(['lane:docs-research', 'lane:config-only']);

function parseDocBlock(body) {
  const lines = (body || '').split('\n');
  let inBlock = false; const entries = {};
  for (const line of lines) {
    if (!inBlock && /^\s*doc-coverage\s*:/i.test(line)) { inBlock = true; continue; }
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

function checkBlock(body, labels, matrix, changeType) {
  const expected = surfacesForLabels(labels, matrix, changeType);
  if (!expected.required.length) return [];
  const block = parseDocBlock(body);
  if (!block) return [{ rule: 'doc-coverage-missing', severity: 'error',
    detail: `missing doc-coverage block; required: ${expected.required.join(', ')}` }];
  return expected.required.flatMap((surface) => {
    const value = findSurfaceValue(block, surface);
    if (!value) return [{ rule: 'doc-coverage-missing', severity: 'error',
      detail: `required surface "${surface}" not found in doc-coverage block` }];
    const violation = valueViolation(surface, value);
    return violation ? [violation] : [];
  });
}

function validate(input) {
  const lane = input.lane || '';
  if (LANE_SKIP.has(lane)) return { ok: true, violations: [], reason: 'lane-skip' };
  let matrix;
  try { matrix = loadMatrix(); } catch (e) {
    return { ok: false, violations: [{ rule: 'doc-coverage-matrix-load-failed',
      severity: 'error', detail: e.message }] };
  }
  if (!Object.keys(matrix).length) return { ok: false, violations: [{
    rule: 'doc-coverage-missing', severity: 'error',
    detail: 'doc-coverage matrix is empty — check config files' }] };
  const changeType = input.change_type || null;
  const handoff = (input.comments || []).slice().reverse()
    .find(c => /(^|\n)\s*(?:##\s*)?COLLABORATOR_HANDOFF\b/i.test(c.body || ''));
  const body = handoff ? handoff.body : (input.body || '');
  const violations = checkBlock(body, input.labels, matrix, changeType);
  return { ok: violations.length === 0, violations };
}

module.exports = { validate, loadMatrix, parseYamlSurfaces, surfacesForLabels,
  parseDocBlock, checkBlock };
