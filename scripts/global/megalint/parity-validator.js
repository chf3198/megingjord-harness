'use strict';
// parity-validator.js — compares expected (governance-rules.yaml) vs actual
// (rule-card-extractor) harness rule-card sets. Refs #2306 (Epic #2295 P1.6).
// Sentinel severity model: new conflicts block PRs; pre-existing are advisory.
// CommonJS for cross-runtime portability (Claude Code / Codex / Copilot).

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { extractAll } = require('../rule-card-extractor.js');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const RULES_YAML = path.join(ROOT, 'config', 'governance-rules.yaml');
const CARVE_OUTS_MD = path.join(ROOT, 'governance-carve-outs', 'index.md');
const BACKFILL_OUT = path.join(
  process.env.HOME || '/tmp', '.megingjord', 'enforcement-lag-backfill-candidates.txt');
const INSTRUCTIONS_DIR = path.join(ROOT, 'instructions');

// ---------------------------------------------------------------------------
// Carve-out registry loader
// ---------------------------------------------------------------------------

function loadCarveOuts() {
  try {
    const src = fs.readFileSync(CARVE_OUTS_MD, 'utf8');
    const ids = [];
    for (const match of src.matchAll(/\*\*rule_id\*\*\s*:\s*`([^`]+)`/g)) ids.push(match[1]);
    for (const match of src.matchAll(/^`([^`]+)`\s*\|/gm)) ids.push(match[1]);
    return new Set(ids);
  } catch { return new Set(); }
}

// ---------------------------------------------------------------------------
// MUST-without-enforcer backfill helpers
// ---------------------------------------------------------------------------

function scanMustStatements() {
  const candidates = [];
  if (!fs.existsSync(INSTRUCTIONS_DIR)) return candidates;
  const files = fs.readdirSync(INSTRUCTIONS_DIR)
    .filter(fname => fname.endsWith('.md'))
    .map(fname => path.join(INSTRUCTIONS_DIR, fname));
  for (const fp of files) {
    try {
      fs.readFileSync(fp, 'utf8').split('\n').forEach((line, idx) => {
        if (/\bMUST\b/.test(line) && !/pending-enforcement\s*:/i.test(line)) {
          candidates.push({ file: path.relative(ROOT, fp), line: idx + 1, text: line.trim() });
        }
      });
    } catch { /* skip unreadable files */ }
  }
  return candidates;
}

function writeBackfillCandidates(candidates) {
  try {
    const dir = path.dirname(BACKFILL_OUT);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(BACKFILL_OUT, candidates.map(
      cand => `${cand.file}:${cand.line}: ${cand.text}`).join('\n') + '\n', 'utf8');
  } catch { /* best-effort */ }
}

// ---------------------------------------------------------------------------
// Core equivalence helpers
// ---------------------------------------------------------------------------

function enumsDisjoint(enumA, enumB) {
  if (!enumA.length && !enumB.length) return false;
  const setA = new Set(enumA);
  const setB = new Set(enumB);
  for (const val of setA) if (!setB.has(val)) return true;
  for (const val of setB) if (!setA.has(val)) return true;
  return false;
}

function statementContradicts(s1, s2) {
  if (!s1 || !s2) return false;
  const norm = str => str.replace(/\s+/g, ' ').trim().toLowerCase();
  return norm(s1) !== norm(s2);
}

// ---------------------------------------------------------------------------
// Conflict builders (keeps compare() within length budget)
// ---------------------------------------------------------------------------

function buildNoEnforcerConflict(expected, prIntro) {
  const hasPending = /pending-enforcement\s*:/i.test(expected.statement || '');
  return {
    id: `${expected.rule_id}--no-enforcer`, class: 'doc-vs-no-enforcement',
    rule_id: expected.rule_id, doc_card: expected, gate_card: null,
    severity: hasPending ? 'advisory' : 'hard-mandatory',
    pr_introduced: prIntro, carve_out_match: false,
    remediation_ticket: expected.pending_enforcement || null,
  };
}

