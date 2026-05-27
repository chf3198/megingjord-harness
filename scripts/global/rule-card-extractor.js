#!/usr/bin/env node
// rule-card-extractor.js — 8 typological adapters for governance rule-card
// extraction. Refs #2301 (Epic #2295 Phase-1 child P1.2).
// CommonJS for max cross-runtime portability (Claude Code/Codex/Copilot/Antigravity).
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const VALID_CLASSES = [
  'doc-vs-enforcement', 'enforcement-vs-enforcement', 'enum-drift',
  'doc-vs-no-enforcement', 'authority-carve-out',
  'cross-runtime-fragmentation', 'maintenance-drift',
  'context-substituting-for-guardrail',
];
const VALID_SEVERITIES = ['advisory', 'soft-mandatory', 'hard-mandatory'];

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function rel(absPath) {
  return path.relative(ROOT, absPath).replace(/\\/g, '/');
}

function makeCard(fields) {
  return {
    rule_id: fields.rule_id || '',
    class: fields.class || 'doc-vs-no-enforcement',
    statement: (fields.statement || '').trim(),
    source: fields.source || '',
    enum_values: Array.isArray(fields.enum_values) ? fields.enum_values : [],
    severity: VALID_SEVERITIES.includes(fields.severity)
      ? fields.severity : 'advisory',
    cross_runtime_applicability: fields.cross_runtime_applicability || ['all'],
  };
}

function parseKV(raw) {
  const out = {};
  // Multi-line form: one key=value per line (fenced blocks)
  for (const line of raw.split(/\r?\n/)) {
    const ml = line.match(/^\s*([\w_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (ml) { out[ml[1]] = ml[2]; continue; }
  }
  // Single-line form: key=value key2="quoted value" (HTML comments)
  const singleRe = /([\w_]+)=(?:"([^"]*)"|([\S]+))/g;
  let sm;
  while ((sm = singleRe.exec(raw)) !== null) {
    if (!out[sm[1]]) out[sm[1]] = sm[2] !== undefined ? sm[2] : sm[3];
  }
  return out;
}

// ---------------------------------------------------------------------------
// Adapter 1: instructions/*.md — HTML comment blocks + fenced rule-card blocks
// ---------------------------------------------------------------------------
function extractFromInstructions(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  const cards = [];
  const srcRel = rel(filePath);

  // HTML-comment form: <!-- rule-card: rule_id=foo class=bar statement="..." -->
  const htmlRe = /<!--\s*rule-card:\s*([\s\S]*?)-->/g;
  let m;
  while ((m = htmlRe.exec(src)) !== null) {
    const kv = parseKV(m[1]);
    if (kv.rule_id) {
      cards.push(makeCard({ ...kv, source: srcRel,
        enum_values: kv.enum_values ? kv.enum_values.split(',').map(s => s.trim()) : [],
      }));
    }
  }

  // Fenced ```rule-card``` blocks
  const fenceRe = /```rule-card\r?\n([\s\S]*?)```/g;
  while ((m = fenceRe.exec(src)) !== null) {
    const kv = parseKV(m[1]);
    if (kv.rule_id) {
      cards.push(makeCard({ ...kv, source: srcRel,
        enum_values: kv.enum_values ? kv.enum_values.split(',').map(s => s.trim()) : [],
      }));
    }
  }
  return cards;
}

// ---------------------------------------------------------------------------
// Adapter 2: .github templates — HTML-comment-annotated enum lists
// ---------------------------------------------------------------------------
function extractFromTemplate(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  const cards = [];
  const srcRel = rel(filePath);
  const re = /<!--\s*rule-card:\s*([\s\S]*?)-->/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const kv = parseKV(m[1]);
    if (kv.rule_id) {
      cards.push(makeCard({ ...kv, source: srcRel,
        enum_values: kv.enum_values ? kv.enum_values.split(',').map(s => s.trim()) : [],
      }));
    }
  }
  return cards;
}

// ---------------------------------------------------------------------------
// Adapter 3: .github/workflows/*.yml — types: enum blocks in with: sections
// ---------------------------------------------------------------------------
function extractFromWorkflow(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  const srcRel = rel(filePath);
  const cards = [];
  // Capture `types: [a, b, c]` or multi-line `types:\n  - a\n  - b`
  const inlineRe = /types\s*:\s*\[([^\]]+)\]/g;
  let m;
  while ((m = inlineRe.exec(src)) !== null) {
    const vals = m[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''));
    if (vals.length > 1) {
      cards.push(makeCard({
        rule_id: `workflow-types-enum-${path.basename(filePath, '.yml')}`,
        class: 'enum-drift',
        statement: `Workflow ${path.basename(filePath)} constrains event types to a fixed enum.`,
        source: srcRel,
        enum_values: vals,
        severity: 'soft-mandatory',
        cross_runtime_applicability: ['all'],
      }));
    }
  }
  // Multi-line `types:` list
  const mlRe = /\btypes\s*:\s*\n((?:\s+-[^\n]+\n)+)/g;
  while ((m = mlRe.exec(src)) !== null) {
    const vals = m[1].split('\n')
      .map(l => l.replace(/^\s+-\s*/, '').trim())
      .filter(Boolean);
    if (vals.length > 1) {
      cards.push(makeCard({
        rule_id: `workflow-types-multiline-${path.basename(filePath, '.yml')}`,
        class: 'enum-drift',
        statement: `Workflow ${path.basename(filePath)} constrains event types to a fixed enum.`,
        source: srcRel,
        enum_values: vals,
        severity: 'soft-mandatory',
        cross_runtime_applicability: ['all'],
      }));
    }
  }
  return cards;
}

