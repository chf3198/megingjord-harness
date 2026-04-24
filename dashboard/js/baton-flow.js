/* global esc, getTicketLog, pruneStaleBaton, detectMissingEvents, getTicketTimeline */
const BATON_ROLES = [
  { id: 'manager', icon: '🎯', label: 'Mgr' },
  { id: 'collaborator', icon: '🔧', label: 'Collab' },
  { id: 'admin', icon: '⚙️', label: 'Admin' },
  { id: 'consultant', icon: '🔍', label: 'Review' }
];

function renderBatonFlow(batonState) {
  let tickets = normalizeBaton(batonState);
  if (typeof pruneStaleBaton === 'function') {
    const logSnapshot = typeof getTicketLog === 'function' ? getTicketLog() : [];
    tickets = pruneStaleBaton(tickets, logSnapshot);
  }
  const INACTIVE = new Set(['done', 'cancelled', 'backlog']);
  const activelyWorked = tickets.filter(t => !INACTIVE.has(t.status));
  if (!activelyWorked.length) {
    return `<div class="baton-flow"><div class="baton-empty">🎯 No tickets in active LLM work<br>
      <small>Open tickets appear here automatically. See Ticket Log for full history.</small></div></div>`;
  }
  const rows = activelyWorked.map(renderBatonRow).join('');
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
  const model = t.model ? `<span class="baton-model">🤖 ${esc(t.model)}</span>` : '';
  const title = t.title ? `<span class="baton-title" title="${esc(t.title)}">${esc(t.title)}</span>` : '';
  const epic = t.epic ? `<span class="baton-epic">Epic #${t.epic}</span>` : '';
  const gaps = typeof detectMissingEvents === 'function'
    ? detectMissingEvents(t.issue) : [];
  const gapWarn = gaps.length
    ? `<span class="baton-gap">⚠️ Skipped: ${gaps.join(', ')}</span>` : '';
  const staleWarn = t.stale ? '<span class="baton-gap">⏳ stale &gt;30m</span>' : '';
  const tl = renderTimeline(t.issue);
  return `<div class="baton-row">
    <div class="baton-meta">
      ${epic}
      <span class="baton-issue">#${t.issue || '?'}</span>
      ${title}
      <span class="badge ${badge}">${t.status || 'idle'}</span>
      ${agent} ${model} ${gapWarn} ${staleWarn}
    </div>
    <div class="baton-pipeline">${steps}</div>
    ${tl}
  </div>`;
}

function statusBadge(s) {
  return ({ 'in-progress': 'active', ready: 'degraded', done: 'healthy', idle: 'unknown', review: 'degraded' })[s] || 'unknown';
}

function normalizeBaton(state) {
  if (!state) return [];
  if (Array.isArray(state)) return state.filter(t => t.issue);
  if (state.issue) return [state];
  return [];
}

function renderTimeline(issue) {
  const tl = typeof getTicketTimeline === 'function'
    ? getTicketTimeline(issue) : [];
  if (!tl.length) return '';
  const roleDesc = {
    manager: 'Manager: scope defined, ACs written',
    collaborator: 'Collaborator: implementation + validation',
    admin: 'Admin: CI gates run, PR merged',
    consultant: 'Consultant: critique + CLOSEOUT'
  };
  const items = tl.map((h, i) => {
    const r = BATON_ROLES.find(x => x.id === h.role);
    const t = h.ts ? new Date(h.ts).toLocaleTimeString() : '?';
    const ttl = `${roleDesc[h.role] || h.role} \u2014 at ${t}`;
    return `<span class="tl-step" title="${esc(ttl)}">${r?.icon || '?'} ${t}</span>${i < tl.length - 1 ? ' → ' : ''}`;
  }).join('');
  return `<div class="baton-timeline" title="Baton handoff history">${items}</div>`;
}

function buildBatonState(routerLog) {
  if (!routerLog || !routerLog.length) return [];
  const last = routerLog[0];
  const roleMap = { router: 'manager', implementer: 'collaborator', quick: 'admin' };
  const title = last.task ? last.task.replace(/#\d+\s*/g, '').trim() : '';
  return [{ activeRole: roleMap[last.agent] || 'manager',
    issue: last.task?.match(/#(\d+)/)?.[1] || null, status: 'in-progress', title }];
}
Object.assign(window, { renderBatonFlow, buildBatonState });
