// Parallel Ticket Stress Test — simulates multiple tickets
// moving through Agent roles simultaneously

const TICKET_TEMPLATES = [
  { id: 'T-101', label: 'API endpoint', skills: ['role-collaborator-execution',
    'openclaw-universal-system'] },
  { id: 'T-102', label: 'UI component', skills: ['web-regression-governance',
    'playwright-vision-low-resource'] },
  { id: 'T-103', label: 'Docs update', skills: ['docs-drift-maintenance',
    'release-version-integrity'] },
];
const ROLE_SEQUENCE = ['manager', 'collaborator', 'admin', 'consultant', 'done'];
const AGENT_NAMES = {
  manager: 'Manny Scope', collaborator: 'Cody Builder',
  admin: 'Addie Merges', consultant: 'Quinn Critic'
};

function buildStressTargets() { return TICKET_TEMPLATES; }

function buildParallelTickets() {
  return TICKET_TEMPLATES.map(t => ({
    ...t, roleIdx: 0, role: ROLE_SEQUENCE[0], status: 'pending'
  }));
}

function advanceTicket(ticket) {
  ticket.roleIdx = Math.min(ticket.roleIdx + 1, ROLE_SEQUENCE.length - 1);
  ticket.role = ROLE_SEQUENCE[ticket.roleIdx];
  ticket.status = ticket.role === 'done' ? 'done' : 'active';
  return ticket;
}

async function runStressRound(phases, index) {
  const phase = phases[index % phases.length];
  const t0 = performance.now();
  await new Promise(r => setTimeout(r, 60 + Math.random() * 100));
  return { ok: phase.skills.length, fail: 0,
    ms: Math.round(performance.now() - t0), phase };
}

function renderStressPanel(run) {
  const cls = run.running ? 'badge active' : 'badge healthy';
  const tickets = run.tickets || [];
  const rows = tickets.map(t => {
    const agent = AGENT_NAMES[t.role] || '—';
    const st = t.status === 'done' ? '✅' : t.status === 'active' ? '🔄' : '⏳';
    return `<div class="stress-ticket">
      <span class="st-id">${st} ${t.id}</span>
      <span class="st-role badge ${t.role === 'done' ? 'healthy' : 'active'}">${t.role}</span>
      <span class="st-agent">${esc(agent)}</span>
    </div>`;
  }).join('');
  return `<div class="stress-grid">
    <div class="stress-header">
      <span class="${cls}">${run.last || 'idle'}</span>
      <span>Round ${run.rounds || 0}/15</span></div>
    ${tickets.length ? `<div class="stress-tickets">${rows}</div>` : ''}
    <p class="config-note">Simulates ${TICKET_TEMPLATES.length} parallel tickets
      through Manager→Collaborator→Admin→Consultant.</p>
  </div>`;
}
