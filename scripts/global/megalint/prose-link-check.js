'use strict';
// prose-link-check (#3297) — deterministic, zero-cost relative-`.md`-link checker for
// PROSE-DOC surfaces: docs/, instructions/, research/, wiki/wisdom/.
//
// Closes the audit-#3296 (AC3) gap: docs-anchors.js checks doc->code anchors and
// docs-health-detector checks orphan/stale, but neither verifies that a prose doc's
// relative [text](other.md) links actually resolve on disk.
//
// Scope (AC1): HAND-AUTHORED prose only. The auto-generated wiki mirrors
// wiki/work-log/ and wiki/code/ are EXCLUDED — their link fidelity is owned by the
// #2055 ingest/auto-update pipeline (root-cause-at-generator, not hand-fix).
//
// Boundary (AC4): doc->code anchors stay with docs-anchors; prompt-artifact structure
// stays with prompt-artifact-lint (#3302). This checks ONLY prose .md->.md relative
// links. See docs/howto/prose-link-check-boundary.md.
//
// Advisory-first (AC3): exits 0 unless --strict. Promotion to blocking is
// replay-eval-gated (no calendar threshold).

const fs = require('node:fs');
const path = require('node:path');

const PROSE_ROOTS = ['docs', 'instructions', 'research', 'wiki/wisdom'];
const EXCLUDED_DIRS = ['wiki/work-log', 'wiki/code', 'node_modules'];
const LINK_RE = /\[[^\]]*\]\(([^)]+)\)/g;

// Links that are not local filesystem targets and must be skipped.
function isExternalOrAnchor(target) {
  return /^(https?:|mailto:|tel:|data:|ftp:|#)/i.test(target) || target.startsWith('<');
}

// Strip a #fragment / ?query suffix off a link target, returning the bare path.
function barePath(target) {
  return target.split('#')[0].split('?')[0].trim();
}

function isExcluded(relPath) {
  const norm = relPath.split(path.sep).join('/');
  return EXCLUDED_DIRS.some(dir => norm === dir || norm.startsWith(dir + '/'));
}

function checkLinks(content, filePath, repoRoot) {
  const findings = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const re = new RegExp(LINK_RE.source, 'g');
    let match;
    while ((match = re.exec(lines[i]))) {
      const target = match[1].trim();
      if (isExternalOrAnchor(target)) continue;
      const clean = barePath(target);
      // Scope: relative .md links only (the audit-#3296 surface). Non-.md relative
      // targets (images, code) are out of scope and owned by other checkers.
      if (!clean || !/\.md$/i.test(clean)) continue;
      if (!fs.existsSync(path.resolve(path.dirname(filePath), clean))) {
        findings.push({ file: path.relative(repoRoot, filePath).split(path.sep).join('/'),
          line: i + 1, rule: 'broken-prose-link',
          detail: `relative .md link target not found: ${clean}` });
      }
    }
  }
  return findings;
}

function lintFile(filePath, opts = {}) {
  const repoRoot = opts.repoRoot || process.cwd();
  let content;
  try { content = fs.readFileSync(filePath, 'utf8'); }
  catch { return [{ file: filePath, rule: 'unreadable', detail: 'cannot read file' }]; }
  return checkLinks(content, filePath, repoRoot);
}

function walk(dir, repoRoot, onFile) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return; }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(repoRoot, full).split(path.sep).join('/');
    if (isExcluded(rel)) continue;
    if (entry.isDirectory()) walk(full, repoRoot, onFile);
    else if (entry.isFile() && full.endsWith('.md')) onFile(full);
  }
}

function collectProseDocs(repoRoot) {
  const out = [];
  for (const root of PROSE_ROOTS) {
    walk(path.join(repoRoot, root), repoRoot, file => out.push(file));
  }
  return out.sort();
}

// validate(paths, opts) — if paths empty, scans the whole prose set under repoRoot.
function validate(paths, opts = {}) {
  const repoRoot = opts.repoRoot || process.cwd();
  const files = (paths && paths.length) ? paths : collectProseDocs(repoRoot);
  const findings = [];
  for (const file of files) findings.push(...lintFile(file, { repoRoot }));
  return { ok: findings.length === 0, findings };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const strict = args.includes('--strict');
  const json = args.includes('--json');
  const files = args.filter(a => !a.startsWith('--'));
  const result = validate(files);
  if (json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else if (result.ok) {
    process.stdout.write('✓ prose-link-check: no broken relative .md links\n');
  } else {
    for (const finding of result.findings) {
      const loc = finding.line ? `${finding.file}:${finding.line}` : finding.file;
      process.stderr.write(`${strict ? '✗' : '⚠'} ${loc} [${finding.rule}] ${finding.detail}\n`);
    }
    process.stderr.write(`\n${result.findings.length} finding(s). ${strict ? 'BLOCKING (--strict)' : 'advisory (#3297 AC3)'}\n`);
  }
  process.exit(result.ok || !strict ? 0 : 1);
}

module.exports = {
  validate, lintFile, collectProseDocs, checkLinks,
  isExternalOrAnchor, barePath, isExcluded, PROSE_ROOTS, EXCLUDED_DIRS,
};
