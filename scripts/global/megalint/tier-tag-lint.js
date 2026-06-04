#!/usr/bin/env node
'use strict';
// tier: 1
// tier-tag-lint (Epic #2398 AC3): validates resource-tier tags on scripts/global/*.js.
// Contract: untagged scripts are the tier-1 baseline (Phase-0 #2412: 95.1% are tier-0/1).
// A script that references a tier>=2 resource MUST carry a `// tier: N` tag (N in 0..5)
// whose value is >= the tier its resources imply. Out-of-range tags fail.
// Taxonomy: instructions/resource-tier-portability.instructions.md.

const fs = require('node:fs');
const path = require('node:path');

const TAG_RE = /^\s*\/\/\s*tier:\s*([0-5])\b/m;
// Resource → minimum tier it implies.
const RESOURCE_TIERS = [
  { tier: 2, re: /workers\.dev|MEGINGJORD_HAMR_DISABLED|R2 |KV |cloudflare/i },
  { tier: 3, re: /100\.91\.113|100\.78\.22|tailscale|11434|ollama/i },
  { tier: 4, re: /ANTHROPIC_API_KEY|OPENAI_API_KEY|GOOGLE_AI_STUDIO_API_KEY|GROQ_API_KEY|CEREBRAS_API_KEY/i },
];

function impliedTier(content) {
  let max = 1;
  for (const { tier, re } of RESOURCE_TIERS) if (re.test(content)) max = Math.max(max, tier);
  return max;
}

function lintFile(file, content) {
  const violations = [];
  const tagMatch = content.match(TAG_RE);
  const tagged = tagMatch ? Number(tagMatch[1]) : null;
  const implied = impliedTier(content);
  if (implied >= 2 && tagged === null) {
    violations.push({ file, rule: 'missing-tier-tag',
      detail: `references a tier-${implied} resource but has no \`// tier: N\` tag` });
  } else if (tagged !== null && implied >= 2 && tagged < implied) {
    violations.push({ file, rule: 'tier-tag-too-low',
      detail: `tagged tier ${tagged} but resources imply tier ${implied}` });
  }
  return violations;
}

function lintTierTags(files) {
  const violations = [];
  for (const f of files) {
    try { violations.push(...lintFile(f, fs.readFileSync(f, 'utf8'))); }
    catch { /* unreadable file: skip (other gates cover existence) */ }
  }
  return { ok: violations.length === 0, violations };
}

function globScripts(root) {
  const dir = path.join(root, 'scripts', 'global');
  return fs.readdirSync(dir).filter((f) => f.endsWith('.js')).map((f) => path.join(dir, f));
}

if (require.main === module) {
  const root = path.resolve(__dirname, '..', '..', '..');
  const res = lintTierTags(globScripts(root));
  if (!res.ok) {
    console.error(`tier-tag-lint: FAIL (${res.violations.length})`);
    for (const v of res.violations) console.error(`  - ${v.rule}: ${path.basename(v.file)} — ${v.detail}`);
    process.exit(1);
  }
  console.log('tier-tag-lint: PASS');
}

module.exports = { lintTierTags, lintFile, impliedTier, TAG_RE };
