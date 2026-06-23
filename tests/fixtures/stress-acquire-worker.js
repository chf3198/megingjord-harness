
const path = require('path');
const { acquire } = require(path.join(__dirname, '..', '..', 'scripts', 'global', 'worktree-active-session-lock.js'));
const [,, rootDir, team, ticket] = process.argv;
const r = acquire(rootDir, team, Number(ticket));
process.send && process.send(r);
process.exit(r.ok ? 0 : 1);