function buildEnumConflict(expected, actual, prIntro) {
  return {
    id: `${expected.rule_id}--enum-drift`,
    class: actual.class === 'enforcement-vs-enforcement'
      ? 'enforcement-vs-enforcement' : 'enum-drift',
    rule_id: expected.rule_id, doc_card: expected, gate_card: actual,
    severity: 'hard-mandatory', pr_introduced: prIntro,
    carve_out_match: false, remediation_ticket: null,
  };
}

function buildStatementConflict(expected, actual, prIntro) {
  return {
    id: `${expected.rule_id}--statement-conflict`,
    class: expected.class === 'authority-carve-out'
      ? 'authority-carve-out' : 'doc-vs-enforcement',
    rule_id: expected.rule_id, doc_card: expected, gate_card: actual,
    severity: 'soft-mandatory', pr_introduced: prIntro,
    carve_out_match: false, remediation_ticket: null,
  };
}

// ---------------------------------------------------------------------------
// Main comparison engine
// ---------------------------------------------------------------------------

function compare(expectedRules, actualCards, carveOuts, prDiff) {
  const conflicts = [];
  const byId = new Map();
  for (const card of actualCards) {
    if (!byId.has(card.rule_id)) byId.set(card.rule_id, []);
    byId.get(card.rule_id).push(card);
  }
  for (const expected of expectedRules) {
    const actual = (byId.get(expected.rule_id) || [])[0];
    const prIntro = prDiff ? prDiff.includes(expected.rule_id) : false;
    if (!actual) { conflicts.push(buildNoEnforcerConflict(expected, prIntro)); continue; }
    if (enumsDisjoint(expected.enum_values || [], actual.enum_values || [])) {
      conflicts.push(buildEnumConflict(expected, actual, prIntro));
    }
    if (statementContradicts(expected.statement, actual.statement)) {
      if (!carveOuts.has(expected.rule_id)) {
        conflicts.push(buildStatementConflict(expected, actual, prIntro));
      }
    }
  }
  return conflicts;
}

// ---------------------------------------------------------------------------
// Sentinel gate decision
// ---------------------------------------------------------------------------

function applyGate(conflicts) {
  for (const conflict of conflicts) {
    conflict.gate_decision =
      (conflict.pr_introduced && conflict.severity === 'hard-mandatory')
        ? 'block' : 'advisory';
  }
  return conflicts;
}

// ---------------------------------------------------------------------------
// Entry point (injectable for tests)
// ---------------------------------------------------------------------------

function run(opts) {
  const options = opts || {};
  let yamlDoc;
  try {
    yamlDoc = yaml.load(fs.readFileSync(RULES_YAML, 'utf8'));
  } catch (err) {
    return {
      ts: new Date().toISOString(), version: 1,
      error: `governance-rules.yaml parse failure: ${err.message}`,
      conflicts: [],
    };
  }
  const expectedRules = (yamlDoc && yamlDoc.rules) || [];
  const actualCards = options.actualCards !== undefined
    ? options.actualCards : extractAll({ root: ROOT });
  const carveOuts = options.carveOuts !== undefined
    ? options.carveOuts : loadCarveOuts();
  const rawConflicts = compare(expectedRules, actualCards, carveOuts,
    options.prDiff || null);
  const conflicts = applyGate(rawConflicts);
  if (options.backfill !== false) writeBackfillCandidates(scanMustStatements());
  return { ts: new Date().toISOString(), version: 1, conflicts };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

if (require.main === module) {
  const args = process.argv.slice(2);
  const result = run({ backfill: args.includes('--full') });
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  const blocking = result.conflicts.filter(item => item.gate_decision === 'block');
  if (blocking.length > 0) {
    process.stderr.write(`PARITY ERROR: ${blocking.length} blocking conflict(s).\n`);
    process.exit(1);
  }
}

module.exports = { run, compare, applyGate, loadCarveOuts, scanMustStatements };
