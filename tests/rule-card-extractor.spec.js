// tests/rule-card-extractor.spec.js — tdd-pyramid tests for rule-card-extractor
// Refs #2301 (Epic #2295 Phase-1 P1.2). test_strategy: tdd-pyramid
'use strict';

const { test, expect } = require('@playwright/test');
const path = require('node:path');
const fs = require('node:fs');
const yaml = require('js-yaml');

const {
  extractFromInstructions,
  extractFromTemplate,
  extractFromWorkflow,
  extractFromValidator,
  extractFromHook,
  extractFromPrecommit,
  extractFromConfigSchema,
  extractAll,
  VALID_CLASSES,
  VALID_SEVERITIES,
  makeCard,
} = require('../scripts/global/rule-card-extractor.js');

const FIXTURES = path.resolve(__dirname, 'fixtures', 'rule-card-extractor');
const ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// makeCard defaults
// ---------------------------------------------------------------------------
test('makeCard returns all required fields', () => {
  const card = makeCard({ rule_id: 'test-id', statement: 'A statement.' });
  expect(card).toHaveProperty('rule_id', 'test-id');
  expect(card).toHaveProperty('class', 'doc-vs-no-enforcement');
  expect(card).toHaveProperty('statement', 'A statement.');
  expect(card).toHaveProperty('enum_values');
  expect(Array.isArray(card.enum_values)).toBe(true);
  expect(card).toHaveProperty('severity', 'advisory');
  expect(card).toHaveProperty('cross_runtime_applicability');
});

test('makeCard rejects invalid severity — falls back to advisory', () => {
  const card = makeCard({ rule_id: 'x', severity: 'ultra-critical' });
  expect(card.severity).toBe('advisory');
});

test('makeCard preserves valid severity values', () => {
  for (const sev of VALID_SEVERITIES) {
    expect(makeCard({ rule_id: 'x', severity: sev }).severity).toBe(sev);
  }
});

// ---------------------------------------------------------------------------
// Adapter 1: extractFromInstructions
// ---------------------------------------------------------------------------
test.describe('extractFromInstructions', () => {
  const fixture = path.join(FIXTURES, 'sample-instruction.md');

  test('extracts HTML-comment rule-card', () => {
    const cards = extractFromInstructions(fixture);
    const htmlCard = cards.find(c => c.rule_id === 'test-html-comment');
    expect(htmlCard).toBeTruthy();
    expect(htmlCard.class).toBe('doc-vs-enforcement');
    expect(htmlCard.severity).toBe('hard-mandatory');
  });

  test('extracts fenced rule-card block', () => {
    const cards = extractFromInstructions(fixture);
    const fenced = cards.find(c => c.rule_id === 'test-fenced-block');
    expect(fenced).toBeTruthy();
    expect(fenced.class).toBe('enum-drift');
    expect(fenced.enum_values).toContain('val-a');
    expect(fenced.enum_values).toContain('val-b');
  });

  test('source field is relative repo path', () => {
    const cards = extractFromInstructions(fixture);
    for (const card of cards) {
      expect(card.source).not.toContain(ROOT);
      expect(card.source).toMatch(/fixtures\/rule-card-extractor/);
    }
  });
});

// ---------------------------------------------------------------------------
// Adapter 2: extractFromTemplate
// ---------------------------------------------------------------------------
test.describe('extractFromTemplate', () => {
  const fixture = path.join(FIXTURES, 'sample-template.md');

  test('extracts HTML-comment rule-card from template', () => {
    const cards = extractFromTemplate(fixture);
    expect(cards.length).toBeGreaterThanOrEqual(1);
    const card = cards.find(c => c.rule_id === 'test-template-enum');
    expect(card).toBeTruthy();
    expect(card.enum_values).toContain('option-a');
  });
});

// ---------------------------------------------------------------------------
// Adapter 3: extractFromWorkflow
// ---------------------------------------------------------------------------
test.describe('extractFromWorkflow', () => {
  const fixture = path.join(FIXTURES, 'sample-workflow.yml');

  test('extracts inline types enum', () => {
    const cards = extractFromWorkflow(fixture);
    const inline = cards.find(c => c.rule_id.includes('sample-workflow'));
    expect(inline).toBeTruthy();
    expect(inline.enum_values).toContain('opened');
    expect(inline.enum_values).toContain('labeled');
  });

  test('extracts multi-line types list', () => {
    const cards = extractFromWorkflow(fixture);
    const ml = cards.find(c => c.rule_id.includes('multiline'));
    expect(ml).toBeTruthy();
    expect(ml.enum_values).toContain('synchronize');
    expect(ml.enum_values).toContain('closed');
  });

  test('emitted cards have valid class', () => {
    const cards = extractFromWorkflow(fixture);
    for (const card of cards) {
      expect(VALID_CLASSES).toContain(card.class);
    }
  });
});

