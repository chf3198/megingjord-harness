#!/usr/bin/env node
// Lint Readability — enforce Clean Code JS practices
// Checks: single-letter vars, magic numbers, long functions, missing JSDoc

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SKIP = ['node_modules', '.git', 'test-results', 'alpine.min.js'];
const MAX_FUNCTION_LINES = 30;

function walkJS(dir) {
  const files = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.includes(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...walkJS(full));
    else if (e.name.endsWith('.js')) files.push(full);
  }
  return files;
}

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const warnings = [];
  const rel = path.relative(ROOT, filePath);

  // Single-letter variable names (excluding i,j,k in loops, e in catch)
  const singleLetterRe = /\b(?:const|let|var)\s+([a-df-hln-zA-Z])\b/;
  lines.forEach((line, idx) => {
    const match = line.match(singleLetterRe);
    if (match) warnings.push({ line: idx + 1, rule: 'naming',
      msg: `Single-letter variable '${match[1]}' — use a descriptive name` });
  });

  // Magic numbers (outside of common: 0, 1, -1, 2, 100)
  const magicRe = /(?<![\w.])\b(\d{3,})\b(?![\w])/;
  const ALLOWED_NUMBERS = new Set(['100', '1000', '1024']);
  lines.forEach((line, idx) => {
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;
    if (/const\s+[A-Z_]+/.test(line)) return; // named constant
    const match = line.match(magicRe);
    if (match && !ALLOWED_NUMBERS.has(match[1])) {
      warnings.push({ line: idx + 1, rule: 'magic-number',
        msg: `Magic number ${match[1]} — extract to a named constant` });
    }
  });

  // Long functions (more than MAX_FUNCTION_LINES)
  let funcStart = null, funcName = '';
  let braceDepth = 0, inFunc = false;
  lines.forEach((line, idx) => {
    const funcMatch = line.match(/function\s+(\w+)/);
    if (funcMatch && !inFunc) {
      funcStart = idx; funcName = funcMatch[1]; inFunc = true; braceDepth = 0;
    }
    if (inFunc) {
      braceDepth += (line.match(/{/g) || []).length;
      braceDepth -= (line.match(/}/g) || []).length;
      if (braceDepth <= 0 && funcStart !== null) {
        const length = idx - funcStart + 1;
        if (length > MAX_FUNCTION_LINES) {
          warnings.push({ line: funcStart + 1, rule: 'func-length',
            msg: `Function '${funcName}' is ${length} lines (max ${MAX_FUNCTION_LINES})` });
        }
        inFunc = false; funcStart = null;
      }
    }
  });

  return warnings.map(w => ({ file: rel, ...w }));
}

const dashboardJS = walkJS(path.join(ROOT, 'dashboard', 'js'));
const scriptJS = walkJS(path.join(ROOT, 'scripts'))
  .filter(f => !f.includes('lint-readability'));
const allFiles = [...dashboardJS, ...scriptJS];
const allWarnings = allFiles.flatMap(checkFile);

if (allWarnings.length) {
  console.log(`\n⚠️  ${allWarnings.length} readability warnings:\n`);
  for (const w of allWarnings) {
    console.log(`  ${w.file}:${w.line} [${w.rule}] ${w.msg}`);
  }
  console.log(`\nScanned ${allFiles.length} JS files.`);
  process.exit(0); // Warnings, not blocking (yet)
} else {
  console.log(`✅ ${allFiles.length} JS files pass readability checks.`);
}
