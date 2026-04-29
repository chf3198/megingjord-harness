const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SKIP = ['node_modules', '.git', 'test-results', 'alpine.min.js'];
const MAX_FUNCTION_LINES = 30;

function walkJS(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkJS(full));
    else if (entry.name.endsWith('.js')) files.push(full);
  }
  return files;
}

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const warnings = [];
  const rel = path.relative(ROOT, filePath);
  const singleLetterRe = /\b(?:const|let|var)\s+([a-df-hln-zA-Z])\b/;
  const magicRe = /(?<![\w.])\b(\d{3,})\b(?![\w])/;
  const allowedNumbers = new Set(['100', '1000', '1024']);

  lines.forEach((line, idx) => {
    const match = line.match(singleLetterRe);
    if (match) {
      warnings.push({
        line: idx + 1,
        rule: 'naming',
        msg: `Single-letter variable '${match[1]}' — use a descriptive name`,
      });
    }
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;
    if (/const\s+[A-Z_]+/.test(line)) return;
    const magic = line.match(magicRe);
    if (magic && !allowedNumbers.has(magic[1])) {
      warnings.push({
        line: idx + 1,
        rule: 'magic-number',
        msg: `Magic number ${magic[1]} — extract to a named constant`,
      });
    }
  });

  let start = null;
  let name = '';
  let depth = 0;
  lines.forEach((line, idx) => {
    const fn = line.match(/function\s+(\w+)/);
    if (fn && start === null) {
      start = idx;
      name = fn[1];
      depth = 0;
    }
    if (start === null) return;
    depth += (line.match(/{/g) || []).length;
    depth -= (line.match(/}/g) || []).length;
    if (depth <= 0) {
      const length = idx - start + 1;
      if (length > MAX_FUNCTION_LINES) {
        warnings.push({
          line: start + 1,
          rule: 'func-length',
          msg: `Function '${name}' is ${length} lines (max ${MAX_FUNCTION_LINES})`,
        });
      }
      start = null;
    }
  });

  return warnings.map(w => ({ file: rel, ...w }));
}

function run(args = process.argv.slice(2)) {
  const outputJson = args.includes('--json');
  const maxArg = args.find(a => a.startsWith('--max-warnings='));
  const maxWarnings = maxArg ? Number(maxArg.split('=')[1]) : null;
  const dashboardJS = walkJS(path.join(ROOT, 'dashboard', 'js'));
  const scriptJS = walkJS(path.join(ROOT, 'scripts')).filter(f => !f.includes('lint-readability'));
  const allFiles = [...dashboardJS, ...scriptJS];
  const warnings = allFiles.flatMap(checkFile);

  if (outputJson) {
    console.log(JSON.stringify({ scannedFiles: allFiles.length, warningCount: warnings.length, warnings }));
  } else if (warnings.length) {
    console.log(`\n⚠️  ${warnings.length} readability warnings:\n`);
    warnings.forEach(w => console.log(`  ${w.file}:${w.line} [${w.rule}] ${w.msg}`));
    console.log(`\nScanned ${allFiles.length} JS files.`);
  } else {
    console.log(`✅ ${allFiles.length} JS files pass readability checks.`);
  }

  if (maxWarnings !== null && warnings.length > maxWarnings) {
    console.error(`❌ Readability gate failed: ${warnings.length} > ${maxWarnings}`);
    process.exit(1);
  }
}

module.exports = { run };
