// Ticket Log — full audit trail of all tickets (all statuses)
// Separate from Agent Baton which shows only active-baton tickets

const STATUS_META = {
  backlog:      { icon: '📋', cls: 'tl-backlog' },
  'in-progress':{ icon: '🔄', cls: 'tl-active'  },
  closed:       { icon: '✅', cls: 'tl-closed'  },
  cancelled:    { icon: '🚫', cls: 'tl-cancelled'},
  done:         { icon: '✅', cls: 'tl-closed'  },
};

function renderTicketLog(tickets) {
  if (!tickets || !tickets.length) {
    return `<div class="tlog-empty">📋 No ticket history yet.<br>
      <span style="font-size:0.75rem">Tickets appear once events are emitted.</span></div>`;
  }
  const open = tickets.filter(t => !['closed','cancelled','done'].includes(t.status));
  const closed = tickets.filter(t =>  ['closed','cancelled','done'].includes(t.status));
  let html = '';
  if (open.length) html += renderTicketSection('Active / Backlog', open);
  if (closed.length) html += `<details class="tlog-closed-group" open>
    <summary>📁 ${closed.length} closed / cancelled</summary>
    ${renderTicketSection(null, closed)}
  </details>`;
  return `<div class="tlog-wrap">${html}</div>`;
}

function renderTicketSection(heading, tickets) {
  const rows = tickets.map(renderTicketRow).join('');
  return heading
    ? `<div class="tlog-section"><div class="tlog-heading">${heading}</div>${rows}</div>`
    : `<div class="tlog-section">${rows}</div>`;
}

function renderTicketRow(t) {
  const m = STATUS_META[t.status] || { icon: '❓', cls: 'tl-unknown' };
  const title = t.title ? `<span class="tlog-title">${esc(t.title)}</span>` : '';
  const epic = t.epic ? `<span class="tlog-epic">Epic #${t.epic}</span>` : '';
  const role = t.activeRole
    ? `<span class="tlog-role">${esc(t.activeRole)}</span>` : '';
  const agent = t.agent ? `<span class="tlog-agent">🎭 ${esc(t.agent)}</span>` : '';
  return `<div class="tlog-row ${m.cls}">
    <span class="tlog-status">${m.icon}</span>
    <span class="tlog-id">#${t.issue}</span>
    ${epic}${title}
    <span class="tlog-badges">${role}${agent}</span>
  </div>`;
}
