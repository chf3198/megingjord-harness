'use strict';
// prompt-artifact-lint (#3302) — deterministic, zero-cost structural-quality linter
// for skill/agent PROMPT ARTIFACTS:
//   skills/**/SKILL.md, agents/**/*.{md,yml,yaml,json}, .claude/commands/*.md
// Closes the governance seam surfaced by audit #3296: eval-harness checks the
// *behavior* of these artifacts and doc-coverage/drift-lint checks *prose docs*,
// but neither runs a plain structural check over the artifacts themselves.
//
// Checks:
//   (1) broken relative links (incl. links into non-existent dirs like references/)
//   (2) missing/empty required frontmatter (name, description)
//   (3) stub / header-less bodies
//
// Boundary (AC4): behavioral correctness stays with eval-harness; prose docs ABOUT
// skills stay with doc-coverage. This linter owns ONLY structural quality of the
// prompt artifacts themselves. See docs/howto/prompt-artifact-lint-boundary.md.
//
// Advisory-first (AC3): exits 0 unless --strict is passed. Promotion to blocking is
// replay-eval-gated (no calendar threshold).

const fs = require('node:fs');
const path = require('node:path');

const LINK_RE = /\[[^\]]*\]\(([^)]+)\)/g;
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;

// Links that are not local filesystem targets and must be skipped.
function isExternalOrAnchor(target) {
  return /^(https?:|mailto:|tel:|data:|ftp:|#)/i.test(target) || target.startsWith('<');
}

function parseFrontmatter(content) {
  const match = content.match(FRONTMATTER_RE);
  if (!match) return null;
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (kv) fields[kv[1]] = kv[2].trim();
  }
  return fields;
}

function stripFrontmatter(content) {
  const match = content.match(FRONTMATTER_RE);
  return match ? content.slice(match[0].length) : content;
}

// Resolve a relative link target. For .claude/commands/*.md (flattened deploy-copies
// of skills/<name>/SKILL.md) a same-dir miss falls back to the source skill dir, so
// skill-internal references/ links are not reported as false breaks.
function resolveTarget(filePath, target, repoRoot) {
  const clean = target.split('#')[0].split('?')[0].trim();
  if (!clean) return { resolved: true };
  if (fs.existsSync(path.resolve(path.dirname(filePath), clean))) return { resolved: true };

  const rel = path.relative(repoRoot, filePath).split(path.sep).join('/');
  if (rel.startsWith('.claude/commands/')) {
    const name = path.basename(filePath, '.md');
    const fallback = path.resolve(path.join(repoRoot, 'skills', name), clean);
    if (fs.existsSync(fallback)) return { resolved: true, viaFallback: true };
  }
  return { resolved: false, target: clean };
}

function checkLinks(content, filePath, repoRoot) {
  const findings = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const re = new RegExp(LINK_RE.source, 'g');
    let m;
    while ((m = re.exec(lines[i]))) {
      const target = m[1].trim();
      if (isExternalOrAnchor(target)) continue;
      const res = resolveTarget(filePath, target, repoRoot);
      if (!res.resolved) {
        findings.push({ file: filePath, line: i + 1, rule: 'broken-link',
          detail: `relative link target not found: ${res.target}` });
      }
    }
  }
  return findings;
}

function checkJson(content, filePath) {
  let obj;
  try { obj = JSON.parse(content); }
  catch (e) { return [{ file: filePath, rule: 'malformed-json', detail: e.message }]; }
  // Only single-agent definitions (objects carrying a top-level `name`) must also
  // carry a description; container files (rosters) are exempt.
  if (obj && typeof obj === 'object' && !Array.isArray(obj) && obj.name) {
    if (!String(obj.description || '').trim()) {
      return [{ file: filePath, rule: 'missing-frontmatter', detail: "JSON agent def missing/empty 'description'" }];
    }
  }
  return [];
}

function checkFrontmatter(fields, filePath) {
  const findings = [];
  if (!fields) {
    findings.push({ file: filePath, rule: 'missing-frontmatter', detail: 'no YAML frontmatter block' });
    return findings;
  }
  for (const key of ['name', 'description']) {
    if (!fields[key]) {
      findings.push({ file: filePath, rule: 'missing-frontmatter', detail: `frontmatter missing/empty '${key}'` });
    }
  }
  return findings;
}

function checkStubBody(body, filePath) {
  const normalized = body.replace(/\s+/g, ' ').trim();
  if (normalized.length < 40 && !/^#/m.test(body)) {
    return [{ file: filePath, rule: 'stub-body', detail: 'body is empty or a header-less stub' }];
  }
  return [];
}

function lintFile(filePath, opts = {}) {
  const repoRoot = opts.repoRoot || process.cwd();
  let content;
  try { content = fs.readFileSync(filePath, 'utf8'); }
  catch { return [{ file: filePath, rule: 'unreadable', detail: 'cannot read file' }]; }

  if (filePath.endsWith('.json')) return checkJson(content, filePath);

  const findings = [];
  // Required frontmatter (name + description) applies only to authored persona
  // definitions — skill entrypoints (SKILL.md) and agent defs (*.agent.md). Agent
  // prompt FRAGMENTS (e.g. pre-merge-review/*.md), reference docs (router-policy.md),
  // and the .claude/commands/*.md deploy-copies (which intentionally strip `name`)
  // are exempt; their frontmatter is validated on the authored source, not here.
  const base = path.basename(filePath);
  const requiresFrontmatter = base === 'SKILL.md' || /\.agent\.md$/.test(base);
  if (requiresFrontmatter) findings.push(...checkFrontmatter(parseFrontmatter(content), filePath));
  findings.push(...checkStubBody(stripFrontmatter(content), filePath));
  findings.push(...checkLinks(content, filePath, repoRoot));
  return findings;
}

function walk(dir, onFile) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, onFile);
    else if (e.isFile()) onFile(full);
  }
}

function collectArtifacts(repoRoot) {
  const out = [];
  walk(path.join(repoRoot, 'skills'), f => { if (path.basename(f) === 'SKILL.md') out.push(f); });
  walk(path.join(repoRoot, 'agents'), f => { if (/\.(md|ya?ml|json)$/i.test(f)) out.push(f); });
  const cmdDir = path.join(repoRoot, '.claude', 'commands');
  if (fs.existsSync(cmdDir)) {
    for (const name of fs.readdirSync(cmdDir)) if (name.endsWith('.md')) out.push(path.join(cmdDir, name));
  }
  return out.sort();
}

// validate(paths, opts) — if paths empty, scans the whole artifact set under repoRoot.
function validate(paths, opts = {}) {
  const repoRoot = opts.repoRoot || process.cwd();
  const files = (paths && paths.length) ? paths : collectArtifacts(repoRoot);
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
    process.stdout.write('✓ prompt-artifact-lint: no structural defects\n');
  } else {
    for (const finding of result.findings) {
      const loc = finding.line ? `${finding.file}:${finding.line}` : finding.file;
      process.stderr.write(`${strict ? '✗' : '⚠'} ${loc} [${finding.rule}] ${finding.detail}\n`);
    }
    process.stderr.write(`\n${result.findings.length} finding(s). ${strict ? 'BLOCKING (--strict)' : 'advisory (#3302 AC3)'}\n`);
  }
  process.exit(result.ok || !strict ? 0 : 1);
}

module.exports = {
  validate, lintFile, collectArtifacts, parseFrontmatter, stripFrontmatter,
  resolveTarget, isExternalOrAnchor, checkLinks, checkJson, checkFrontmatter, checkStubBody,
};
