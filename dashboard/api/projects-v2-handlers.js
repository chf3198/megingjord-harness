'use strict';
const https = require('node:https');
const projects = require('../../scripts/global/projects-v2-state.js');

const CACHE_TTL_MS = 60_000;
let _cache = null; let _cacheAt = 0;

function buildClient(token) {
  return {
    graphql(query, variables) {
      return new Promise((resolve, reject) => {
        const body = JSON.stringify({ query, variables });
        const opts = {
          hostname: 'api.github.com', path: '/graphql', method: 'POST',
          headers: { Authorization: `bearer ${token}`, 'Content-Type': 'application/json',
            'User-Agent': 'megingjord-dashboard/1', 'Content-Length': Buffer.byteLength(body) },
        };
        const req = https.request(opts, (res) => {
          let raw = '';
          res.on('data', (c) => { raw += c; });
          res.on('end', () => {
            try { const parsed = JSON.parse(raw); if (parsed.errors) reject(new Error(parsed.errors[0].message)); else resolve(parsed.data); }
            catch (e) { reject(e); }
          });
        });
        req.on('error', reject); req.write(body); req.end();
      });
    },
  };
}

async function fetchInFlight() {
  const token = process.env.GITHUB_TOKEN;
  const projectId = process.env.MEGINGJORD_PROJECTS_V2_ID;
  if (!token || !projectId) return { items: [], reason: 'missing-config' };
  const nodes = await projects.listInFlight(buildClient(token), projectId);
  return { items: nodes };
}

async function handleProjectsV2InFlight(_req, res) {
  if (projects.disabled()) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ items: [], disabled: true }));
  }
  const now = Date.now();
  if (_cache && now - _cacheAt < CACHE_TTL_MS) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(_cache));
  }
  try {
    const result = await fetchInFlight();
    _cache = result; _cacheAt = now;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(result));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ items: [], error: err.message }));
  }
}

module.exports = { handleProjectsV2InFlight, _resetCache() { _cache = null; _cacheAt = 0; } };
