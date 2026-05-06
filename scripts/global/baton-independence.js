'use strict';

const fs = require('fs');

/**
 * Return the best available signer identity from a baton comment.
 *
 * @param {{body?: string, author?: string}} comment GitHub issue comment.
 * @returns {string} Signer identity or author fallback.
 */
function roleIdentity(comment) {
  const body = comment.body || '';
  const patterns = [
    /AI-Signature:\s*([^\n]+)/i,
    /Signed-by:\s*([^\n]+)/i,
    /AI-Team-Model:\s*([^\n]+)/i,
    /Team&Model:\s*([^\n]+)/i,
  ];
  for (const pattern of patterns) {
    const match = body.match(pattern);
    if (match) return match[1].trim();
  }
  return (comment.author || '').trim();
}

function findRoleComment(comments, marker) {
  const roleLine = new RegExp(`(^|\\n)\\s*${marker}\\s*(\\n|$)`);
  return [...comments].reverse().find(comment =>
    roleLine.test(comment.body || '')
  );
}

/**
 * Validate collaborator/admin handoffs were signed by different identities.
 *
 * @param {{body?: string, author?: string}[]} comments GitHub issue comments.
 * @returns {{ok: boolean, reason: string, message?: string}} Gate result.
 */
function checkAdminIndependence(comments) {
  const collaborator = findRoleComment(comments, 'COLLABORATOR_HANDOFF');
  const admin = findRoleComment(comments, 'ADMIN_HANDOFF');
  if (!collaborator || !admin) {
    return { ok: true, reason: 'missing-role-comment' };
  }

  const collaboratorId = roleIdentity(collaborator);
  const adminId = roleIdentity(admin);
  if (!collaboratorId || !adminId) {
    return { ok: true, reason: 'missing-signer-identity' };
  }

  if (collaboratorId === adminId) {
    return {
      ok: false,
      reason: 'same-signer',
      collaboratorId,
      adminId,
      message:
        `ADMIN_HANDOFF signer (${adminId}) matches ` +
        'COLLABORATOR_HANDOFF signer; independent verification is required.',
    };
  }

  return { ok: true, reason: 'independent', collaboratorId, adminId };
}

function main() {
  const file = process.argv[process.argv.indexOf('--comments') + 1];
  const comments = JSON.parse(fs.readFileSync(file, 'utf8'));
  const result = checkAdminIndependence(comments);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

if (require.main === module) main();

module.exports = { checkAdminIndependence, roleIdentity };
