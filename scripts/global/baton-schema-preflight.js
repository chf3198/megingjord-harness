#!/usr/bin/env node
// baton-schema-preflight.js — D2 (#1565): validate baton artifact schema before commit.
// Usage: node baton-schema-preflight.js --role <role> --body "<comment body>"
// Roles: manager | collaborator | admin | consultant
'use strict';

const SCHEMAS = {
  manager: {
    fields: ['scope', 'lane', 'test_strategy', 'acceptance', 'gates'],
    patterns: [
      [/Signed-by:/i, 'missing Signed-by'],
      [/Team&Model:/i, 'missing Team&Model'],
      [/Role:\s*manager/i, 'missing Role: manager'],
    ],
  },
  collaborator: {
    fields: ['scope'],
    patterns: [
      [/Signed-by:/i, 'missing Signed-by'],
      [/Team&Model:/i, 'missing Team&Model'],
      [/Role:\s*collaborator/i, 'missing Role: collaborator'],
      [/test_strategy:/i, 'missing test_strategy'],
    ],
  },
  admin: {
    fields: [],
    patterns: [
      [/Signed-by:/i, 'missing Signed-by'],
      [/Team&Model:/i, 'missing Team&Model'],
      [/Role:\s*admin/i, 'missing Role: admin'],
    ],
  },
  consultant: {
    fields: [],
    patterns: [
      [/Signed-by:/i, 'missing Signed-by'],
      [/Team&Model:/i, 'missing Team&Model'],
      [/Role:\s*consultant/i, 'missing Role: consultant'],
      [/(G[1-9]\s*[=:]|rubric_version["']?\s*[:=]\s*["']?g1-g9-v2)/i, 'missing legacy G1-9 or v2 deterministic rubric'],
      [/verification[ _-]?timestamp/i, 'missing verification-timestamp'],
      [/(verdict|approve|approved)/i, 'missing verdict / approved statement'],
    ],
  },
};

function extractField(body, field) {
  // Tolerates: plain `field:`, list-prefixed `- field:`, and
  // bold-markdown `**field:**` or `**field**:` (F-BC1 / #3030).
  // Pattern: optional `**` around field+colon, then capture value.
  const re = new RegExp(
    `(?:^|\\n)[-*]?\\s*(?:\\*\\*)?${field}(?::\\*\\*|\\*\\*\\s*:|\\s*:)\\s*([^\\n]+)`, 'i'
  );
  const m = body.match(re);
  return m ? m[1].trim() : null;
}

function validate(role, body) {
  const schema = SCHEMAS[role];
  if (!schema) return { ok: false, violations: [`Unknown role '${role}'. Use: ${Object.keys(SCHEMAS).join(' | ')}`] };
  const violations = [];
  for (const field of schema.fields) {
    if (!extractField(body, field)) violations.push(`missing required field '${field}:'`);
  }
  for (const [re, msg] of schema.patterns) {
    if (!re.test(body)) violations.push(msg);
  }
  return { ok: violations.length === 0, violations };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const roleIdx = args.indexOf('--role');
  const bodyIdx = args.indexOf('--body');
  const role = roleIdx >= 0 ? args[roleIdx + 1] : null;
  const body = bodyIdx >= 0 ? args[bodyIdx + 1] : null;
  if (!role || !body) {
    process.stderr.write('Usage: node baton-schema-preflight.js --role <role> --body "<text>"\n');
    process.exit(1);
  }
  const { ok, violations } = validate(role, body);
  if (ok) {
    process.stdout.write(`[baton-preflight] ${role}: PASS\n`);
    process.exit(0);
  } else {
    process.stderr.write(`[baton-preflight] ${role}: FAIL\n`);
    for (const v of violations) process.stderr.write(`  • ${v}\n`);
    process.exit(1);
  }
}

module.exports = { validate, SCHEMAS };
