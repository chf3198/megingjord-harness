'use strict';
// fleet-call-lint.js — detect unbounded direct fleet /api/generate calls.
// G1/G3: ad-hoc curl/fetch calls that bypass cascade-dispatch.js timeout
// controls can stall sessions and force paid provider fallback (G3 violation).
// validate() takes { files: [{path, content}] }. Refs #2626.
const nodePath = require('node:path');

// Files that are already guarded — do not lint these.
const EXEMPT_BASENAMES = new Set([
  'cascade-dispatch.js', 'fleet-call-guard.js', 'fleet-call-lint.js',
  'worker.ts', 'durable-object.ts', 'litellm-client.js',
]);

const CURL_RE = /\bcurl\b[^\n]*?\/api\/generate/;
const FETCH_RE = /\bfetch\s*\([^)]*api\/generate/;
const EXEMPT_LINE = /\/\/\s*fleet-guard:\s*exempt/;

function checkLine(line) {
  if (EXEMPT_LINE.test(line)) return null;
  if (CURL_RE.test(line) && !line.includes('--max-time')) {
    return { reason: 'curl-without-max-time', snippet: line.trim().slice(0, 100) };
  }
  if (FETCH_RE.test(line) &&
      !line.includes('AbortController') && !line.includes('AbortSignal')) {
    return { reason: 'fetch-without-abort', snippet: line.trim().slice(0, 100) };
  }
  return null;
}

function scanFile({ path: filePath, content }) {
  if (EXEMPT_BASENAMES.has(nodePath.basename(filePath))) return [];
  const violations = [];
  (content || '').split('\n').forEach((line, idx) => {
    const hit = checkLine(line);
    if (hit) {
      violations.push({
        rule: 'fleet-unbounded-call',
        path: filePath,
        line: idx + 1,
        detail: `${hit.reason}: ${hit.snippet}`,
      });
    }
  });
  return violations;
}

function validate({ files = [] } = {}) {
  if (process.env.FLEET_GUARD_DISABLED === '1') return { ok: true, violations: [] };
  const violations = files.flatMap(f => scanFile(f));
  return { ok: violations.length === 0, violations };
}

module.exports = { validate, scanFile, checkLine, EXEMPT_BASENAMES };
