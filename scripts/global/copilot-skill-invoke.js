// copilot-skill-invoke.js — skill-invocation wiring for Copilot BYOK (#3047).
// Wraps existing ~/.copilot/skills entries so Copilot can invoke them via
// runSubagent / MCP prompt. Does NOT reimplement skills — only resolves their
// path, validates invocability, and builds the invocation record.
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SKILL_ROOT_ENV = 'MEGINGJORD_SKILLS_ROOT';
const DEPLOYED_SKILLS = path.join(
  process.env.HOME || '',
  '.copilot', 'skills',
);
const REPO_SKILLS = path.resolve(__dirname, '..', '..', 'skills');

// WIRED_SKILLS — the governed subset exposed as Copilot-invokable.
// Adding a skill here requires: SKILL.md `user-invocable: true`, no side-effects
// that bypass baton governance (OA2), and operator confirmation it is safe to
// surface to Copilot BYOK sessions.
const WIRED_SKILLS = [
  'global-task-router',
  'role-baton-orchestrator',
  'role-manager-execution',
  'role-collaborator-execution',
  'role-consultant-critique',
  'docs-drift-maintenance',
  'workflow-self-anneal',
];

function skillsRoot(opts = {}) {
  return opts.skillsRoot
    || process.env[SKILL_ROOT_ENV]
    || (fs.existsSync(DEPLOYED_SKILLS) ? DEPLOYED_SKILLS : REPO_SKILLS);
}

function parseSkillFrontmatter(skillMd) {
  const m = skillMd.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const out = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([\w-]+):\s*(.+)$/);
    if (!kv) continue;
    const val = kv[2].trim().replace(/^['"]|['"]$/g, '');
    out[kv[1]] = val === 'true' ? true : val === 'false' ? false : val;
  }
  return out;
}

// resolveSkill(name, opts) -> { ok, skill } | { ok:false, reason }
// Resolves a skill by name from the skills root, validates invocability.
function resolveSkill(name, opts = {}) {
  if (!name || typeof name !== 'string') {
    return { ok: false, reason: 'skill name must be a non-empty string' };
  }
  if (!WIRED_SKILLS.includes(name)) {
    return { ok: false, reason: `skill '${name}' is not in the governed wired-skills list` };
  }
  const root = skillsRoot(opts);
  const skillFile = path.join(root, name, 'SKILL.md');
  if (!fs.existsSync(skillFile)) {
    return { ok: false, reason: `skill file not found: ${skillFile}` };
  }
  const raw = fs.readFileSync(skillFile, 'utf8');
  const meta = parseSkillFrontmatter(raw);
  if (meta['user-invocable'] === false) {
    return { ok: false, reason: `skill '${name}' is not user-invocable` };
  }
  return { ok: true, skill: { name: meta.name || name, description: meta.description || '', file: skillFile, meta } };
}

// buildInvocation(name, args, opts) -> { ok, invocation } | { ok:false, reason }
// Returns a structured runSubagent-compatible invocation record.
function buildInvocation(name, args = '', opts = {}) {
  const resolved = resolveSkill(name, opts);
  if (!resolved.ok) return resolved;
  const { skill } = resolved;
  return {
    ok: true,
    invocation: {
      skill: skill.name,
      skillFile: skill.file,
      args: typeof args === 'string' ? args.trim() : '',
      hint: skill.meta['argument-hint'] || '',
      description: skill.description,
      // runSubagent prompt: skill name + optional args, matching Copilot's expected format.
      prompt: `/${skill.name}${args ? ' ' + String(args).trim() : ''}`,
    },
  };
}

// listWiredSkills(opts) -> Array<{ name, description, file }> for configured skills root.
function listWiredSkills(opts = {}) {
  return WIRED_SKILLS.map((name) => {
    const res = resolveSkill(name, opts);
    return res.ok
      ? { name, description: res.skill.description, file: res.skill.file }
      : { name, description: '(unavailable)', file: null, reason: res.reason };
  });
}

module.exports = {
  WIRED_SKILLS,
  resolveSkill,
  buildInvocation,
  listWiredSkills,
  parseSkillFrontmatter,
  SKILL_ROOT_ENV,
};
