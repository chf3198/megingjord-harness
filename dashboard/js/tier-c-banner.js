// Tier-C Banner + Conflict Alert — Epic #742 | ≤100 lines

const TIER_C_MSG = 'Limited-mode agent detected: Tier-C agents have restricted';
const TIER_C_MSG2 = ' repo access. Review lease assignments before merging.';

function getTierCAgents(sessions) {
  return (sessions || []).filter(function(s) { return s.tier === 'C'; });
}

function renderTierCBanner(sessions) {
  var tierC = getTierCAgents(sessions);
  if (!tierC.length) return '';
  var names = tierC.map(function(s) { return s.vendor + ':' + s.agentId; }).join(', ');
  return '<div class="tier-c-banner" role="alert" aria-live="polite">'
    + '<span class="tier-c-icon">⚠️</span>'
    + '<span>' + TIER_C_MSG + TIER_C_MSG2 + '</span>'
    + '<details><summary>Affected agents</summary>'
    + '<ul>' + tierC.map(function(s) {
        return '<li>' + s.vendor + ' / ' + s.agentId + ' (branch: ' + (s.branch || '?') + ')</li>';
      }).join('') + '</ul></details></div>';
}

function groupBy(sessions, key) {
  var groups = {};
  sessions.forEach(function(s) {
    if (s[key]) {
      if (!groups[s[key]]) groups[s[key]] = [];
      groups[s[key]].push(s);
    }
  });
  return groups;
}

function conflictsFromGroup(groups, type, prefix) {
  var out = [];
  Object.keys(groups).forEach(function(k) {
    if (groups[k].length > 1) {
      out.push({ type: type, key: prefix + k,
        agents: groups[k].map(function(s) { return s.vendor + ':' + s.agentId; }) });
    }
  });
  return out;
}

function detectConflicts(sessions) {
  if (!sessions || sessions.length < 2) return [];
  var byTicket = groupBy(sessions, 'ticket');
  var byBranch = groupBy(sessions, 'branch');
  return conflictsFromGroup(byTicket, 'ticket', '#')
    .concat(conflictsFromGroup(byBranch, 'branch', ''));
}

function renderConflictAlerts(sessions) {
  var conflicts = detectConflicts(sessions);
  if (!conflicts.length) return '';
  return conflicts.map(function(c) {
    var label = c.type === 'ticket' ? 'Ticket conflict' : 'Branch conflict';
    return '<div class="conflict-alert" role="alert">'
      + '<strong>🚨 ' + label + ':</strong> <code>' + c.key + '</code>'
      + ' claimed by: ' + c.agents.join(', ')
      + '<br><small>Resolve lease assignment before push.</small></div>';
  }).join('');
}

window.renderTierCBanner = renderTierCBanner;
window.renderConflictAlerts = renderConflictAlerts;
window.detectConflicts = detectConflicts;
