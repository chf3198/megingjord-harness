const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const WIKI_DIR = path.join(ROOT, 'wiki');
const WIKI_CATS = ['entities', 'concepts', 'sources', 'syntheses'];
const { computeWikiHealth } = require('./wiki/health-contract');
// #3764: browse/search across A/B/C + global/workspace scopes, and curation through the validated
// write path. The existing getWikiPages (wisdom-global-only browse) is preserved for back-compat.
const reader = require('./wiki/dashboard-reader');

function getWikiHealth() {
  return computeWikiHealth();
}

function getWikiPages() { return require('./wiki-pages-api')(WIKI_DIR, WIKI_CATS); }
function browseWiki(opts) { return reader.browseWiki(opts); }
function searchWiki(query, opts) { return reader.searchWiki(query, opts); }
function curatePage(req) { return reader.curatePage(req); }
module.exports = { getWikiHealth, getWikiPages, browseWiki, searchWiki, curatePage };
