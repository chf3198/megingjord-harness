// Ticket Log — full audit trail of all tickets (all statuses)
// Separate from Agent Baton which shows only active-baton tickets

const STATUS_META = {
  backlog:             { icon: '📋', cls: 'tl-backlog'          },
  todo:                { icon: '🎯', cls: 'tl-todo'             },
  'in-progress':       { icon: '🔄', cls: 'tl-active'           },
  'ready-for-testing': { icon: '📤', cls: 'tl-ready-for-testing'},
  testing:             { icon: '🧪', cls: 'tl-testing'          },
  'passed-testing':    { icon: '✔️', cls: 'tl-passed-testing'   },
  done:                { icon: '✅', cls: 'tl-done'             },
  cancelled:           { icon: '🚫', cls: 'tl-cancelled'        },
};

function renderTicketLog(tickets) {
  if (!tickets || !tickets.length) {
    return `<div class="tlog-empty">📋 No ticket history yet.<br>
      <span style="font-size:0.75rem">Tickets appear once events are emitted.</span></div>`;
  }
  // Group all tickets by epic (epics first, then sub-tickets collapsed)
  const epics = {}, standalone = [];
  for (const t of tickets) {
    if (t.epic) { (epics[t.epic] = epics[t.epic] || []).push(t); }
    else if ((t.labels || []).some(l => l === 'type:epic')) {
      (epics[t.issue] = epics[t.issue] || []).unshift(t);
    } else { standalone.push(t); }
  }
  // Ensure epic parent ticket is first in each group
  let html = '';
  for (const [epicId, items] of Object.entries(epics).sort((a,b) => b[0]-a[0])) {
    const parent = items.find(i => String(i.issue) === String(epicId));
    const children = items.filter(i => String(i.issue) !== String(epicId));
    const allDone = children.every(t => ['done','cancelled'].includes(t.status));
    const label = parent ? `Epic #${epicId}: ${esc(parent.title)}` : `Epic #${epicId}`;
    const count = children.length;
    const open = allDone ? '' : ' open';
    html += `<details class="tlog-epic-group"${open}>
      <summary class="tlog-epic-header">${label} <span class="tlog-count">(${count} sub)</span></summary>
      ${parent ? renderTicketRow(parent) : ''}
      ${renderTicketSection(null, children)}
    </details>`;
  }
  if (standalone.length) html += renderTicketSection('Standalone', standalone);
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
  const tags = (t.labels || []).map(l =>
    `<span class="tlog-tag">${esc(l)}</span>`).join('');
  const comment = t.lastComment
    ? `<div class="tlog-comment">${esc(t.lastComment.substring(0, 80))}${t.lastComment.length > 80 ? '…' : ''}</div>` : '';
  return `<div class="tlog-row ${m.cls}">
    <span class="tlog-status">${m.icon}</span>
    <span class="tlog-id">#${t.issue}</span>
    ${epic}${title}
    <span class="tlog-badges">${tags}${role}${agent}</span>
    ${comment}
  </div>`;
}
