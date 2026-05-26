# /fleet-review — dispatch HAMR-routed fleet adversarial red-team

Run a cross-family fleet-model red-team review of a harness artifact (epic-scope, child-implementation, the-collaborator-handoff, the-admin-handoff, PR-diff, instruction-edit, the-consultant-closeout).

## Usage

```bash
node -e "
  const { dispatchRedTeam } = require('./scripts/global/fleet-red-team-dispatch');
  const { formatRedTeamComment } = require('./scripts/global/baton-fleet-review-comment');
  (async () => {
    const result = await dispatchRedTeam({
      artifactType: 'pr-diff',
      content: process.argv[1],
    });
    process.stdout.write(formatRedTeamComment({
      findings: result.findings,
      artifactType: 'pr-diff',
      warning: result.hamrStats.warning,
    }));
  })();
" "$ARGS"
```

## Notes

- HAMR-routed via `wrapProviderCall('ollama', {tier: 'fleet-local'})` per Epic #2041 P1-7 #2178
- Templates from `config/fleet-red-team-prompts.json` (P1-3 #2181)
- Findings classified ACCEPT/REJECT/PARTIAL per Phase-0 #2174 AC-R4
- Operator runbook: `docs/howto/fleet-red-team-workflow.md` (P1-4 #2180)

## Pre-flight

- Fleet host reachable: `curl -s http://100.91.113.16:11434/api/tags`
- HAMR active: `cat ~/.copilot/hamr-config.json | jq .enabled`
