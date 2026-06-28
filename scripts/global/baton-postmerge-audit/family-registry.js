'use strict';
// family-registry.js — team-to-model-family mapping and cross-family assertion
// for the post-merge consultant audit (W5, Epic #3284, Refs #3293).
// The cross-family invariant: the reviewer model family MUST differ from the
// authoring team's primary family. This is enforced for ALL teams.

// Each team maps to a PRIMARY model family. Teams that use multiple families
// (copilot routes to claude/gpt/qwen/gemini; cursor routes to claude/gpt)
// map to their dominant family for authorship attribution. The reviewer must
// belong to a DIFFERENT family than the author's primary.
const TEAM_FAMILY_MAP = {
  'claude-code': 'anthropic',
  'copilot': 'openai',
  'codex': 'openai',
  'antigravity': 'google',
  'openclaw': 'local',
  'cursor': 'openai',
};

// Recognized model families for reviewer classification.
const KNOWN_FAMILIES = [
  'anthropic', 'openai', 'google', 'meta', 'mistral',
  'qwen', 'local', 'cohere', 'deepseek',
];

/**
 * Resolve the primary model family for a given team name.
 * Returns the family string or null if the team is unknown.
 */
function teamToFamily(team) {
  if (!team || typeof team !== 'string') return null;
  const normalized = team.toLowerCase().trim();
  return TEAM_FAMILY_MAP[normalized] || null;
}

/**
 * Assert that the reviewer's model family differs from the author team's
 * primary family (the cross-family invariant).
 * Returns true when cross-family holds (different families).
 * Returns false when the invariant is violated (same family).
 * Throws on missing/invalid inputs so callers cannot silently skip the check.
 */
function assertCrossFamily(authorTeam, reviewerFamily) {
  if (!authorTeam || typeof authorTeam !== 'string') {
    throw new Error('assertCrossFamily: authorTeam is required');
  }
  if (!reviewerFamily || typeof reviewerFamily !== 'string') {
    throw new Error('assertCrossFamily: reviewerFamily is required');
  }
  const authorFamily = teamToFamily(authorTeam);
  if (!authorFamily) {
    throw new Error(
      `assertCrossFamily: unknown team "${authorTeam}"`
    );
  }
  const normalizedReviewer = reviewerFamily.toLowerCase().trim();
  return authorFamily !== normalizedReviewer;
}

module.exports = {
  TEAM_FAMILY_MAP,
  KNOWN_FAMILIES,
  teamToFamily,
  assertCrossFamily,
};
