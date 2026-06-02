'use strict';

const fs = require('fs');
const path = require('path');

const MATRIX_PATH = path.join(__dirname, '..', '..', '..', 'config', 'doc-coverage-matrix.yml');
const LANE_SKIP = new Set(['lane:docs-research', 'lane:config-only']);
function parseYamlSurfaces(text) {
  const lines = text.split('\n');
  const out = {};
  let area = null; let bucket = null;
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (!line || line.startsWith('#') || line === 'surfaces:') continue;
    const areaMatch = line.match(/^\s\s([\w:-]+):$/);
    if (areaMatch) { area = areaMatch[1]; out[area] = { required: [], suggested: [] }; bucket = null; continue; }
    const bucketMatch = line.match(/^\s{4}(required|suggested):$/);
    if (bucketMatch) { bucket = bucketMatch[1]; continue; }
    const itemMatch = line.match(/^\s{6}-\s+(.+)$/);
    if (itemMatch && area && bucket) out[area][bucket].push(itemMatch[1].trim());
  }
  return out;
}

function loadMatrix(matrixPath = MATRIX_PATH) {
  return parseYamlSurfaces(fs.readFileSync(matrixPath, 'utf8'));
}

function surfacesForLabels(labels, matrix) {
  const required = new Set(); const suggested = new Set();
  for (const label of labels || []) {
    const entry = matrix[label];
    if (!entry) continue;
    for (const item of entry.required || []) required.add(item);
    for (const item of entry.suggested || []) suggested.add(item);
  }
  return { required: [...required].sort(), suggested: [...suggested].sort() };
}

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

function valueViolation(surface, value) {
  if (/^DONE(?:\b|\s*[—:-])/i.test(value)) return null;
  if (/^N\/A\b/i.test(value)) {
    const reason = String(value).replace(/^N\/A\b\s*(?:[—:-]\s*)?/i, '').trim();
    if (reason) return null;
    return { rule: 'doc-coverage-missing', severity: 'error',
      detail: `required surface "${surface}" has bare N/A without reason` };
  }
  return { rule: 'doc-coverage-missing', severity: 'error',
    detail: `required surface "${surface}" must be DONE or N/A with reason` };
}

function checkBlock(body, labels, matrix) {
  const expected = surfacesForLabels(labels, matrix);
  if (!expected.required.length) return [];
  const block = parseDocBlock(body);
  if (!block) return [{ rule: 'doc-coverage-missing', severity: 'error',
    detail: `missing doc-coverage block; required surfaces: ${expected.required.join(', ')}` }];
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
  if (process.env.DOC_COVERAGE_GATE_ADVISORY === '1') {
    return { ok: true, violations: [], advisory: 'doc-coverage: advisory mode (DOC_COVERAGE_GATE_ADVISORY=1)' };
  }
  let matrix;
  try { matrix = loadMatrix(); }
  catch (e) { return { ok: true, violations: [], advisory: `doc-coverage: matrix not loadable: ${e.message}` }; }
  const handoff = (input.comments || []).slice().reverse()
    .find(c => /(^|\n)\s*(?:##\s*)?COLLABORATOR_HANDOFF\b/i.test(c.body || ''));
  const body = handoff ? handoff.body : (input.body || '');
  const violations = checkBlock(body, input.labels, matrix);
  return { ok: violations.length === 0, violations };
}
module.exports = { validate, loadMatrix, parseYamlSurfaces, surfacesForLabels, parseDocBlock, checkBlock };