// ---------------------------------------------------------------------------
// Adapter 4: extractFromValidator
// ---------------------------------------------------------------------------
test.describe('extractFromValidator', () => {
  const fixture = path.join(FIXTURES, 'sample-validator.js');

  test('extracts ALLOWED_STRATEGIES constant', () => {
    const cards = extractFromValidator(fixture);
    const card = cards.find(c => c.rule_id.includes('allowed-strategies'));
    expect(card).toBeTruthy();
    expect(card.enum_values).toContain('tdd-pyramid');
    expect(card.enum_values).toContain('peer-review');
  });

  test('extracts LIGHTWEIGHT constant', () => {
    const cards = extractFromValidator(fixture);
    const card = cards.find(c => c.rule_id.includes('lightweight'));
    expect(card).toBeTruthy();
    expect(card.enum_values).toContain('lane:trivial');
  });

  test('severity is hard-mandatory for validator consts', () => {
    const cards = extractFromValidator(fixture);
    for (const card of cards) {
      expect(card.severity).toBe('hard-mandatory');
    }
  });
});

// ---------------------------------------------------------------------------
// Adapter 5: extractFromHook
// ---------------------------------------------------------------------------
test.describe('extractFromHook', () => {
  const fixture = path.join(FIXTURES, 'sample-hook.py');

  test('extracts Python list constant', () => {
    const cards = extractFromHook(fixture);
    const card = cards.find(c => c.rule_id.includes('allowed-lanes'));
    expect(card).toBeTruthy();
    expect(card.enum_values).toContain('lane:code-change');
  });

  test('extracts Python tuple constant', () => {
    const cards = extractFromHook(fixture);
    const card = cards.find(c => c.rule_id.includes('terminal-states'));
    expect(card).toBeTruthy();
    expect(card.enum_values).toContain('status:done');
    expect(card.enum_values).toContain('status:cancelled');
  });
});

// ---------------------------------------------------------------------------
// Adapter 6: extractFromPrecommit
// ---------------------------------------------------------------------------
test.describe('extractFromPrecommit', () => {
  const fixture = path.join(FIXTURES, 'sample-lefthook.yml');

  test('extracts command names as enum_values', () => {
    const cards = extractFromPrecommit(fixture);
    expect(cards.length).toBeGreaterThanOrEqual(1);
    const card = cards[0];
    expect(card.enum_values).toContain('docs-check');
    expect(card.enum_values).toContain('lint-check');
  });

  test('rule_id is lefthook-pre-commit-commands', () => {
    const cards = extractFromPrecommit(fixture);
    expect(cards[0].rule_id).toBe('lefthook-pre-commit-commands');
  });

  test('severity is hard-mandatory', () => {
    const cards = extractFromPrecommit(fixture);
    expect(cards[0].severity).toBe('hard-mandatory');
  });
});

// ---------------------------------------------------------------------------
// Adapter 7: extractFromConfigSchema
// ---------------------------------------------------------------------------
test.describe('extractFromConfigSchema', () => {
  const fixture = path.join(FIXTURES, 'sample-schema.json');

  test('extracts enum arrays from JSON schema', () => {
    const cards = extractFromConfigSchema(fixture);
    expect(cards.length).toBeGreaterThanOrEqual(1);
    const laneCard = cards.find(c => c.rule_id.includes('lane'));
    expect(laneCard).toBeTruthy();
    expect(laneCard.enum_values).toContain('lane:code-change');
  });

  test('returns empty array for invalid JSON', () => {
    const tmpFile = path.join(FIXTURES, '_bad.json');
    fs.writeFileSync(tmpFile, '{ invalid json !!');
    const cards = extractFromConfigSchema(tmpFile);
    expect(cards).toEqual([]);
    fs.unlinkSync(tmpFile);
  });
});

// ---------------------------------------------------------------------------
// Round-trip: extract → serialize → parse yields bit-identical cards
// ---------------------------------------------------------------------------
test.describe('round-trip serialization', () => {
  const fixture = path.join(FIXTURES, 'sample-validator.js');

  test('JSON round-trip is bit-identical for validator cards', () => {
    const original = extractFromValidator(fixture);
    const serialized = JSON.stringify(original);
    const parsed = JSON.parse(serialized);
    expect(parsed).toEqual(original);
  });

  test('JSON round-trip is bit-identical for instruction cards', () => {
    const fixture2 = path.join(FIXTURES, 'sample-instruction.md');
    const original = extractFromInstructions(fixture2);
    const serialized = JSON.stringify(original);
    const parsed = JSON.parse(serialized);
    expect(parsed).toEqual(original);
  });
});

