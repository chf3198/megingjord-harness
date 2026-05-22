'use strict';
const cp = require('child_process');

const raw = cp.execFileSync('gh', ['issue', 'list', '--state', 'open', '--limit', '500', '--json', 'number,title,body,labels'], { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
const issues = JSON.parse(raw);

const rawAllEpics = cp.execFileSync('gh', ['issue', 'list', '--limit', '1000', '--json', 'number,title,body,labels'], { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
const allIssues = JSON.parse(rawAllEpics);
const epicNumbers = new Set(allIssues.filter(i => i.labels.some(l => l.name === 'type:epic')).map(i => i.number));

const childTickets = [];
const trueIndependent = [];
const activeEpics = [];
const driftFindings = [];

for (const issue of issues) {
  const isEpic = issue.labels.some(l => l.name === 'type:epic');
  if (isEpic) {
    const isDone = issue.labels.some(l => l.name === 'status:done');
    if (!isDone) activeEpics.push(issue);
    continue;
  }
  
  const body = issue.body || '';
  const title = issue.title || '';
  const parentMatch = body.match(/parent\s*(?:epic)?\s*:\s*#?(\d+)/i) || body.match(/part\s*of\s*#?(\d+)/i);
  let parentEpicNum = parentMatch ? Number(parentMatch[1]) : null;
  
  const titleEpicMatch = title.match(/\(Epic\s*#?(\d+)\)/i);
  if (titleEpicMatch && !parentEpicNum) {
    parentEpicNum = Number(titleEpicMatch[1]);
    driftFindings.push({
      issue: issue.number,
      title: issue.title,
      type: 'Implicit Parent Drift',
      message: `Mentions parent Epic #${parentEpicNum} in title, but lacks standard "Parent Epic: #${parentEpicNum}" metadata in its body.`
    });
  }
  
  if (!parentEpicNum) {
    for (const epicNum of epicNumbers) {
      const regex = new RegExp(`\\b(?:Epic|Issue|Parent|under|for)\\s+#${epicNum}\\b`, 'i');
      if (regex.test(body) || regex.test(title)) {
        parentEpicNum = epicNum;
        driftFindings.push({
          issue: issue.number,
          title: issue.title,
          type: 'Unstructured Epic Association',
          message: `References Epic #${epicNum} without formal parent-child metadata declaration.`
        });
        break;
      }
    }
  }

  const isDone = issue.labels.some(l => l.name === 'status:done');
  if (!isDone) {
    if (parentEpicNum) {
      childTickets.push({ number: issue.number, title: issue.title, parentEpicNum });
    } else {
      trueIndependent.push(issue);
    }
  }
}

console.log(JSON.stringify({ activeEpics, trueIndependent, childTickets, driftFindings }, null, 2));
