#!/usr/bin/env node
'use strict';
// compile-doc.js (#3129, Epic #3124 D1+D3): deterministically compile a human doc into a SPARSE agent
// wiki entry (H1 title + lead paragraph + heading outline) carrying provenance frontmatter
// (source_path, source_sha256, content_hash). No LLM in v1 — the semantic-distillation step is
// fleet-lane and DEFERRED. Local, $0. Agents read this compiled entry, never the raw human doc.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const OUTLINE_HEADING_RE = /^#{2,4}\s+(.+)$/;
const CONTENT_TRUST = 0.9;

/** sha256 hex of text. @param {string} text @returns {string} hex digest. */
function sha256Hex(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

/** Compile a doc's text into a sparse compiled-entry record.
 * @param {string} sourcePath repo-relative source path. @param {string} text doc contents. @returns {object} */
/** Render the compiled-entry markdown body (frontmatter + sparse content).
 * @param {object} meta {sourcePath, sourceSha, contentHash, title, lead, outline}. @returns {string} */
function renderBody(meta) {
  const frontmatter = [
    '---',
    'type: code',
    'sub_layer: semantic',
    `source_path: "${meta.sourcePath}"`,
    `source_sha256: ${meta.sourceSha}`,
    `content_hash: ${meta.contentHash}`,
    `content_trust_score: ${CONTENT_TRUST}`,
    '---',
  ];
  const content = [
    '',
    `# ${meta.title}`,
    '',
    `> Compiled sparse entry of \`${meta.sourcePath}\` (agent plane — read this, not the raw doc).`,
    '',
    meta.lead || '_(no lead paragraph)_',
    '',
    '## Outline',
    ...meta.outline.map((heading) => `- ${heading}`),
    '',
  ];
  return [...frontmatter, ...content].join('\n');
}

function compileDoc(sourcePath, text) {
  const lines = text.split('\n');
  const titleLine = lines.find((line) => line.startsWith('# ')) || `# ${path.basename(sourcePath)}`;
  const title = titleLine.replace(/^#\s+/, '').trim();
  const lead = (lines.find((line) => line.trim() && !line.startsWith('#')) || '').trim();
  const outline = lines
    .map((line) => line.match(OUTLINE_HEADING_RE))
    .filter(Boolean)
    .map((match) => match[1].trim());
  const sourceSha = sha256Hex(text);
  const contentHash = sha256Hex(`${title}|${lead}|${outline.join('|')}`);
  const body = renderBody({ sourcePath, sourceSha, contentHash, title, lead, outline });
  return { title, sourcePath, sourceSha, contentHash, outline, body };
}

function main() {
  const argv = process.argv.slice(2);
  const docIndex = argv.indexOf('--doc');
  const docPath = docIndex !== -1 ? argv[docIndex + 1] : null;
  if (!docPath || !fs.existsSync(docPath)) {
    process.stdout.write('usage: compile-doc.js --doc <path> [--out <file>]\n');
    process.exit(docPath ? 1 : 0);
  }
  const record = compileDoc(docPath, fs.readFileSync(docPath, 'utf8'));
  const outIndex = argv.indexOf('--out');
  if (outIndex !== -1 && argv[outIndex + 1]) fs.writeFileSync(argv[outIndex + 1], record.body);
  else process.stdout.write(record.body);
}

if (require.main === module) main();
module.exports = { compileDoc, sha256Hex };
