#!/usr/bin/env node
// scripts/wiki/ingest.js — Ingest a raw source into the wiki
// Fleet routing: OpenClaw (primary) → Groq → Cerebras (failover)
// Usage: node scripts/wiki/ingest.js raw/articles/my-source.md

const fs = require('fs');
const path = require('path');
const { callLLM, INGEST_PROMPT } = require('./wiki-llm');
const { updateIndex, appendLog, parseFrontmatter } = require('./wiki-io');

const WIKI_DIR = path.join(__dirname, '../../wiki');

async function ingest(sourcePath) {
  if (!fs.existsSync(sourcePath)) {
    console.error(`❌ Source not found: ${sourcePath}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(sourcePath, 'utf-8');
  const { frontmatter, body } = parseFrontmatter(raw);
  const rawTitle = frontmatter.title || path.basename(sourcePath, '.md');
  const title = rawTitle.replace(/^["']|["']$/g, '');
  const slug = path.basename(sourcePath, '.md');

  console.log(`📥 Ingesting: ${title}`);
  console.log(`   Source: ${sourcePath}`);

  // Step 1: Call LLM for structured extraction
  const prompt = INGEST_PROMPT(title, body);
  const result = await callLLM(prompt);
  if (!result) {
    console.error('❌ LLM unreachable — ingest aborted. Try again later.');
    process.exit(1);
  }

  // Step 2: Write source summary page
  const today = new Date().toISOString().split('T')[0];
  const summaryPath = path.join(WIKI_DIR, 'sources', `${slug}.md`);
  const summaryContent = buildSourcePage(title, today, sourcePath, result);
  fs.writeFileSync(summaryPath, summaryContent);
  console.log(`   ✅ wiki/sources/${slug}.md`);

  // Step 3: Update index and log
  updateIndex(slug, title, 'source');
  appendLog(today, 'ingest', title);
  console.log(`   ✅ index.md + log.md updated`);

  // Step 4: Mark raw source as ingested
  markIngested(sourcePath, raw);
  console.log(`   ✅ Raw source marked ingested`);
  console.log(`\n🎉 Ingest complete: ${title}`);
}

function buildSourcePage(title, date, sourcePath, llmResult) {
  return [
    '---',
    `title: "${title}"`,
    'type: source',
    `created: ${date}`,
    `updated: ${date}`,
    `tags: []`,
    `sources: [${sourcePath}]`,
    `related: []`,
    'status: draft',
    '---',
    '',
    `# ${title}`,
    '',
    '## Summary',
    '',
    llmResult.trim(),
    '',
    `*Source: ${sourcePath}*`,
  ].join('\n');
}

function markIngested(filePath, raw) {
  const updated = raw.includes('status:')
    ? raw.replace(/status:\s*\w+/, 'status: ingested')
    : raw.replace('---\n', '---\nstatus: ingested\n');
  fs.writeFileSync(filePath, updated);
}

const sourceArg = process.argv[2];
if (!sourceArg) {
  console.log('Usage: node scripts/wiki/ingest.js <raw-source-path>');
  process.exit(1);
}
ingest(path.resolve(sourceArg));
