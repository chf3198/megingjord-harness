'use strict';
// Multi-close batch block generator (Epic #3576 W-B, #1714 contract) — keeps batching
// "operationally warm": emits the lead PR's multi-close lines and each sibling's brief-
// evidence CONSULTANT_CLOSEOUT block. Reuses the deterministic baton-artifact-builder.
const { buildArtifact } = require('./baton-artifact-builder');

function leadCloseBlock(lead, siblings = []) {
  const all = [lead, ...siblings].filter((n) => Number.isInteger(Number(n)));
  return all.map((n) => `Closes #${n}`).join('\n');
}

function siblingBriefEvidence(opts = {}) {
  const { sibling, lead, teamModel, rubricRating = 8, ts } = opts;
  const body = buildArtifact({
    artifact: 'CONSULTANT_CLOSEOUT', role: 'consultant', teamModel, ticket: sibling,
    fields: { status: 'review', verdict: 'approve_for_merge',
      'verification-timestamp': ts || '<ISO8601>',
      rubric_rating: `${rubricRating}/10. Full evidence on #${lead} (resolved as part of batch with #${lead}).`,
      anneal_tickets_filed: 'none', mid_flight_flaws: 'none' },
  });
  return body;
}

function buildBatchBlocks(opts = {}) {
  const { lead, siblings = [], teamModel, ts } = opts;
  return { leadClose: leadCloseBlock(lead, siblings),
    siblingBlocks: siblings.map((sibling) => ({ sibling,
      body: siblingBriefEvidence({ sibling, lead, teamModel, ts }) })) };
}

module.exports = { leadCloseBlock, siblingBriefEvidence, buildBatchBlocks };
