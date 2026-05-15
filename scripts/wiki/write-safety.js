// scripts/wiki/write-safety.js — Multi-repo write-path safety + provenance (#871).
// Leverages HAMR R2 mailbox (#918) primitives for cross-team write coordination
// instead of building parallel locking. Wiki writes embed provenance fields.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const LOCK_DIR = path.resolve(__dirname, '..', '..', '.megingjord', 'wiki-locks');
const LOCK_TTL_MS = 5 * 60 * 1000;
const PROVENANCE_FIELDS = ['author', 'team', 'model', 'agent_role', 'commit'];
const TEAM_APPEND_FIELDS = ['thread_id', 'append_position'];

function ensureLockDir() {
  fs.mkdirSync(LOCK_DIR, { recursive: true });
}

function lockKey(slug, provenance = {}, options = {}) {
  const scope = options.scope || provenance.scope;
  const key = scope === 'team-append' ? `${slug}:${provenance.team}` : slug;
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 16);
}

/** Acquire a local advisory lock for a wiki page slug.
 * @param {string} slug - Wiki page slug.
 * @param {object} provenance - Writer identity (author, team, model, agent_role, commit).
 * @returns {{ok, lockPath, reason?}}
 */
function acquireLock(slug, provenance, options = {}) {
  const validation = validateProvenance(provenance, options);
  if (!validation.ok) return { ok: false, reason: 'invalid-provenance', missing: validation.missing };
  ensureLockDir();
  const lockPath = path.join(LOCK_DIR, `${lockKey(slug, provenance, options)}.lock`);
  if (fs.existsSync(lockPath)) {
    const stat = fs.statSync(lockPath);
    if (Date.now() - stat.mtimeMs < LOCK_TTL_MS) {
      const existing = JSON.parse(fs.readFileSync(lockPath, 'utf-8'));
      return { ok: false, reason: 'held', existing, lockPath };
    }
  }
  const env = { slug, ...provenance, iso_ts: new Date().toISOString(), ttl_ms: LOCK_TTL_MS };
  fs.writeFileSync(lockPath, JSON.stringify(env, null, 2));
  return { ok: true, lockPath, envelope: env };
}

function releaseLock(slug, provenance = {}, options = {}) {
  const lockPath = path.join(LOCK_DIR, `${lockKey(slug, provenance, options)}.lock`);
  if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath);
}

/** Validate that a write provenance object has required fields. */
function validateProvenance(prov, options = {}) {
  const required = options.scope === 'team-append' ? PROVENANCE_FIELDS.concat(TEAM_APPEND_FIELDS) : PROVENANCE_FIELDS;
  const missing = required.filter(f => !prov || prov[f] === undefined || prov[f] === null || prov[f] === '');
  return { ok: missing.length === 0, missing };
}

/** Stamp a wiki page body with provenance frontmatter (additive). */
function stampProvenance(body, provenance, options = {}) {
  const validation = validateProvenance(provenance, options);
  if (!validation.ok) return { ok: false, missing: validation.missing };
  const stamp = `<!-- provenance: ${JSON.stringify(provenance)} -->`;
  return { ok: true, stamped: `${stamp}\n${body}` };
}

function readThreadStatus(threadDir) {
  const files = fs.readdirSync(threadDir).filter(f => f.endsWith('.md')).sort();
  const appends = files.map(file => {
    const body = fs.readFileSync(path.join(threadDir, file), 'utf8');
    const match = body.match(/<!-- provenance: (.+?) -->/);
    const provenance = match ? JSON.parse(match[1]) : {};
    return { file, team: provenance.team, thread_id: provenance.thread_id,
      append_position: provenance.append_position };
  });
  const lines = ['# Thread Status', '', ...appends.map(item =>
    `- ${item.team}: ${item.file} @ ${item.append_position}`)];
  return { ok: true, appends, status_md: `${lines.join('\n')}\n` };
}

if (require.main === module) {
  const cmd = process.argv[2];
  if (cmd === 'check') {
    ensureLockDir();
    const locks = fs.readdirSync(LOCK_DIR).filter(f => f.endsWith('.lock'));
    console.log(JSON.stringify({ active_locks: locks.length, lock_dir: LOCK_DIR }));
  } else {
    console.log('Usage: write-safety.js check');
  }
}

module.exports = { acquireLock, releaseLock, validateProvenance, stampProvenance,
  readThreadStatus, lockKey, LOCK_TTL_MS, PROVENANCE_FIELDS, TEAM_APPEND_FIELDS, LOCK_DIR };
