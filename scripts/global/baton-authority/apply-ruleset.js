// apply-ruleset.js -- Idempotent GitHub ruleset applier.
// DRY-RUN default. Only mutates with explicit --apply flag, which performs a
// real POST (create) / PUT (update-by-name) against the live repo via gh api.
// Refs #3315, #3290, Epic #3284.
'use strict';

const { execFileSync } = require('child_process');
const {
  buildRulesetConfig,
  validateRulesetConfig,
  RULESET_NAME,
  OWNER,
  REPO,
} = require('./ruleset-config');

/**
 * Build the API endpoint path for rulesets (gh api uses a repo-relative path).
 */
function buildApiUrl(rulesetId) {
  const base = 'https://api.github.com/repos/' + OWNER + '/' + REPO + '/rulesets';
  if (rulesetId) return base + '/' + rulesetId;
  return base;
}

const FALLBACK_SLUG = OWNER + '/' + REPO;

/**
 * The gh api path (repo-relative) used by the live applier.
 * `slug` is the live "owner/repo"; defaults to the canonical fallback constant.
 */
function apiPath(rulesetId, slug) {
  const base = 'repos/' + (slug || FALLBACK_SLUG) + '/rulesets';
  return rulesetId ? base + '/' + rulesetId : base;
}

/**
 * Default gh executor. Injectable so tests never touch the network.
 */
function defaultRunGh(ghArgs, input) {
  const opts = { encoding: 'utf8' };
  if (input !== undefined) opts.input = input;
  return execFileSync('gh', ghArgs, opts);
}

/**
 * Resolve the LIVE repo slug ("owner/repo") from gh. Rename-proof: a repo
 * rebrand (e.g. devenv-ops -> megingjord-harness) leaves a redirect that gh
 * follows on GET but NOT on POST/PUT, so a stale constant would 307 the apply.
 * Fail-soft: falls back to the canonical constant when gh is unavailable.
 */
function resolveRepoSlug(runGh) {
  try {
    const out = runGh(['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'], undefined);
    const slug = String(out || '').trim();
    return /^[^/\s]+\/[^/\s]+$/.test(slug) ? slug : FALLBACK_SLUG;
  } catch (err) {
    return FALLBACK_SLUG;
  }
}

/**
 * Find the id of an existing ruleset by name. Fail-soft: returns null when gh
 * is unavailable or the lookup errors (offline / unauthenticated).
 */
function findExistingRulesetId(runGh, slug) {
  try {
    const out = runGh(['api', apiPath(null, slug)], undefined);
    const list = JSON.parse(out);
    const match = (list || []).find((rs) => rs && rs.name === RULESET_NAME);
    return match ? match.id : null;
  } catch (err) {
    return null;
  }
}

/**
 * Perform the idempotent live apply: PUT when a ruleset of RULESET_NAME already
 * exists, POST otherwise. Resolves the live repo slug first (rename-proof).
 * Returns { method, path, id, slug, response }.
 */
function applyRuleset(config, runGh) {
  const slug = resolveRepoSlug(runGh);
  const existingId = findExistingRulesetId(runGh, slug);
  const method = existingId ? 'PUT' : 'POST';
  const path = apiPath(existingId, slug);
  const body = JSON.stringify(config);
  const out = runGh(['api', '-X', method, path, '--input', '-'], body);
  let id = existingId;
  try {
    const parsed = JSON.parse(out);
    if (parsed && parsed.id != null) id = parsed.id;
  } catch (err) {
    // response not JSON (or empty) -- keep the discovered id
  }
  return { method, path, id, slug, response: out };
}

/**
 * Format the dry-run output showing what the applier would do.
 */
function formatDryRun(config, existingId) {
  const method = existingId ? 'PUT' : 'POST';
  const url = buildApiUrl(existingId);
  const lines = [
    '=== BATON AUTHORITY RULESET — DRY RUN ===',
    '',
    'Method: ' + method + (existingId ? ' (update existing)' : ' (create)'),
    'URL: ' + url,
    'Ruleset name: ' + config.name,
    'Enforcement: ' + config.enforcement,
    'Target branches: ' + JSON.stringify(config.conditions.ref_name.include),
    '',
    'Required status checks:',
  ];
  const statusRule = config.rules.find(
    (rule) => rule.type === 'required_status_checks'
  );
  if (statusRule) {
    for (const chk of statusRule.parameters.required_status_checks) {
      lines.push('  - ' + chk.context);
    }
  }
  lines.push('');
  lines.push('Non-fast-forward: enforced');
  lines.push('');
  lines.push('Bypass actors: ' + config.bypass_actors.length +
    (config.bypass_actors.length === 0
      ? ' (empty — admins enforced; break-glass via merge-bypass:admin-exception label)'
      : ''));
  for (const actor of config.bypass_actors) {
    lines.push('  - ' + (actor.description || 'unnamed'));
  }
  lines.push('');
  lines.push('To apply (idempotent create/update-by-name): node apply-ruleset.js --apply');
  lines.push('To remove: gh api -X DELETE ' + buildApiUrl('<RULESET_ID>'));
  return lines.join('\n');
}

/**
 * Main entry point. Parses CLI args and runs dry-run or a real apply.
 * deps.runGh is injectable for hermetic tests.
 */
function main(args, deps) {
  const runGh = (deps && deps.runGh) || defaultRunGh;
  const config = buildRulesetConfig();
  const validation = validateRulesetConfig(config);
  if (!validation.valid) {
    console.error('Ruleset config validation failed:');
    for (const violation of validation.violations) {
      console.error('  - ' + violation);
    }
    process.exitCode = 1;
    return { action: 'validation-failed', violations: validation.violations };
  }
  const isApply = (args || []).includes('--apply');
  if (!isApply) {
    const output = formatDryRun(config, null);
    console.log(output);
    return { action: 'dry-run', config, output };
  }
  const result = applyRuleset(config, runGh);
  const verb = result.method === 'POST' ? 'created' : 'updated';
  console.log(
    'Ruleset ' + verb + ' (id=' + result.id + ') via ' +
    result.method + ' ' + result.path
  );
  return { action: 'applied', config, ...result };
}

if (require.main === module) {
  main(process.argv.slice(2));
}

module.exports = {
  main,
  formatDryRun,
  buildApiUrl,
  apiPath,
  resolveRepoSlug,
  findExistingRulesetId,
  applyRuleset,
};
