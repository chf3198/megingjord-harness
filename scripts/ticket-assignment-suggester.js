#!/usr/bin/env node
// Prototype: Suggest role handoff based on ticket labels/body — ticket 118
function suggestAssignee(ticket) {
  // ticket: { number, title, labels: [], body }
  if (!ticket) return null;
  const labels = (ticket.labels || []).map(l => l.toLowerCase());
  if (labels.includes('security') || /security|vuln|auth/i.test(ticket.title + ' ' + (ticket.body||''))) return 'architect';
  if (labels.includes('bug') || /fix|bug|error/i.test(ticket.title + ' ' + (ticket.body||''))) return 'implementer';
  if (labels.includes('docs') || /readme|doc|explain/i.test(ticket.title + ' ' + (ticket.body||''))) return 'quick';
  return 'planner';
}

if (require.main === module) {
  const sample = { number: 118, title: 'Research: Ticket Status-Assignment-Work', labels: ['research'] };
  console.log('suggest:', suggestAssignee(sample));
}

module.exports = { suggestAssignee };
