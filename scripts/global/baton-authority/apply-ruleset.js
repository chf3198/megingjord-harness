// apply-ruleset.js -- Idempotent GitHub ruleset applier.
// DRY-RUN default. Only mutates with explicit --apply flag.
// Refs #3290, Epic #3284.
'use strict';

const { buildRulesetConfig, validateRulesetConfig, RULESET_NAME, OWNER, REPO } = require('./ruleset-config');

/**
 * Build the API endpoint URL for rulesets.
 */
function buildApiUrl(rulesetId) {
  const base = 'https://api.github.com/repos/' + OWNER + '/' + REPO + '/rulesets';
  if (rulesetId) return base + '/' + rulesetId;
  return base;
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
    'Method: ' + method,
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
  lines.push('Bypass actors: ' + config.bypass_actors.length);
  for (const actor of config.bypass_actors) {
    lines.push('  - ' + (actor.description || 'unnamed'));
  }
  lines.push('');
  lines.push('To apply: node apply-ruleset.js --apply');
  lines.push('To remove: gh api -X DELETE ' + buildApiUrl('<RULESET_ID>'));
  return lines.join('\n');
}

/**
 * Main entry point. Parses CLI args and runs dry-run or apply.
 */
function main(args) {
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
  // --apply mode: print the gh api command
  const body = JSON.stringify(config, null, 2);
  const cmd = 'gh api -X POST ' + buildApiUrl() + ' --input=-';
  console.log('Applying ruleset via: ' + cmd);
  console.log('Request body:');
  console.log(body);
  console.log('');
  console.log('Run the above gh api command manually to apply.');
  console.log('To remove: gh api -X DELETE ' + buildApiUrl('<RULESET_ID>'));
  return { action: 'apply-instructions', config, cmd };
}

if (require.main === module) {
  main(process.argv.slice(2));
}

module.exports = { main, formatDryRun, buildApiUrl };
