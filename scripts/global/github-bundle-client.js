// tier: 2
// github-bundle-client.js — GitHub-native bundle distribution via Releases API. Refs #2751.
'use strict';
const https = require('node:https');
const { execSync } = require('node:child_process');

function getToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  return execSync('gh auth token', { encoding: 'utf8' }).trim();
}

function ghRequest(opts, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request(opts, (res) => {
      let body = '';
      res.on('data', (d) => { body += d; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function publishBundle(owner, repo, name, payload) {
  const token = getToken();
  // Find or create a 'bundles' release tag
  const tagName = 'bundles';
  let releaseId;
  const relRes = await ghRequest({
    hostname: 'api.github.com', method: 'GET',
    path: `/repos/${owner}/${repo}/releases/tags/${tagName}`,
    headers: { authorization: `token ${token}`, 'user-agent': 'megingjord-harness' },
  });
  if (relRes.status === 200) {
    releaseId = JSON.parse(relRes.body).id;
  } else {
    const createBody = JSON.stringify({ tag_name: tagName, name: 'Governance Bundles', draft: false, prerelease: true });
    const createRes = await ghRequest({
      hostname: 'api.github.com', method: 'POST',
      path: `/repos/${owner}/${repo}/releases`,
      headers: {
        authorization: `token ${token}`, 'user-agent': 'megingjord-harness',
        'content-type': 'application/json', 'content-length': Buffer.byteLength(createBody),
      },
    }, createBody);
    if (createRes.status >= 400) throw new Error(`release create failed: ${createRes.status}`);
    releaseId = JSON.parse(createRes.body).id;
  }
  const data = Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload));
  const uploadRes = await ghRequest({
    hostname: 'uploads.github.com', method: 'POST',
    path: `/repos/${owner}/${repo}/releases/${releaseId}/assets?name=${encodeURIComponent(name)}`,
    headers: {
      authorization: `token ${token}`, 'user-agent': 'megingjord-harness',
      'content-type': 'application/octet-stream', 'content-length': data.length,
    },
  }, data);
  if (uploadRes.status >= 400) throw new Error(`bundle upload failed: ${uploadRes.status}`);
  return JSON.parse(uploadRes.body);
}

async function fetchBundle(owner, repo, name) {
  const token = getToken();
  const relRes = await ghRequest({
    hostname: 'api.github.com', method: 'GET',
    path: `/repos/${owner}/${repo}/releases/tags/bundles`,
    headers: { authorization: `token ${token}`, 'user-agent': 'megingjord-harness' },
  });
  if (relRes.status !== 200) return null;
  const release = JSON.parse(relRes.body);
  const asset = release.assets.find((a) => a.name === name);
  if (!asset) return null;
  const dlRes = await ghRequest({
    hostname: 'api.github.com', method: 'GET',
    path: `/repos/${owner}/${repo}/releases/assets/${asset.id}`,
    headers: {
      authorization: `token ${token}`, 'user-agent': 'megingjord-harness',
      accept: 'application/octet-stream',
    },
  });
  return dlRes.body;
}

module.exports = { publishBundle, fetchBundle };
