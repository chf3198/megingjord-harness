// Refs #2858 (Epic #2926 C1/D1) — fleet-red-team-dispatch.js is a library; invoked as a CLI it must REDIRECT
// to the canonical cascade-dispatch and exit non-zero, instead of the prior SILENT exit that stranded the
// operator into a raw paid call.
const { test, expect } = require('@playwright/test');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'global', 'fleet-red-team-dispatch.js');

test('#2858 direct CLI invocation redirects to cascade-dispatch and exits non-zero (no silent exit)', () => {
  const run = spawnSync('node', [SCRIPT], { encoding: 'utf8', timeout: 15000 });
  expect(run.status).not.toBe(0);                 // was: silent exit 0 — now a real failure code
  expect(run.stderr).toContain('cascade-dispatch'); // names the canonical CLI
  expect(run.stderr).toMatch(/library/i);          // states it is a library, not a CLI
});
