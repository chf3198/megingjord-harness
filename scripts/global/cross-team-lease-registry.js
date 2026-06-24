#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { readJson, writeJsonAtomic, mutateJson } = require('./atomic-json-store');

const DEFAULT_PATH = path.join(process.cwd(), '.dashboard', 'cross-team-leases.json');
const TTL_HOURS = 24;
const HOUR_MS = 3600000;

function empty() { return { version: 1, leases: [] }; }
function now() { return new Date().toISOString(); }
function expires(hours = TTL_HOURS) {
  return new Date(Date.now() + Number(hours) * HOUR_MS).toISOString();
}
function listArg(value) {
  if (!value) return [];
  return String(value).split(',').map(s => s.trim()).filter(Boolean);
}
function read(file = DEFAULT_PATH) {
  if (!fs.existsSync(file)) return empty();
  return readJson(file, empty);
}
function write(registry, file = DEFAULT_PATH) {
  writeJsonAtomic(registry, file);
}
function mutateRegistry(file, mutator) {
  return mutateJson(file, mutator, empty);
}
function active(registry, at = now()) {
  return registry.leases.filter(l => l.status === 'active' && l.expires_at > at);
}
function ensureFree(registry, lease) {
  const hit = active(registry).find(l => l.ticket === lease.ticket || l.branch === lease.branch);
  if (hit) throw new Error(`active lease collision with #${hit.ticket} ${hit.branch}`);
}
function createLease(registry, input) {
  const stamp = now();
  const lease = {
    ticket: Number(input.ticket), team: input.team, role: input.role,
    branch: input.branch, worktree: input.worktree || process.cwd(),
    paths: listArg(input.paths), ports: listArg(input.ports).map(Number),
    runtime_surfaces: listArg(input.runtime_surfaces),
    created_at: stamp, last_seen: stamp, expires_at: expires(input.ttl_hours),
    status: 'active',
  };
  ensureFree(registry, lease);
  registry.leases.push(lease);
  return lease;
}
function findActive(registry, ticket) {
  return registry.leases.find(l => l.ticket === Number(ticket) && l.status === 'active');
}
function refreshLease(registry, ticket, ttlHours) {
  const lease = registry.leases.find(l => l.ticket === Number(ticket) && l.status === 'active');
  if (!lease) throw new Error(`no active lease for #${ticket}`);
  lease.last_seen = now();
  lease.expires_at = expires(ttlHours);
  return lease;
}
function expireLeases(registry, at = now()) {
  const expired = [];
  for (const lease of registry.leases) {
    if (lease.status === 'active' && lease.expires_at <= at) {
      lease.status = 'expired';
      expired.push(lease);
    }
  }
  return expired;
}
function closeLease(registry, ticket) {
  const lease = findActive(registry, ticket);
  if (!lease) throw new Error(`no active lease for #${ticket}`);
  lease.status = 'closed';
  lease.last_seen = now();
  return lease;
}
function commentBlock(event, lease) {
  const rows = [
    `<!-- cross-team-lease:${event} -->`, `CROSS_TEAM_LEASE_${event.toUpperCase()}`,
    `ticket: #${lease.ticket}`, `team: ${lease.team}`, `role: ${lease.role}`,
    `branch: ${lease.branch}`, `worktree: ${lease.worktree}`,
    `paths: ${lease.paths.join(',')}`, `ports: ${lease.ports.join(',')}`,
    `runtime_surfaces: ${lease.runtime_surfaces.join(',')}`,
    `expires_at: ${lease.expires_at}`, `status: ${lease.status}`,
  ];
  return rows.join('\n');
}
module.exports = { read, write, mutateRegistry, createLease, refreshLease, expireLeases,
  closeLease, active, commentBlock, DEFAULT_PATH };
