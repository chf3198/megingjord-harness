'use strict';
// cross-checkout-destructive — Epic #1486-adjacent (#1554). Detects PR
// diffs that remove tracked symlinks. When git rm --cached or git rm
// removes a tracked symlink, the merge into other checkouts force-
// removes the working-tree entry even if a collaborator has placed a
// real directory there (e.g., npm install output or a filesystem
// repair). This caused the 2026-05-14 node_modules cascade — see
// #1539 for the full incident.
//
// Pure function: caller supplies the list of PR files with their patch
// text (from gh api repos/.../pulls/N/files). This module greps for
// `deleted file mode 120000` lines and requires acknowledgement.

const SYMLINK_DELETE_RE = /^deleted file mode 120000$/m;
const ACK_MARKER_RE = /<!--\s*cross-checkout-destructive:\s*[^>]+-->/;
const OVERRIDE_LABEL = 'cross-checkout-destructive:approved';

function findDeletedSymlinks(prFiles) {
  const out = [];
  for (const file of prFiles || []) {
    if (!file || file.status !== 'removed') continue;
    if (SYMLINK_DELETE_RE.test(file.patch || '')) {
      out.push(file.filename);
    }
  }
  return out;
}

function hasAcknowledgement(prBody, labels) {
  if ((labels || []).includes(OVERRIDE_LABEL)) return 'override-label';
  if (ACK_MARKER_RE.test(prBody || '')) return 'body-marker';
  return null;
}

function validate(input) {
  const deletedSymlinks = findDeletedSymlinks(input.prFiles || []);
  if (deletedSymlinks.length === 0) {
    return { ok: true, violations: [], skipped: 'no-symlink-deletions' };
  }
  const ack = hasAcknowledgement(input.prBody, input.labels);
  if (ack) {
    return { ok: true, violations: [], acknowledgement: ack, deletedSymlinks };
  }
  return {
    ok: false,
    deletedSymlinks,
    violations: deletedSymlinks.map((path) => ({
      rule: 'cross-checkout-destructive-unacknowledged',
      detail: `PR deletes tracked symlink at \`${path}\`. When collaborators pull this commit, `
        + `git force-removes the working-tree entry even if they have placed a real directory there `
        + `(e.g., from \`npm install\` or operator-applied repair). Acknowledge via PR body marker `
        + `\`<!-- cross-checkout-destructive: <reason> -->\` or apply label \`${OVERRIDE_LABEL}\`. `
        + `See #1539 for the incident this rule guards against.`,
      path,
    })),
  };
}

module.exports = {
  validate, findDeletedSymlinks, hasAcknowledgement,
  SYMLINK_DELETE_RE, ACK_MARKER_RE, OVERRIDE_LABEL,
};
