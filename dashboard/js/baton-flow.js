// Baton Flow — Multi-ticket parallel agent baton visualization
// Shows Manager→Collaborator→Admin→Consultant per ticket

const BATON_ROLES = [
  { id: 'manager', icon: '🎯', label: 'Mgr' },
  { id: 'collaborator', icon: '🔧', label: 'Collab' },
  { id: 'admin', icon: '⚙️', label: 'Admin' },
  { id: 'consultant', icon: '🔍', label: 'Review' }
];

function renderBatonFlow(batonState) {
  const tickets = normalizeBaton(batonState);
  if (!tickets.length) {
    return `<div class="baton-flow">
      <div class="baton-empty">No active tickets</div></div>`;
  }
  const rows = tickets.map(renderBatonRow).join('');
  return `<div class="baton-flow">${rows}</div>`;
}

function renderBatonRow(t) {
  const steps = BATON_ROLES.map((r, i) => {
    let cls = 'baton-step';
    const ai = BATON_ROLES.findIndex(x => x.id === t.activeRole);
    if (r.id === t.activeRole) cls += ' active';
    else if (ai > i) cls += ' done';
    const arrow = i < BATON_ROLES.length - 1
      ? '<span class="baton-arrow">→</span>' : '';
    return `<span class="${cls}" title="${r.id}">
      ${r.icon}<span class="baton-lbl">${r.label}</span>
    </span>${arrow}`;
  }).join('');

  const badge = statusBadge(t.status);
  const agent = t.agent ? `<span class="baton-agent">🎭 ${esc(t.agent)}</span>` : '';
  return `<div class="baton-row">
    <div class="baton-meta">
      <span class="baton-issue">#${t.issue || '?'}</span>
      <span class="badge ${badge}">${t.status || 'idle'}</span>
      ${agent}
    </div>
    <div class="baton-pipeline">${steps}</div>
  </div>`;
}

function statusBadge(s) {
  const m = { 'in-progress': 'active', ready: 'degraded',
    done: 'healthy', idle: 'unknown' };
  return m[s] || 'unknown';
}

function normalizeBaton(state) {
  if (!state) return [];
  if (Array.isArray(state)) return state.filter(t => t.issue);
  if (state.issue) return [state];
  return [];
}

function buildBatonState(routerLog) {
  if (!routerLog || !routerLog.length) return [];
  const last = routerLog[0];
  const roleMap = { router: 'manager', implementer: 'collaborator', quick: 'admin' };
  return [{
    activeRole: roleMap[last.agent] || 'manager',
    issue: last.task?.match(/#(\d+)/)?.[1] || null,
    status: 'in-progress'
  }];
}
