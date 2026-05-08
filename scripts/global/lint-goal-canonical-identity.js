#!/usr/bin/env node
'use strict';
/* lint-goal-canonical-identity: byte-identity check between
 * hooks/scripts/goal_lens.py priority sentence and
 * instructions/harness-goals.instructions.md canonical priority sentence.
 *
 * Per #1123 / #1105 D-009 Tier B implementation. This is a HARD gate
 * (exits 1 on drift) — see lint-goal-drift.js for the broader advisory
 * lint across mirror surfaces.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const CANONICAL = path.join(ROOT, 'instructions/harness-goals.instructions.md');
const HOOK = path.join(ROOT, 'hooks/scripts/goal_lens.py');

function extractCanonical(text) {
  // Strip Python string-concat artifacts (`"` chars) and collapse whitespace
  const flat = text.replace(/["\n]/g, ' ').replace(/\s+/g, ' ');
  const match = flat.match(/G1 Governance[^"]*?Interoperability/);
  return match ? match[0].trim() : null;
}

function main() {
  const md = fs.readFileSync(CANONICAL, 'utf8');
  const py = fs.readFileSync(HOOK, 'utf8');
  const canonical = extractCanonical(md);
  const hookSentence = extractCanonical(py);
  if (!canonical) { console.error('No canonical found in', CANONICAL); process.exit(1); }
  if (!hookSentence) { console.error('No goal sentence found in', HOOK); process.exit(1); }
  if (canonical !== hookSentence) {
    console.error('❌ goal_lens.py priority sentence drifts from canonical:');
    console.error(`  canonical: ${canonical}`);
    console.error(`  hook:      ${hookSentence}`);
    process.exit(1);
  }
  console.log('✅ goal_lens.py byte-identical to canonical priority sentence.');
}

if (require.main === module) main();
module.exports = { extractCanonical };
