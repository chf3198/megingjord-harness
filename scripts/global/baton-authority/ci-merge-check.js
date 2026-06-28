// ci-merge-check.js -- CI entry point for baton-authority merge gate.
// Called by baton-authority-merge.yml workflow. Uses real gh CLI.
// Refs #3290, Epic #3284.
'use strict';

const { execSync } = require('node:child_process');
const { evaluateMergeAuthority } = require('./merge-authority');
const { buildEvidenceDigest } = require('./merkle');
const { deriveTrailFromGitHub } = require('./evidence-loader');

const GH_TIMEOUT_MS = 15000;

/**
 * Execute a gh CLI command and parse JSON output.
 */
function ghExec(cmd) {
  const raw = execSync(cmd, { encoding: 'utf8', timeout: GH_TIMEOUT_MS });
  return JSON.parse(raw);
}

/**
 * Build a real ghClient backed by the gh CLI.
 */
function buildGhClient() {
  return {
    async getIssue(issueNum) {
      return ghExec('gh issue view ' + issueNum + ' --json state,labels');
    },
    async listComments(issueNum) {
      const data = ghExec('gh issue view ' + issueNum + ' --json comments');
      return data.comments || [];
    },
    async getPR(prNum) {
      return ghExec('gh pr view ' + prNum + ' --json merged');
    },
    async listChecks(prNum) {
      try {
        return ghExec('gh pr checks ' + prNum + ' --json name,conclusion');
      } catch (_err) {
        return [];
      }
    },
  };
}

async function main() {
  const issueNumber = parseInt(process.env.ISSUE_NUMBER, 10);
  const prNumber = parseInt(process.env.PR_NUMBER, 10);
  if (!issueNumber || !prNumber) {
    console.error('ISSUE_NUMBER and PR_NUMBER env vars required');
    process.exit(1);
  }
  const ghClient = buildGhClient();
  const trail = await deriveTrailFromGitHub(issueNumber, ghClient);
  if (trail.error) {
    console.error('Trail derivation failed: ' + trail.error);
    process.exit(1);
  }
  const digest = buildEvidenceDigest(trail.facts);
  const result = await evaluateMergeAuthority(issueNumber, prNumber, ghClient, digest);
  console.log(JSON.stringify(result, null, 2));
  if (!result.allowed) {
    console.error('Merge NOT authorized: ' + result.reason);
    if (result.missing && result.missing.length !== 0) {
      console.error('Missing evidence: ' + result.missing.join(', '));
    }
    process.exit(1);
  }
  console.log('Merge authorized.');
}

main().catch((err) => {
  console.error('Unhandled error: ' + err.message);
  process.exit(1);
});
