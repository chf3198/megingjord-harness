// Governance Panel — compliance scorecard + drift coverage
// Replaces raw hook paths with actionable metrics

const GOV_DRIFT_CATEGORIES = [
  { id: 'git', name: 'Git Protocol', hooks: ['commit_ticket_gate'] },
  { id: 'baton', name: 'Baton Sequencing', hooks: ['pretool_guard'] },
  { id: 'ticket', name: 'Ticket Lifecycle', hooks: ['commit_ticket_gate'] },
  { id: 'tool', name: 'Tool Misuse', hooks: ['pretool_guard'] },
  { id: 'scope', name: 'Scope Drift', hooks: ['posttool_reminders'] },
  { id: 'file', name: 'File Governance', hooks: ['pretool_guard'] },
];

function renderGovernancePanel(state = {}) {
  const enabled = state.enabled !== false;
  const hooks = state.hooks || {};
  const allHooks = [
    ...(hooks.PreToolUse || []),
    ...(hooks.PostToolUse || []),
    ...(hooks.UserPromptSubmit || []),
    ...(hooks.Stop || []),
  ];
  const totalGates = allHooks.length;
  const events = Object.keys(hooks).filter(k => (hooks[k]||[]).length > 0);
  const badge = enabled
    ? '<span class="gov-badge gov-on">🛡️ Active</span>'
    : '<span class="gov-badge gov-off">⚠️ Disabled</span>';
  const matrix = GOV_DRIFT_CATEGORIES.map(cat => {
    const covered = cat.hooks.some(h =>
      allHooks.some(x => x.command?.includes(h)));
    const icon = covered ? '✅' : '❌';
    const cls = covered ? 'gov-covered' : 'gov-uncovered';
    return `<div class="gov-drift-item ${cls}">
      <span>${icon}</span><span>${cat.name}</span></div>`;
  }).join('');
  const coveredCount = GOV_DRIFT_CATEGORIES
    .filter(c => c.hooks.some(h =>
      allHooks.some(x => x.command?.includes(h)))).length;
  const pct = Math.round((coveredCount / GOV_DRIFT_CATEGORIES.length) * 100);
  const gateNames = allHooks.map(h => {
    const cmd = h.command || '';
    const match = cmd.match(/\/([^/]+)\.py/);
    return match ? match[1].replace(/_/g, ' ') : cmd.slice(-30);
  });
  const gateList = gateNames.length
    ? gateNames.map(g => `<span class="gov-gate">${g}</span>`).join('')
    : '<span class="gov-none">No hooks installed</span>';
  return `<div class="governance-grid">
    <div class="gov-card gov-summary">
      <div class="gov-header">${badge}
        <span class="gov-score">${pct}% coverage</span></div>
      <div class="gov-stat">${totalGates} gates · ${events.length} events</div>
    </div>
    <div class="gov-card">
      <h3>Drift Coverage</h3>
      <div class="gov-drift-grid">${matrix}</div>
    </div>
    <div class="gov-card">
      <h3>Active Gates</h3>
      <div class="gov-gates">${gateList}</div>
    </div></div>`;
}

async function fetchGovernanceState() {
  try {
    const r = await fetch('/api/governance');
    if (!r.ok) return {};
    return await r.json();
  } catch (e) { return { error: 'fetch failed' }; }
}

function escapeHtml(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
