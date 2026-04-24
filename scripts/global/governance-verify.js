#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const root = path.resolve(__dirname, '..', '..');
const dir = path.join(root, 'tickets');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort();

const childrenFromSection = txt => {
  const m = txt.match(/\nChildren:\n([\s\S]*?)(\n\n|\n##\s)/);
  if (!m) return [];
  return [...m[1].matchAll(/#(\d+)/g)].map(x => +x[1]);
};

const parse = txt => ({
  number: +(txt.match(/^# Ticket\s+(\d+)\s+—/m)?.[1] || 0),
  type: txt.match(/^Type:\s*(.+)$/m)?.[1]?.trim() || '',
  status: txt.match(/^Status:\s*(.+)$/m)?.[1]?.trim() || '',
  priority: txt.match(/^Priority:\s*(P\d)\b/m)?.[1] || '',
  children: childrenFromSection(txt),
  hasCloseout: /##\s+CONSULTANT_CLOSEOUT/m.test(txt),
  hasEvidence: /##\s+GitHub Evidence Block/m.test(txt),
});

const all = new Map();
for (const f of files) {
  const p = path.join(dir, f);
  const txt = fs.readFileSync(p, 'utf8');
  all.set(parse(txt).number, { file: f, ...parse(txt) });
}

const terminal = s => /^done\s*\(`closed`\)/i.test(s) || /^cancelled/i.test(s);
const issues = [];

for (const t of all.values()) {
  if (!/^P[0-3]$/.test(t.priority)) issues.push(`${t.file}: missing/invalid Priority`);
  if (terminal(t.status) && /role:/i.test(t.status)) issues.push(`${t.file}: closed status contains role label`);
  if (terminal(t.status) && !t.hasCloseout) issues.push(`${t.file}: missing CONSULTANT_CLOSEOUT`);
  if (terminal(t.status) && !t.hasEvidence && t.type !== 'Epic') issues.push(`${t.file}: missing GitHub Evidence Block`);
  if (t.type === 'Epic' && terminal(t.status)) {
    const kids = t.children.filter(n => n !== t.number && all.has(n));
    const openKids = kids.filter(n => !terminal(all.get(n).status));
    if (openKids.length) issues.push(`${t.file}: epic closed with open children ${openKids.join(', ')}`);
  }
}

const result = {
  checkedTickets: all.size,
  failedChecks: issues.length,
  status: issues.length ? 'fail' : 'pass',
  issues,
  runAt: new Date().toISOString(),
};

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`Governance verify: ${result.status.toUpperCase()} (${result.checkedTickets} tickets)`);
  if (issues.length) issues.forEach(i => console.log(`- ${i}`));
}
process.exit(issues.length ? 1 : 0);
