#!/usr/bin/env node
// scripts/wiki/search.js — Query the wiki with natural language
// Fleet routing: OpenClaw (primary) → Groq → Cerebras (failover)
// Usage: node scripts/wiki/search.js "your question here"

const fs = require('fs');
const { callLLM, SEARCH_PROMPT } = require('./wiki-llm');
const { listPages, WIKI_DIR } = require('./wiki-io');
const path = require('path');

async function search(question) {
  console.log(`🔍 Query: ${question}\n`);

  // Step 1: Read index to find relevant pages
  const indexPath = path.join(WIKI_DIR, 'index.md');
  const index = fs.readFileSync(indexPath, 'utf-8');
  const pages = listPages();

  if (pages.length === 0) {
    console.log('📋 Wiki is empty — ingest some sources first.');
    process.exit(0);
  }

  // Step 2: Simple keyword matching against index + page contents
  const qWords = question.toLowerCase().split(/\s+/);
  const scored = pages.map((p) => {
    const content = fs.readFileSync(p.path, 'utf-8').toLowerCase();
    const hits = qWords.filter((w) => content.includes(w)).length;
    return { ...p, score: hits };
  });
  scored.sort((a, b) => b.score - a.score);
  const relevant = scored.filter((p) => p.score > 0).slice(0, 5);

  if (relevant.length === 0) {
    console.log('No relevant wiki pages found for this query.');
    console.log('Try ingesting more sources or rephrasing your question.');
    process.exit(0);
  }

  console.log(`📄 Found ${relevant.length} relevant page(s):`);
  relevant.forEach((p) => console.log(`   - [[${p.slug}]] (${p.type}, score: ${p.score})`));

  // Step 3: Build context from top pages
  const context = relevant
    .map((p) => {
      const content = fs.readFileSync(p.path, 'utf-8');
      return `--- ${p.slug} (${p.type}) ---\n${content}`;
    })
    .join('\n\n');

  // Step 4: Call LLM for synthesis
  console.log('\n💭 Synthesizing answer...\n');
  const answer = await callLLM(SEARCH_PROMPT(question, context));

  if (!answer) {
    console.log('⚠️  LLM unavailable. Showing raw page matches instead:\n');
    relevant.forEach((p) => {
      console.log(`## [[${p.slug}]]`);
      const lines = fs.readFileSync(p.path, 'utf-8').split('\n').slice(0, 10);
      console.log(lines.join('\n') + '\n...\n');
    });
    return;
  }

  console.log('---');
  console.log(answer);
  console.log('---');
  console.log(`\nSources: ${relevant.map((p) => `[[${p.slug}]]`).join(', ')}`);
}

const question = process.argv.slice(2).join(' ');
if (!question) {
  console.log('Usage: node scripts/wiki/search.js "your question"');
  process.exit(1);
}
search(question);
