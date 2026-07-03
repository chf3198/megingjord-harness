
const { acquire } = require('/home/curtisfranks/megingjord-harness/scripts/global/worktree-active-session-lock.js');
const [,, rootDir, team, ticket] = process.argv;
const r = acquire(rootDir, team, Number(ticket));
process.send && process.send(r);
process.exit(r.ok ? 0 : 1);
