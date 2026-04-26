// Dangerfile.js — PR governance enforcer
// Validates ticket-first, branch naming, and Conventional Commits on PRs.
/* global danger, warn, fail, message */

const pr = danger.github.pr;
const body = pr.body || '';
const title = pr.title || '';
const branch = pr.head.ref || '';

// Rule 1: PR body must reference an issue via Refs or Closes
const issueRef = /(refs?|closes?)\s+#\d+/i;
if (!issueRef.test(body)) {
  fail(
    '**Ticket-first violation**: PR body must contain `Refs #N` (or `Closes #N`) ' +
    'to link a GitHub issue. Every change requires a pre-existing ticket.'
  );
}

// Rule 2: Branch must follow <type>/<issue#>-<slug> naming
const branchPattern = /^(feat|fix|chore|docs|style|test|refactor|perf)\/\d+-/;
if (!branchPattern.test(branch)) {
  warn(
    `**Branch naming**: \`${branch}\` does not match ` +
    '`<type>/<issue#>-<slug>` (e.g. `feat/42-my-feature`). ' +
    'See github-governance.instructions.md.'
  );
}

// Rule 3: PR title must follow Conventional Commits
const ccPattern = /^(feat|fix|chore|docs|style|test|refactor|perf)(\([^)]+\))?!?: .+/;
if (!ccPattern.test(title)) {
  fail(
    `**PR title**: \`${title}\` does not match Conventional Commits format. ` +
    'Required: `type(scope): description` (e.g. `feat(hooks): add gate #42`).'
  );
}

// Rule 4: PR title should end with issue reference
if (!/\s#\d+$/.test(title)) {
  warn(
    '**PR title**: convention is to end with the issue reference `#N` ' +
    `(e.g. \`${title} #42\`).`
  );
}

// Summary
message(
  '**Danger**: ticket-first, branch, and title checks complete. ' +
  'Failures block merge; warnings are advisory.'
);
