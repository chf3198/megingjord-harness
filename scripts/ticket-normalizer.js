/**
 * ticket-normalizer.js — preprocess GitHub API issue → validator-ready object.
 * Validator: research/ticket-validator.json (constraint adjacency map)  |  Glossary: research/ticket-schema-v1.json
 *
 * All baton roles are AI agents (human = design decisions + UAT only):
 *   manager=ProductOwner  collaborator=Developer  admin=QA/DevOps  consultant=Architect
 *
 * Pipeline: extractLabels() → parseBody() → normalize()
 * Closed-ticket rule: state=closed forces status=null, role=null; resolution label required.
 */

'use strict';

const GOVERNED_NAMESPACES = ['status', 'role', 'type', 'priority', 'area', 'resolution'];

/**
 * Extract harness governance labels from a GitHub labels array.
 * Labels arrive as objects { name, color, ... } or plain strings.
 * @param {Array} labels
 * @returns {object} governance — { status, role, type, priority, area[], resolution }
 */
function extractLabels(labels) {
  const gov = { status: null, role: null, type: null, priority: null, area: [], resolution: null };
  for (const label of labels) {
    const name = typeof label === 'string' ? label : label.name;
    const colon = name.indexOf(':');
    if (colon === -1) continue;
    const ns  = name.slice(0, colon);
    const val = name.slice(colon + 1);
    if (!GOVERNED_NAMESPACES.includes(ns)) continue;
    if (ns === 'area') { gov.area.push(val); }
    else               { gov[ns] = val;      }
  }
  return gov;
}

/**
 * Parse body-convention fields from issue markdown body.
 * Accepted patterns:
 *   parent_issue    — "Part of #N" or "Parent: #N"
 *   depends_on      — "Depends on #N, #M"
 *   blocks          — "Blocks #N, #M"
 *   release_version — "Release: vX.Y.Z"
 * @param {string|null} body
 * @returns {object}
 */
function parseBody(body) {
  const empty = { parent_issue: null, depends_on: [], blocks: [], release_version: null };
  if (!body) return empty;
  const refs   = (str) => str ? str.match(/\d+/g).map(Number) : [];
  const parent = body.match(/(?:Part of|Parent:)\s*#(\d+)/i);
  const deps   = body.match(/Depends on\s+(#\d+(?:,\s*#\d+)*)/i);
  const blks   = body.match(/Blocks\s+(#\d+(?:,\s*#\d+)*)/i);
  const rel    = body.match(/Release:\s*(v[\w.+-]+)/i);
  return {
    parent_issue:    parent ? parseInt(parent[1]) : null,
    depends_on:      refs(deps?.[1]),
    blocks:          refs(blks?.[1]),
    release_version: rel ? rel[1] : null,
  };
}

/**
 * normalize(ghIssue) → normalized ticket object ready for validator
 * @param {object} ghIssue  Raw GitHub REST API issue response
 * @returns {object}
 */
function normalize(ghIssue) {
  const gov  = extractLabels(ghIssue.labels ?? []);
  const body = parseBody(ghIssue.body ?? null);
  if (ghIssue.state === 'closed') { gov.status = null; gov.role = null; }
  return {
    number:          ghIssue.number,
    title:           ghIssue.title,
    body:            ghIssue.body            ?? null,
    state:           ghIssue.state,
    state_reason:    ghIssue.state_reason    ?? null,
    assignees:       (ghIssue.assignees ?? []).map(a => a.login ?? a),
    milestone:       ghIssue.milestone?.title ?? null,
    parent_issue:    body.parent_issue,
    depends_on:      body.depends_on,
    blocks:          body.blocks,
    release_version: body.release_version,
    governance:      gov,
  };
}

module.exports = { normalize, extractLabels, parseBody };
