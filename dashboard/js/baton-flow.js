// Baton Flow — Agent role workflow visualization
// Shows Manager→Collaborator→Admin→Consultant pipeline

function renderBatonFlow(batonState) {
  const roles = [
    { id: 'manager', icon: '🎯', label: 'Manager', desc: 'Scope & tickets' },
    { id: 'collaborator', icon: '🔧', label: 'Collaborator', desc: 'Implement' },
    { id: 'admin', icon: '⚙️', label: 'Admin', desc: 'Merge & deploy' },
    { id: 'consultant', icon: '🔍', label: 'Consultant', desc: 'Review & close' }
  ];
  const active = batonState?.activeRole || 'idle';
  const issue = batonState?.issue || null;
  const status = batonState?.status || 'idle';

  const steps = roles.map((r, i) => {
    let cls = 'baton-step';
    if (r.id === active) cls += ' active';
    else if (roles.findIndex(x => x.id === active) > i) cls += ' done';
    const arrow = i < roles.length - 1
      ? '<div class="baton-arrow"><svg width="20" height="14" viewBox="0 0 20 14"><path d="M0 7h16m-5-5l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></div>'
      : '';
    return `<div class="${cls}">
      <div class="baton-icon">${r.icon}</div>
      <div class="baton-label">${r.label}</div>
      <div class="baton-desc">${r.desc}</div>
    </div>${arrow}`;
  }).join('');

  const header = issue
    ? `<div class="baton-header"><span class="baton-issue">#${issue}</span><span class="baton-status badge ${statusBadge(status)}">${status}</span></div>`
    : '<div class="baton-header"><span class="baton-idle">No active baton</span></div>';

  return `<div class="baton-flow">${header}<div class="baton-pipeline">${steps}</div></div>`;
}

function statusBadge(s) {
  const m = { 'in-progress': 'active', ready: 'degraded', done: 'healthy', idle: 'unknown' };
  return m[s] || 'unknown';
}

// Simulate baton state from recent GitHub activity
function buildBatonState(routerLog) {
  if (!routerLog || !routerLog.length) {
    return { activeRole: 'idle', issue: null, status: 'idle' };
  }
  const last = routerLog[0];
  const roleMap = { router: 'manager', implementer: 'collaborator', quick: 'admin' };
  return {
    activeRole: roleMap[last.agent] || 'manager',
    issue: last.task?.match(/#(\d+)/)?.[1] || null,
    status: 'in-progress'
  };
}