// ---------------------------------------------------------------------------
// Adapter 4: scripts/global/megalint/*.js — hardcoded const arrays
// ---------------------------------------------------------------------------
function extractFromValidator(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  const srcRel = rel(filePath);
  const cards = [];
  // Match: const NAME = ['a', 'b', ...]  or  const NAME = ["a","b",...]
  const re = /const\s+([A-Z_][A-Z0-9_]*)\s*=\s*\[([^\]]+)\]/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const vals = m[2].split(',')
      .map(s => s.trim().replace(/^['"`]|['"`]$/g, ''))
      .filter(Boolean);
    if (vals.length > 1) {
      const constName = m[1];
      cards.push(makeCard({
        rule_id: `validator-const-${constName.toLowerCase().replace(/_/g, '-')}`
          + `-${path.basename(filePath, '.js')}`,
        class: 'enum-drift',
        statement: `Validator ${path.basename(filePath)} enforces ${constName} as a fixed set.`,
        source: srcRel,
        enum_values: vals,
        severity: 'hard-mandatory',
        cross_runtime_applicability: ['all'],
      }));
    }
  }
  return cards;
}

// ---------------------------------------------------------------------------
// Adapter 5: hooks/scripts/*.py — Python enum constants
// ---------------------------------------------------------------------------
function extractFromHook(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  const srcRel = rel(filePath);
  const cards = [];
  // Match: NAME = ['a', 'b', ...] or NAME = ("a", "b", ...)
  const re = /([A-Z_][A-Z0-9_]*)\s*=\s*[\[(]([^)\]]+)[\])]/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const vals = m[2].split(',')
      .map(s => s.trim().replace(/^['"]|['"]$/g, ''))
      .filter(s => s.length > 0 && !s.startsWith('#'));
    if (vals.length > 1) {
      cards.push(makeCard({
        rule_id: `hook-const-${m[1].toLowerCase().replace(/_/g, '-')}`
          + `-${path.basename(filePath, '.py')}`,
        class: 'enum-drift',
        statement: `Hook ${path.basename(filePath)} enforces ${m[1]} as a fixed set.`,
        source: srcRel,
        enum_values: vals,
        severity: 'soft-mandatory',
        cross_runtime_applicability: ['all'],
      }));
    }
  }
  return cards;
}

// ---------------------------------------------------------------------------
// Adapter 6: lefthook.yml — commands keys + run values
// ---------------------------------------------------------------------------
function extractFromPrecommit(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  const srcRel = rel(filePath);
  const cards = [];
  // Extract command names from `commands:` blocks
  const cmdNames = [];
  const cmdRe = /^\s{4}([a-z][a-z0-9_-]+)\s*:/gm;
  let m;
  while ((m = cmdRe.exec(src)) !== null) {
    cmdNames.push(m[1]);
  }
  if (cmdNames.length > 0) {
    cards.push(makeCard({
      rule_id: 'lefthook-pre-commit-commands',
      class: 'enforcement-vs-enforcement',
      statement: 'lefthook.yml defines the set of pre-commit/pre-push gates '
        + 'that must all pass before a push is accepted.',
      source: srcRel,
      enum_values: cmdNames,
      severity: 'hard-mandatory',
      cross_runtime_applicability: ['claude-code', 'codex', 'copilot', 'antigravity'],
    }));
  }
  return cards;
}

// ---------------------------------------------------------------------------
// Adapter 7: config/*.schema.json — enum arrays
// ---------------------------------------------------------------------------
function extractFromConfigSchema(filePath) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return [];
  }
  const srcRel = rel(filePath);
  const cards = [];

  function walk(obj, pathParts) {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj.enum) && obj.enum.length > 1) {
      const propName = pathParts[pathParts.length - 1] || 'root';
      cards.push(makeCard({
        rule_id: `schema-enum-${path.basename(filePath, '.json')}-${propName}`
          .replace(/[^a-z0-9-]/gi, '-').toLowerCase(),
        class: 'enum-drift',
        statement: `Schema ${path.basename(filePath)} constrains `
          + `${pathParts.join('.')} to an enum.`,
        source: srcRel,
        enum_values: obj.enum.map(String),
        severity: 'soft-mandatory',
        cross_runtime_applicability: ['all'],
      }));
    }
    for (const [k, v] of Object.entries(obj)) {
      if (k !== 'enum' && v && typeof v === 'object') walk(v, [...pathParts, k]);
    }
  }
  walk(data, []);
  return cards;
}

