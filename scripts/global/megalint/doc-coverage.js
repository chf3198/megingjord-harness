'use strict';
// doc-coverage — advisory validator that reads config/doc-coverage-matrix.yml
// and emits a coverage block. Refs #2155.

const fs = require('fs');
const path = require('path');

const MATRIX_PATH = path.join(__dirname, '..', '..', '..', 'config', 'doc-coverage-matrix.yml');

function parseYamlSurfaces(text) {
  const lines = text.split('\n');
  const out = {};
  let area = null;
  let bucket = null;
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
  const text = fs.readFileSync(matrixPath, 'utf8');
  return parseYamlSurfaces(text);
}

function surfacesForLabels(labels, matrix) {
  const required = new Set();
  const suggested = new Set();
  for (const label of labels || []) {
    const entry = matrix[label];
    if (!entry) continue;
    for (const item of entry.required || []) required.add(item);
    for (const item of entry.suggested || []) suggested.add(item);
  }
  return { required: [...required].sort(), suggested: [...suggested].sort() };
}

function validate(input) {
  let matrix;
  try { matrix = loadMatrix(); }
  catch (error) {
    return { ok: true, violations: [], found: false, advisory: `doc-coverage matrix not loadable: ${error.message}` };
  }
  const expected = surfacesForLabels(input.labels, matrix);
  if (!expected.required.length && !expected.suggested.length) {
    return { ok: true, violations: [], advisory: null };
  }
  const advisory = [
    'Doc-coverage advisory:',
    `  required surfaces: ${expected.required.join(', ') || '(none)'}`,
    `  suggested surfaces: ${expected.suggested.join(', ') || '(none)'}`,
  ].join('\n');
  return { ok: true, violations: [], advisory };
}

module.exports = { validate, loadMatrix, parseYamlSurfaces, surfacesForLabels };
