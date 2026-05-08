#!/usr/bin/env node
'use strict';
/* Generate JSON contract from instructions/harness-goals.instructions.md
 * Per #1121 / #1105 D-007. Markdown is canonical source; JSON is derived
 * view for programmatic linting (#1122) and machine-readable tools.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SOURCE = path.resolve(__dirname, '../../instructions/harness-goals.instructions.md');
const OUT = path.resolve(__dirname, '../../generated/goals-contract.json');

function parse(md) {
  const priority = [];
  const definitions = {};
  // Priority order: extract from the canonical sentence (which may span lines).
  // Strategy: collapse whitespace, take all G<n> Name tokens in document order;
  // dedupe keeping first occurrence, take the first 9.
  const flat = md.replace(/\s+/g, ' ');
  const tokens = [...flat.matchAll(/(G[1-9])\s+([A-Z][A-Za-z]+(?:\s[A-Z][A-Za-z]+)?)\s*(?=[>.])/g)];
  for (const t of tokens) {
    if (priority.length === 9) break;
    if (!priority.find((p) => p.id === t[1])) {
      priority.push({ id: t[1], name: t[2].trim() });
    }
  }
  // Definitions from `- G<n> Name: text` bullets
  for (const line of md.split('\n')) {
    const dm = line.match(/^- (G[1-9])\s+([A-Z][A-Za-z]+(?:\s[A-Z][A-Za-z]+)?):\s+(.+?)\.?\s*$/);
    if (dm) definitions[dm[1]] = { name: dm[2].trim(), text: dm[3].trim() };
  }
  return { priority, definitions };
}

function main() {
  const md = fs.readFileSync(SOURCE, 'utf8');
  const sourceSha = crypto.createHash('sha256').update(md).digest('hex').slice(0, 16);
  const { priority, definitions } = parse(md);
  const contract = {
    schema_version: 1,
    generated_utc: new Date().toISOString(),
    source_path: 'instructions/harness-goals.instructions.md',
    source_sha256_prefix: sourceSha,
    priority_order: priority,
    definitions,
    notes: [
      'GENERATED — do not edit. Regenerate via `npm run goals:regen`.',
      'Markdown source is canonical; JSON is a derived view for linting/automation.',
      'Direct edits to this file are blocked by CI (verify-goals-contract gate).',
    ],
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(contract, null, 2) + '\n');
  console.log(`✅ goals-contract written: ${OUT} (${priority.length} goals)`);
}

if (require.main === module) main();
module.exports = { parse };
