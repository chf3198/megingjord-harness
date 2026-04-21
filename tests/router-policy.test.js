#!/usr/bin/env node
// Test router policy validation
const { classifyPrompt } = require('../scripts/global/task-router');

const tests = [
  { prompt: 'Implement a multi-file refactor', expected: 'fleet' },
  { prompt: 'Explain the docs and readme', expected: 'free' },
  { prompt: 'Design a complex architecture', expected: 'premium' },
  { prompt: 'Fix a simple bug', expected: 'free' },
  { prompt: 'security architecture audit', expected: 'premium' },
];

let passed = 0;
tests.forEach(test => {
  const result = classifyPrompt(test.prompt);
  if (result.lane === test.expected) {
    console.log(`✓ ${test.prompt} -> ${result.lane}`);
    passed++;
  } else {
    console.log(`✗ ${test.prompt} -> ${result.lane} (expected ${test.expected})`);
  }
});

console.log(`\n${passed}/${tests.length} tests passed`);
process.exit(passed === tests.length ? 0 : 1);