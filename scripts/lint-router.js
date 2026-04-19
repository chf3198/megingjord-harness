#!/usr/bin/env node
// Language-aware lint/best-practices router
// Detects repo language(s) and runs appropriate lint tools
// Usage: node scripts/lint-router.js [path]

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

/** Detect languages present in a directory */
function detectLanguages(dir) {
  const langs = new Set();
  const exts = { '.js': 'js', '.ts': 'ts', '.py': 'python', '.sh': 'bash' };
  try {
    const out = execSync(`find ${dir} -type f \\( -name '*.js' -o -name '*.ts' -o -name '*.py' -o -name '*.sh' \\) | head -200`,
      { encoding: 'utf8', timeout: 5000 }).trim();
    for (const f of out.split('\n').filter(Boolean)) {
      const ext = path.extname(f);
      if (exts[ext]) langs.add(exts[ext]);
    }
  } catch { /* empty */ }
  return [...langs];
}

/** Detect project type from package.json or file structure */
function detectProjectType(dir) {
  const pkgPath = path.join(dir, 'package.json');
  if (!fs.existsSync(pkgPath)) return 'generic';
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps['@angular/core'] || deps.react || deps.next || deps.vue)
      return 'web-app';
    if (pkg.engines?.vscode) return 'vscode-extension';
    return 'library';
  } catch { return 'generic'; }
}

/** Run agnostic checks (always active) */
function runAgnostic(dir) {
  const results = [];
  // Readability (naming, magic numbers, function length)
  try {
    const out = execSync(`node ${ROOT}/scripts/lint-readability.js`, {
      encoding: 'utf8', cwd: ROOT, timeout: 30000
    });
    results.push({ tool: 'readability', status: 'pass', output: out.trim() });
  } catch (e) {
    results.push({ tool: 'readability', status: 'warn', output: e.stdout || '' });
  }
  // File length (100-line limit)
  try {
    const out = execSync(`node ${ROOT}/scripts/lint.js`, {
      encoding: 'utf8', cwd: ROOT, timeout: 30000
    });
    results.push({ tool: 'line-limit', status: 'pass', output: out.trim() });
  } catch (e) {
    results.push({ tool: 'line-limit', status: 'fail', output: e.stdout || '' });
  }
  return results;
}

/** Run language-specific checks */
function runLanguageChecks(langs) {
  const CHECKS = [
    { match: l => l.includes('js') || l.includes('ts'), tool: 'eslint', cmd: 'npm run lint:js 2>&1' },
    { match: l => l.includes('python'), tool: 'ruff', cmd: 'npm run lint:py 2>&1' },
    { match: l => l.includes('bash'), tool: 'shellcheck', cmd: 'npm run lint:sh 2>&1' },
  ];
  return CHECKS.filter(c => c.match(langs)).map(c => {
    try {
      const out = execSync(c.cmd, { encoding: 'utf8', cwd: ROOT, timeout: 60000 });
      return { tool: c.tool, status: 'pass', output: out.trim() };
    } catch (e) {
      return { tool: c.tool, status: 'warn', output: (e.stdout || '').slice(-500) };
    }
  });
}

const target = process.argv[2] || ROOT;
const langs = detectLanguages(target);
const projectType = detectProjectType(target);
console.log(`\n🔍 Project: ${projectType} | Languages: ${langs.join(', ') || 'none detected'}\n`);
console.log('── Agnostic checks ──');
const agnostic = runAgnostic(target);
for (const r of agnostic) console.log(`  ${r.status === 'pass' ? '✅' : '⚠️'}  ${r.tool}`);
console.log('\n── Language-specific checks ──');
const langResults = runLanguageChecks(langs);
for (const r of langResults) console.log(`  ${r.status === 'pass' ? '✅' : '⚠️'}  ${r.tool}`);
const total = [...agnostic, ...langResults];
const fails = total.filter(r => r.status === 'fail');
console.log(`\n${fails.length ? '❌' : '✅'} ${total.length} checks run, ${fails.length} failures\n`);
process.exit(fails.length ? 1 : 0);
