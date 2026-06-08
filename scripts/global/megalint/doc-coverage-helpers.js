'use strict';
// Refs #2714 — N/A reason enum helpers for doc-coverage validator
const fs = require('fs');
const path = require('path');

const CFG = path.join(__dirname, '..', '..', '..', 'config');
const NA_REASONS_PATH = path.join(CFG, 'doc-coverage-na-reasons.json');
const CHANGE_TYPES_PATH = path.join(CFG, 'doc-coverage-change-types.yml');

const loadNaReasons = () => { try { return Object.keys(JSON.parse(fs.readFileSync(NA_REASONS_PATH, 'utf8')).reasons); } catch (_) { return null; } };

function parseChangeTypes(text) {
  const out = {}; let cur = null; let field = null;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\s+$/, '');
    if (!line || line.startsWith('#') || /^version:|^change_types:/.test(line)) continue;
    const typeMatch = line.match(/^  ([\w-]+):$/);
    if (typeMatch) { cur = typeMatch[1]; out[cur] = { require_additional: [], demote_to_suggested: [] }; field = null; continue; }
    const fieldMatch = line.match(/^    (require_additional|demote_to_suggested):$/);
    if (fieldMatch && cur) { field = fieldMatch[1]; continue; }
    const itemMatch = line.match(/^      -\s+(.+)$/);
    if (itemMatch && cur && field) out[cur][field].push(itemMatch[1].trim());
  }
  return out;
}

const loadChangeTypes = () => { try { return parseChangeTypes(fs.readFileSync(CHANGE_TYPES_PATH, 'utf8')); } catch (_) { return {}; } };

// Refs #2713 — load split matrix files and merge
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

const MATRIX_FILES = ['doc-coverage-matrix-core.yml', 'doc-coverage-matrix-extended.yml'];

function loadMatrix(matrixDir) {
  const dir = matrixDir || CFG; const merged = {};
  for (const f of MATRIX_FILES) { const fp = path.join(dir, f); if (fs.existsSync(fp)) Object.assign(merged, parseYamlSurfaces(fs.readFileSync(fp, 'utf8'))); }
  return merged;
}

function surfacesForLabels(labels, matrix, changeType) {
  const required = new Set(); const suggested = new Set();
  for (const label of labels || []) {
    const entry = matrix[label];
    if (!entry) continue;
    for (const item of entry.required || []) required.add(item);
    for (const item of entry.suggested || []) suggested.add(item);
  }
  if (changeType) {
    const types = loadChangeTypes();
    const ct = types[changeType];
    if (ct) {
      for (const s of ct.require_additional || []) required.add(s);
      for (const s of ct.demote_to_suggested || []) { required.delete(s); suggested.add(s); }
    }
  }
  return { required: [...required].sort(), suggested: [...suggested].sort() };
}

function valueViolation(surface, value) {
  if (/^(?:DONE|UPDATED)(?:\b|\s*[—:-])/i.test(value)) return null;
  if (/^N\/A\b/i.test(value)) {
    const raw = String(value).replace(/^N\/A\b\s*(?:[—:-]\s*)?/i, '').trim();
    if (!raw) return { rule: 'doc-coverage-missing', severity: 'error',
      detail: `surface "${surface}" has bare N/A without reason` };
    const validReasons = loadNaReasons();
    if (validReasons) {
      const reason = raw.split(/[\s:#]/)[0];
      if (!validReasons.includes(reason)) return { rule: 'doc-coverage-invalid-na', severity: 'error',
        detail: `surface "${surface}" N/A reason "${reason}" not in enum (${validReasons.join(', ')})` };
    }
    return null;
  }
  return { rule: 'doc-coverage-missing', severity: 'error',
    detail: `surface "${surface}" must be DONE/UPDATED or N/A — <reason>` };
}

module.exports = { loadNaReasons, loadChangeTypes, loadMatrix, parseYamlSurfaces,
  surfacesForLabels, valueViolation, MATRIX_FILES };