// ---------------------------------------------------------------------------
// governance-rules.yaml schema validation
// ---------------------------------------------------------------------------
test.describe('governance-rules.yaml schema', () => {
  const yamlPath = path.join(ROOT, 'config', 'governance-rules.yaml');

  test('governance-rules.yaml parses without error', () => {
    expect(() => yaml.load(fs.readFileSync(yamlPath, 'utf8'))).not.toThrow();
  });

  test('has version: 1', () => {
    const doc = yaml.load(fs.readFileSync(yamlPath, 'utf8'));
    expect(doc.version).toBe(1);
  });

  test('has at least 5 seed rules', () => {
    const doc = yaml.load(fs.readFileSync(yamlPath, 'utf8'));
    expect(doc.rules.length).toBeGreaterThanOrEqual(5);
  });

  test('each rule has required fields', () => {
    const doc = yaml.load(fs.readFileSync(yamlPath, 'utf8'));
    for (const rule of doc.rules) {
      expect(typeof rule.rule_id).toBe('string');
      expect(rule.rule_id.length).toBeGreaterThan(0);
      expect(VALID_CLASSES).toContain(rule.class);
      expect(typeof rule.statement).toBe('string');
      expect(rule.statement.trim().length).toBeGreaterThan(0);
      expect(VALID_SEVERITIES).toContain(rule.severity);
      expect(Array.isArray(rule.enum_values)).toBe(true);
      expect(Array.isArray(rule.cross_runtime_applicability)).toBe(true);
    }
  });

  test('rule_ids are unique', () => {
    const doc = yaml.load(fs.readFileSync(yamlPath, 'utf8'));
    const ids = doc.rules.map(r => r.rule_id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

// ---------------------------------------------------------------------------
// extractAll — integration: finds seed rules from governance-rules.yaml
// ---------------------------------------------------------------------------
test.describe('extractAll integration', () => {
  test('returns at least 10 cards from the live harness', () => {
    const cards = extractAll({ root: ROOT });
    expect(cards.length).toBeGreaterThanOrEqual(10);
  });

  test('all emitted cards have the 7 required fields', () => {
    const cards = extractAll({ root: ROOT });
    const REQUIRED = [
      'rule_id', 'class', 'statement', 'source',
      'enum_values', 'severity', 'cross_runtime_applicability',
    ];
    for (const card of cards) {
      for (const field of REQUIRED) {
        expect(card).toHaveProperty(field);
      }
    }
  });

  test('finds at least 5 seed rule_ids from governance-rules.yaml via extractAll', () => {
    const yamlPath = path.join(ROOT, 'config', 'governance-rules.yaml');
    const doc = yaml.load(fs.readFileSync(yamlPath, 'utf8'));
    const seedIds = doc.rules.map(r => r.rule_id);

    // extractAll finds cards from validators + workflows which include values
    // from seed rules (lane-enum, test-strategy-enum, single-status, branch-name).
    // We verify coverage by checking that lane and test-strategy enums appear.
    const cards = extractAll({ root: ROOT });
    const allEnumValues = cards.flatMap(c => c.enum_values);

    // lane-enum-values seed: at least 3 lane values present in extracted enums
    const laneVals = ['lane:code-change', 'lane:trivial', 'lane:config-only'];
    const foundLanes = laneVals.filter(v => allEnumValues.includes(v));
    expect(foundLanes.length).toBeGreaterThanOrEqual(3);

    // test-strategy-enum-values seed: tdd-pyramid must appear
    expect(allEnumValues).toContain('tdd-pyramid');

    // single-status-invariant seed: status values must appear
    expect(allEnumValues).toContain('status:done');
    expect(allEnumValues).toContain('status:in-progress');

    // branch-name-prefix-enum seed: feat and fix must appear
    expect(allEnumValues).toContain('feat');
    expect(allEnumValues).toContain('fix');

    // Confirm at least 5 distinct seed rule ids have evidence
    const matchedSeeds = seedIds.filter(id => {
      const enumsFromSeed = doc.rules.find(r => r.rule_id === id).enum_values;
      if (enumsFromSeed.length === 0) return false;
      return enumsFromSeed.some(v => allEnumValues.includes(v));
    });
    expect(matchedSeeds.length).toBeGreaterThanOrEqual(5);
  });

  test('cards with class=enum-drift have at least one enum_value', () => {
    const cards = extractAll({ root: ROOT });
    const enumDrift = cards.filter(c => c.class === 'enum-drift');
    expect(enumDrift.length).toBeGreaterThan(0);
    for (const card of enumDrift) {
      expect(card.enum_values.length).toBeGreaterThan(0);
    }
  });
});
