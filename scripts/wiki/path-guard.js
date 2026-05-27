'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_WIKI_DIR = path.join(__dirname, '../../wiki');

function realOrResolve(p) {
  try { return fs.realpathSync(p); } catch { return path.resolve(p); }
}

function inTree(root, target) {
  return target === root || target.startsWith(`${root}${path.sep}`);
}

function assertWikiDir(wikiDir = REPO_WIKI_DIR, options = {}) {
  const resolved = realOrResolve(wikiDir);
  if (options.allowExternalWikiDir) return resolved;
  const root = realOrResolve(REPO_WIKI_DIR);
  if (!inTree(root, resolved)) {
    throw new Error(`Refusing external wikiDir: ${resolved} (outside ${root})`);
  }
  return resolved;
}

module.exports = { REPO_WIKI_DIR, assertWikiDir };
