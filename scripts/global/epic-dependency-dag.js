'use strict';
// Refs #1292 — Cross-issue dependency DAG with native API + text fallback.
// Per Epic #1271 AC5. Detects cycles + unresolved blockers. Uses RateLimitGuard from C9.

const TEXT_DEPS = [
  /\b(Depends-on|Blocked-by|Blocks|Coupled-with):\s*#(\d+)/gi,
];

function parseTextDeps(body) {
  const edges = [];
  for (const re of TEXT_DEPS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(body || '')) !== null) {
      edges.push({ kind: m[1].toLowerCase(), target: Number(m[2]), source: 'text' });
    }
  }
  return edges;
}

const STATUS_NOT_FOUND = 404;
const STATUS_FORBIDDEN = 403;

async function fetchNativeDeps(github, owner, repo, issueNumber, guard) {
  try {
    const apiPath = `/repos/${owner}/${repo}/issues/${issueNumber}/dependencies`;
    const fn = () => github.request(`GET ${apiPath}`);
    const result = guard ? await guard.withGuard(`deps:${issueNumber}`, fn) : await fn();
    const data = result.value?.data || result.data || [];
    return data.map(dep => ({ kind: dep.relationship || 'blocked-by', target: dep.number, source: 'native' }));
  } catch (err) {
    if (err.status === STATUS_NOT_FOUND || err.status === STATUS_FORBIDDEN) return null;
    throw err;
  }
}

async function buildEdges(github, owner, repo, issueNumber, body, guard) {
  const native = await fetchNativeDeps(github, owner, repo, issueNumber, guard);
  if (native) return native;
  return parseTextDeps(body);
}

function detectCycles(graph) {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map();
  for (const node of graph.keys()) color.set(node, WHITE);
  const cycles = [];
  function dfs(node, stack) {
    color.set(node, GRAY);
    stack.push(node);
    for (const next of graph.get(node) || []) {
      if (color.get(next) === GRAY) {
        const idx = stack.indexOf(next);
        cycles.push(stack.slice(idx).concat(next));
      } else if (color.get(next) === WHITE) {
        dfs(next, stack);
      }
    }
    stack.pop();
    color.set(node, BLACK);
  }
  for (const node of graph.keys()) {
    if (color.get(node) === WHITE) dfs(node, []);
  }
  return cycles;
}

function buildGraph(edgesByIssue) {
  const graph = new Map();
  for (const [issue, edges] of Object.entries(edgesByIssue)) {
    const node = Number(issue);
    if (!graph.has(node)) graph.set(node, new Set());
    for (const e of edges) {
      if (e.kind === 'depends-on' || e.kind === 'blocked-by') graph.get(node).add(e.target);
      if (e.kind === 'blocks') {
        if (!graph.has(e.target)) graph.set(e.target, new Set());
        graph.get(e.target).add(node);
      }
    }
  }
  return graph;
}

module.exports = { parseTextDeps, fetchNativeDeps, buildEdges, detectCycles, buildGraph };
