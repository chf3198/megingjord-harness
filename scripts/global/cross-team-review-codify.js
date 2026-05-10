'use strict';
// Refs #1296 — Cross-team review codification. Per Epic #1271 AC12.
// Auto-file type:research ticket on >2 cross-team comments on closed parent in 14d.

const WINDOW_DAYS = 14;
const THRESHOLD = 2;

function teamModelOf(text) {
  const m = (text || '').match(/Team&Model:\s*(\S+)/);
  return m ? m[1] : null;
}

function teamPart(teamModel) {
  if (!teamModel) return null;
  const m = teamModel.match(/^([^:]+):/);
  return m ? m[1] : null;
}

function within(date, since) {
  if (!date) return false;
  return new Date(date).getTime() >= since.getTime();
}

function detectCrossTeamComments({ issueBody, comments, now = new Date() }) {
  const ownerTeam = teamPart(teamModelOf(issueBody));
  const since = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const cross = [];
  for (const c of comments) {
    if (!within(c.created_at, since)) continue;
    const t = teamPart(teamModelOf(c.body));
    if (t && ownerTeam && t !== ownerTeam) cross.push({ id: c.id, team: t, url: c.html_url });
  }
  return { ownerTeam, count: cross.length, cross };
}

async function run({ github, context, core }) {
  if (!context.payload.issue || context.payload.issue.state !== 'closed') return;
  const labels = (context.payload.issue.labels || []).map(l => l.name || l);
  if (labels.includes('no-auto-review')) return;
  const { owner, repo } = context.repo;
  const { data: comments } = await github.rest.issues.listComments({
    owner, repo, issue_number: context.payload.issue.number, per_page: 100,
  });
  const detection = detectCrossTeamComments({
    issueBody: context.payload.issue.body || '',
    comments,
  });
  if (detection.count <= THRESHOLD) return;
  const reviewingTeams = [...new Set(detection.cross.map(c => c.team))].join(', ');
  const title = `Cross-team review delivery: ${reviewingTeams} review of #${context.payload.issue.number}`;
  const body = `Auto-filed per \`instructions/cross-team-review.instructions.md\` (Epic #1271 AC12).\n\n` +
    `Closed parent: #${context.payload.issue.number}\n` +
    `Cross-team comments observed: ${detection.count}\n` +
    `Reviewing teams: ${reviewingTeams}\n\n` +
    detection.cross.map(c => `- ${c.team}: ${c.url}`).join('\n') +
    `\n\nManager: pick up to scope review delivery (peer-review test_strategy).`;
  const created = await github.rest.issues.create({
    owner, repo, title, body,
    labels: ['type:research', 'status:backlog', 'lane:docs-research', 'area:governance'],
  });
  core.notice(`Auto-filed cross-team review ticket: ${created.data.html_url}`);
}

module.exports = { detectCrossTeamComments, teamPart, teamModelOf, run, WINDOW_DAYS, THRESHOLD };
