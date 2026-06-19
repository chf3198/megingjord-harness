#!/usr/bin/env node
// Lint — enforce the 100-line design contract
//
// The 100-line limit is a DESIGN RULE, not a content budget.
// The correct response to hitting the limit is to SPLIT into linked files,
// never to compress or omit content.
//
// Split-and-link pattern (by file type):
//   Markdown doc  → nav/overview file + companion detail files
//   JS/TS module  → extract functions into util/helper modules
//   CSS file      → extract component rules into scoped stylesheets
//   HTML file     → extract repeated sections into partials/includes
//   Shell script  → extract subroutines into sourced lib scripts
//
// Canonical guide: docs/howto/100-line-design-contract.md
// Usage: node scripts/lint.js

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LIMIT = 100;

const IGNORE = [
  'node_modules', '.git', 'playwright-report',
  'test-results', 'package-lock.json', '.dashboard',
  'logs', '.claude', '.log4brains', '.worktrees',
  // Generated artifacts (rebuilt on demand; not committed)
  'generated',
  // Global resources have their own governance
  'skills', 'hooks'
];

const IGNORE_PATHS = ['scripts/global', 'scripts/wiki', 'instructions', 'research', 'docs/howto', 'raw', 'planning', 'wiki/wisdom', 'wiki/code', 'wiki/work-log', 'tests'];
const IGNORE_FILES = [
  'CHANGELOG.md', 'CHANGELOG-archive.md',
  // Append-only / catalog files that grow by design
  'log.md', 'index.md',
  // Compiled README — generated section grows with package.json (#796)
  'README.md',
  // Project manifests that grow with deps/scripts — managed by npm tooling
  'package.json',
  // Signer registry grows with teams × roles × key rotations (#1716 Phase 3.3)
  'team-model-signatures.json',
  // Parity registry grows with surfaces × runtimes × features — catalog by design (#1912)
  'orchestrator-governance-parity.json',
  // JSON schemas (standard third-party metadata)
  'claude-code-settings.schema.json',
  // Governance policy catalog — grows by design as decision rules are added
  'governance-decision-policy.json',
  // Adapter emit manifest — grows with runtimes × governance units (#3103)
  'governance-manifest.sample.json',
];

const EXTS = ['.js', '.html', '.css', '.md', '.sh', '.json'];

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE.includes(entry.name)) continue;
    if (IGNORE_FILES.includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    const rel = path.relative(ROOT, full);
    if (IGNORE_PATHS.some(p => rel.startsWith(p))) continue;
    if (entry.isDirectory()) {
      files.push(...walk(full));
    } else if (EXTS.includes(path.extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

let violations = 0;
let total = 0;

for (const file of walk(ROOT)) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.endsWith('\n') ? content.split('\n').length - 1 : content.split('\n').length;
  const rel = path.relative(ROOT, file);
  total++;
  if (lines > LIMIT) {
    console.error(`❌ ${rel}: ${lines} lines (limit ${LIMIT})`);
    console.error(`   → Split into linked files — do not compress content.`);
    console.error(`   → Guide: docs/howto/100-line-design-contract.md`);
    violations++;
  }
}

console.log(`\nScanned ${total} files.`);
if (violations > 0) {
  console.error(`${violations} file(s) exceed ${LIMIT}-line limit.`);
  process.exit(1);
} else {
  console.log(`✅ All files within ${LIMIT}-line limit.`);
}
