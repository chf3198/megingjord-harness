#!/usr/bin/env node
const { run } = require('./global/lint-readability-core');

run(process.argv.slice(2));
process.exit(0);