// ---------------------------------------------------------------------------
// Adapter 8: gh label list — best-effort live label enum
// ---------------------------------------------------------------------------
function extractFromLabels() {
  try {
    const out = cp.execFileSync('gh', ['label', 'list', '--json', 'name', '--limit', '200'],
      { stdio: ['pipe', 'pipe', 'pipe'], timeout: 10000 });
    const labels = JSON.parse(out.toString()).map(l => l.name);
    if (labels.length === 0) return [];
    const statusVals = labels.filter(l => l.startsWith('status:'));
    const roleVals = labels.filter(l => l.startsWith('role:'));
    const laneVals = labels.filter(l => l.startsWith('lane:'));
    const cards = [];
    if (statusVals.length > 0) {
      cards.push(makeCard({
        rule_id: 'live-labels-status-enum',
        class: 'enum-drift',
        statement: 'Live GitHub label set defines the allowed status:* values.',
        source: 'gh:label-list',
        enum_values: statusVals,
        severity: 'hard-mandatory',
        cross_runtime_applicability: ['all'],
      }));
    }
    if (roleVals.length > 0) {
      cards.push(makeCard({
        rule_id: 'live-labels-role-enum',
        class: 'enum-drift',
        statement: 'Live GitHub label set defines the allowed role:* values.',
        source: 'gh:label-list',
        enum_values: roleVals,
        severity: 'hard-mandatory',
        cross_runtime_applicability: ['all'],
      }));
    }
    if (laneVals.length > 0) {
      cards.push(makeCard({
        rule_id: 'live-labels-lane-enum',
        class: 'enum-drift',
        statement: 'Live GitHub label set defines the allowed lane:* values.',
        source: 'gh:label-list',
        enum_values: laneVals,
        severity: 'hard-mandatory',
        cross_runtime_applicability: ['all'],
      }));
    }
    return cards;
  } catch {
    return []; // best-effort; no gh or no auth
  }
}

