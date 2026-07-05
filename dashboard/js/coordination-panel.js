// Coordination Panel — cross-team session state (#1611) | ≤100 lines
// Renders active team sessions, PR links, baton roles, and cleanup candidates
/* global escapeHtml */

const TEAM_ICONS = {
  copilot: '🤖', 'claude-code': '🟠', codex: '🟦',
  antigravity: '🌌', cursor: '🎯', unknown: '❓'
};
const TEAM_COLORS = {
  copilot: 'coord-copilot', 'claude-code': 'coord-claude',
  codex: 'coord-codex', antigravity: 'coord-antigravity',
  cursor: 'coord-cursor', unknown: 'coord-unknown'
};
const STALE_CLAIM_MS = 30 * 60 * 1000;
function safeInt(v) { const num = Number(v); return Number.isFinite(num) && num > 0 ? Math.floor(num) : 0; }

function classifyCoordEntries(entries) {
  const now = Date.now();
  const active = [];
  const cleanup = [];
  for (const e of entries) {
    const age = now - (e.updatedMs || 0);
    if (age > STALE_CLAIM_MS || e.state === 'expired') {
      cleanup.push({ ...e, staleAge: age });
    } else {
      active.push(e);
    }
  }
  return { active, cleanup };
}

function renderCoordCard(entry) {
  const icon = TEAM_ICONS[entry.team] || '❓';
  const cls = TEAM_COLORS[entry.team] || 'coord-unknown';
  const role = entry.batonRole
    ? `<span class="coord-role coord-role-${entry.batonRole.replace(/[^a-z-]/gi, '')}">${escapeHtml(entry.batonRole)}</span>`
    : '';
  const tN = safeInt(entry.ticket);
  const ticket = tN ? `<a class="coord-ticket" href="https://github.com/chf3198/megingjord-harness/issues/${tN}" target="_blank">#${tN}</a>` : '';
  const pN = safeInt(entry.prNumber);
  const pr = pN ? `<a class="coord-pr" href="https://github.com/chf3198/megingjord-harness/pull/${pN}" target="_blank">PR #${pN}</a>` : '';
  const branch = entry.branch
    ? `<span class="coord-branch" title="${escapeHtml(entry.branch)}">⑂ ${escapeHtml(entry.branch)}</span>`
    : '';
  return `<div class="coord-card ${cls}" role="article" aria-label="${escapeHtml(entry.team)} session">
    <div class="coord-header">${icon} <strong>${escapeHtml(entry.team)}</strong>${role}${ticket}</div>
    <div class="coord-meta">${branch}${pr}</div>
    <div class="coord-claim">${escapeHtml(entry.claimStatus || 'active')}</div>
  </div>`;
}

const MS_PER_MIN = 60000;

function renderCleanupCard(entry) {
  const icon = TEAM_ICONS[entry.team] || '❓';
  const mins = Math.round((entry.staleAge || 0) / MS_PER_MIN);
  return `<div class="coord-card coord-stale" role="article">
    <div class="coord-header">${icon} <strong>${escapeHtml(entry.team)}</strong>
      <span class="coord-stale-badge">stale ${mins}m</span></div>
    <div class="coord-meta">⑂ ${escapeHtml(entry.branch || '—')}</div>
    <div class="coord-claim">${escapeHtml(entry.ticket ? '#' + entry.ticket : 'no ticket')}</div>
  </div>`;
}

function renderCoordinationPanel(entries, filter) {
  if (!entries || !entries.length) {
    return '<p class="coord-empty">No active cross-team sessions.</p>';
  }
  const filtered = (filter && filter !== 'all')
    ? entries.filter(e => e.team === filter)
    : entries;
  const { active, cleanup } = classifyCoordEntries(filtered);
  const cards = active.map(renderCoordCard).join('');
  const cleanupHtml = cleanup.length
    ? `<h4 class="coord-cleanup-title">🧹 Cleanup Candidates (${cleanup.length})</h4>
       <div class="coord-grid">${cleanup.map(renderCleanupCard).join('')}</div>`
    : '';
  return `<div class="coord-grid">${cards}</div>${cleanupHtml}`;
}

async function fetchCoordinationState() {
  try {
    const res = await fetch('/api/coordination');
    return res.ok ? res.json() : [];
  } catch { return []; }
}

if (typeof module !== 'undefined') {
  module.exports = {
    renderCoordinationPanel, fetchCoordinationState,
    classifyCoordEntries, TEAM_ICONS
  };
} else {
  Object.assign(window, {
    renderCoordinationPanel, fetchCoordinationState,
    classifyCoordEntries, TEAM_ICONS
  });
}
