// Coordination Filter — team dropdown + conflict highlights (#1611) | ≤100 lines
/* global Alpine, escapeHtml */

(function () {
  'use strict';
  let _coordFilter = 'all';

  function getCoordFilter() { return _coordFilter; }

  function setCoordFilter(value) {
    _coordFilter = value || 'all';
    const el = document.querySelector('[x-data]');
    if (el && typeof Alpine !== 'undefined') {
      const data = Alpine.$data(el);
      if (data) data.coordinationState = [...data.coordinationState];
    }
  }

  function applyCoordFilter(entries) {
    if (!_coordFilter || _coordFilter === 'all') return entries;
    return (entries || []).filter(e => e.team === _coordFilter);
  }

  function getTeamList(entries) {
    return [...new Set((entries || []).map(e => e.team).filter(Boolean))].sort();
  }

  function renderCoordFilterBar(entries) {
    const teams = getTeamList(entries);
    const opts = teams.map(t =>
      `<option value="${escapeHtml(t)}" ${_coordFilter === t ? 'selected' : ''}>${escapeHtml(t)}</option>`
    ).join('');
    return `<div class="coord-filter-bar">
      <select onchange="setCoordFilter(this.value)" title="Filter by team"
              aria-label="Filter coordination by team">
        <option value="all">All teams</option>${opts}</select>
    </div>`;
  }

  function groupConflicts(groups, type, prefix, severity) {
    return Object.entries(groups)
      .filter(([, v]) => v.length > 1)
      .map(([k, v]) => ({
        type, key: prefix + k, severity,
        teams: [...new Set(v.map(e => e.team))]
      }));
  }

  function detectCoordConflicts(entries) {
    if (!entries || entries.length < 2) return [];
    const byTicket = {}, byBranch = {}, byFile = {};
    for (const e of entries) {
      if (e.ticket) {
        const k = String(e.ticket);
        if (!byTicket[k]) byTicket[k] = [];
        byTicket[k].push(e);
      }
      if (e.branch) {
        if (!byBranch[e.branch]) byBranch[e.branch] = [];
        byBranch[e.branch].push(e);
      }
      for (const filePath of (e.files || [])) {
        if (!byFile[filePath]) byFile[filePath] = [];
        byFile[filePath].push(e);
      }
    }
    return [
      ...groupConflicts(byTicket, 'ticket', '#', 'hard'),
      ...groupConflicts(byBranch, 'branch', '', 'hard'),
      ...groupConflicts(byFile, 'file', '', 'advisory'),
    ];
  }

  function renderCoordConflicts(entries) {
    const conflicts = detectCoordConflicts(entries);
    if (!conflicts.length) return '';
    return conflicts.map(c => {
      const icon = c.severity === 'hard' ? '🚨' : '⚠️';
      const label = c.severity === 'hard' ? 'Conflict' : 'Adjacency risk';
      return `<div class="coord-conflict coord-conflict-${c.severity}" role="alert">
        <strong>${icon} ${label}:</strong> <code>${escapeHtml(c.key)}</code>
        — ${c.teams.map(t => escapeHtml(t)).join(', ')}
      </div>`;
    }).join('');
  }

  if (typeof module !== 'undefined') {
    module.exports = {
      getCoordFilter, setCoordFilter, applyCoordFilter,
      renderCoordFilterBar, detectCoordConflicts, renderCoordConflicts
    };
  } else {
    Object.assign(window, {
      getCoordFilter, setCoordFilter, applyCoordFilter,
      renderCoordFilterBar, detectCoordConflicts, renderCoordConflicts
    });
  }
})();