// ---------------------------------------------------------------------------
// extractAll — walks harness file tree, unions all adapter outputs
// ---------------------------------------------------------------------------
function extractAll(opts) {
  const rootDir = (opts && opts.root) || ROOT;
  const cards = [];

  function globSync(dir, ext, maxDepth) {
    const results = [];
    function recurse(cur, depth) {
      if (depth > maxDepth) return;
      let entries;
      try { entries = fs.readdirSync(cur, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
        const full = path.join(cur, e.name);
        if (e.isDirectory()) { recurse(full, depth + 1); }
        else if (e.name.endsWith(ext)) results.push(full);
      }
    }
    recurse(dir, 0);
    return results;
  }

  // Adapter 1: instructions
  for (const f of globSync(path.join(rootDir, 'instructions'), '.md', 1)) {
    try { cards.push(...extractFromInstructions(f)); } catch { /* skip */ }
  }

  // Adapter 2: .github templates
  for (const f of [
    path.join(rootDir, '.github', 'PULL_REQUEST_TEMPLATE.md'),
    ...globSync(path.join(rootDir, '.github', 'ISSUE_TEMPLATE'), '.md', 1),
  ]) {
    if (fs.existsSync(f)) {
      try { cards.push(...extractFromTemplate(f)); } catch { /* skip */ }
    }
  }

  // Adapter 3: workflows
  for (const f of globSync(path.join(rootDir, '.github', 'workflows'), '.yml', 1)) {
    try { cards.push(...extractFromWorkflow(f)); } catch { /* skip */ }
  }

  // Adapter 4: megalint validators
  for (const f of globSync(path.join(rootDir, 'scripts', 'global', 'megalint'), '.js', 1)) {
    try { cards.push(...extractFromValidator(f)); } catch { /* skip */ }
  }
  // Also scan scripts/global/*.js for top-level const enums
  for (const f of globSync(path.join(rootDir, 'scripts', 'global'), '.js', 0)) {
    try { cards.push(...extractFromValidator(f)); } catch { /* skip */ }
  }

  // Adapter 5: python hooks
  for (const f of globSync(path.join(rootDir, 'hooks', 'scripts'), '.py', 1)) {
    try { cards.push(...extractFromHook(f)); } catch { /* skip */ }
  }

  // Adapter 6: lefthook
  const lefthook = path.join(rootDir, 'lefthook.yml');
  if (fs.existsSync(lefthook)) {
    try { cards.push(...extractFromPrecommit(lefthook)); } catch { /* skip */ }
  }

  // Adapter 7: config schemas
  for (const f of globSync(path.join(rootDir, 'config'), '.json', 1)) {
    if (f.endsWith('.schema.json')) {
      try { cards.push(...extractFromConfigSchema(f)); } catch { /* skip */ }
    }
  }

  // Adapter 8: live labels (best-effort)
  cards.push(...extractFromLabels());

  return cards;
}

// ---------------------------------------------------------------------------
// CLI entry-point
// ---------------------------------------------------------------------------
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--all')) {
    const cards = extractAll();
    process.stdout.write(JSON.stringify(cards, null, 2) + '\n');
  } else {
    console.error('Usage: node rule-card-extractor.js --all');
    process.exit(1);
  }
}

module.exports = {
  extractFromInstructions,
  extractFromTemplate,
  extractFromWorkflow,
  extractFromValidator,
  extractFromHook,
  extractFromPrecommit,
  extractFromConfigSchema,
  extractFromLabels,
  extractAll,
  VALID_CLASSES,
  VALID_SEVERITIES,
  makeCard,
};
