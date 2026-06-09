// Fleet context-bundle assembler (#2802 P1-0; design D12/D15). Gives a fleet model the MOST context
// possible before a dev/review dispatch: the ticket (live work-log), a lightweight repo-map of named
// files (Aider-style signatures, no tree-sitter dep), and compiled-wiki hits — plus a manifest so a
// downstream dispatch fetches only the delta (D15). Graceful (G6): a missing source degrades to
// {available:false}, never throws. Privacy (G4): assembles LOCAL context for a LOCAL fleet model.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const RUN_TIMEOUT_MS = 15000; // per-source subprocess cap; missing/slow source degrades gracefully

function runQuiet(command) {
  try {
    return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: RUN_TIMEOUT_MS });
  } catch (error) { return ''; }
}

// Live work-log for a ticket: title + body + comment bodies (the design lives in #2792's comments).
function ticketContext(number) {
  if (!number) return null;
  const raw = runQuiet(`gh issue view ${number} --json title,body,comments`);
  if (!raw) return { number, available: false };
  try {
    const json = JSON.parse(raw);
    return {
      number, title: json.title, body: json.body, available: true,
      comments: (json.comments || []).map((comment) => comment.body),
    };
  } catch (error) { return { number, available: false }; }
}

// Lightweight repo-map: top-level fn/class/export signatures of named files (no heavy parser).
function repoMap(relPaths = [], root = process.cwd()) {
  return (relPaths || []).map((relPath) => {
    const full = path.join(root, relPath);
    if (!fs.existsSync(full)) return { path: relPath, available: false };
    const source = fs.readFileSync(full, 'utf8');
    const signatures = (source.match(/^\s*(async\s+)?(function|class|module\.exports|exports\.)[^\n{=]*/gm)
      || []).map((line) => line.trim()).slice(0, 40);
    return { path: relPath, symbols: signatures, available: true };
  });
}

// Compiled-wiki (A/B/C) search, if present on this host (graceful when absent).
function wikiContext(query, max = 3) {
  const searcher = path.join(process.env.HOME || '', '.copilot/scripts/wiki-search.js');
  if (!query || !fs.existsSync(searcher)) return [];
  const output = runQuiet(`node ${searcher} ${JSON.stringify(query)}`);
  return output ? output.split('\n').filter(Boolean).slice(0, max) : [];
}

// D15 manifest: declares what IS bundled so a downstream dispatch fetches only the delta.
function buildManifest(parts) {
  const included = Object.keys(parts).filter((key) => {
    const value = parts[key];
    return value && (Array.isArray(value) ? value.length > 0 : value.available !== false);
  });
  return { included, schema: 'fleet-context-bundle/v1' };
}

function assembleContextBundle({ ticket, paths = [], wikiQuery, alreadyBundled = [] } = {}) {
  const parts = { ticket: ticketContext(ticket), repoMap: repoMap(paths), wiki: wikiContext(wikiQuery) };
  for (const key of alreadyBundled) delete parts[key]; // D15: skip what the caller already sent
  return { ...parts, manifest: buildManifest(parts) };
}

module.exports = { assembleContextBundle, ticketContext, repoMap, wikiContext, buildManifest };
