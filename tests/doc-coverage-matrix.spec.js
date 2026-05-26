// Refs #2155 - golden-file tests for doc-coverage matrix
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadMatrix, parseYamlSurfaces, surfacesForLabels } = require('../scripts/global/megalint/doc-coverage.js');

const MATRIX_PATH = path.join(__dirname, '..', 'config', 'doc-coverage-matrix.yml');

test('matrix file exists', () => {
  assert.ok(fs.existsSync(MATRIX_PATH));
});

test('matrix has version field', () => {
  const text = fs.readFileSync(MATRIX_PATH, 'utf8');
  assert.match(text, /^version:\s*1$/m);
});

test('matrix has no YAML anchors (fleet-model-parseable)', () => {
  const text = fs.readFileSync(MATRIX_PATH, 'utf8');
  assert.equal(/(^|[^a-z])&\w+/.test(text), false, 'YAML anchors found');
  assert.equal(/<<:/.test(text), false, 'YAML merge keys found');
});

test('loadMatrix returns parseable surfaces', () => {
  const matrix = loadMatrix();
  assert.ok(matrix['area:governance']);
  assert.ok(Array.isArray(matrix['area:governance'].required));
  assert.ok(Array.isArray(matrix['area:governance'].suggested));
});

test('parseYamlSurfaces handles golden fixture', () => {
  const fixture = [
    'version: 1',
    'surfaces:',
    '  area:test:',
    '    required:',
    '      - foo.md',
    '    suggested:',
    '      - bar.md',
    '      - baz.md',
  ].join('\n');
  const parsed = parseYamlSurfaces(fixture);
  assert.deepEqual(parsed['area:test'], { required: ['foo.md'], suggested: ['bar.md', 'baz.md'] });
});

test('surfacesForLabels unions across labels', () => {
  const matrix = { 'area:a': { required: ['x.md'], suggested: [] }, 'area:b': { required: ['y.md'], suggested: ['z.md'] } };
  const out = surfacesForLabels(['area:a', 'area:b'], matrix);
  assert.deepEqual(out.required, ['x.md', 'y.md']);
  assert.deepEqual(out.suggested, ['z.md']);
});

test('surfacesForLabels returns empty for unknown labels', () => {
  const out = surfacesForLabels(['area:unknown'], { 'area:known': { required: ['a.md'], suggested: [] } });
  assert.deepEqual(out, { required: [], suggested: [] });
});

test('matrix entries all have required + suggested arrays', () => {
  const matrix = loadMatrix();
  for (const area of Object.keys(matrix)) {
    assert.ok(Array.isArray(matrix[area].required), `${area} missing required[]`);
    assert.ok(Array.isArray(matrix[area].suggested), `${area} missing suggested[]`);
  }
});

test('golden-file: parses tests/fixtures/doc-coverage/sample-matrix.yml to expected output', () => {
  const fixturePath = path.join(__dirname, 'fixtures', 'doc-coverage', 'sample-matrix.yml');
  const expectedPath = path.join(__dirname, 'fixtures', 'doc-coverage', 'expected-parse.json');
  const text = fs.readFileSync(fixturePath, 'utf8');
  const expected = JSON.parse(fs.readFileSync(expectedPath, 'utf8'));
  const parsed = parseYamlSurfaces(text);
  assert.deepEqual(parsed, expected);
});
