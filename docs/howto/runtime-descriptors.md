# Runtime Descriptors (Epic #3411 T1.2)

Each orchestrator runtime has one descriptor under `inventory/runtimes/<runtime>.json`. A descriptor is
the data-driven input from which the T2 `harness:add-runtime` scaffold emits every per-runtime artifact
(detection markers, signing team, deploy home + artifactClasses, hook config, capabilities, parity waivers).

## Files

- `inventory/runtime-descriptor.schema.json` — draft-2020-12 schema (deltaKind enum, artifactClasses required).
- `inventory/runtimes/{claude-code,copilot,codex,cursor,antigravity}.json` — the five descriptors.
- `scripts/global/runtime-descriptor.js` — loader + round-trip validator.

## Usage

```bash
npm run runtime-descriptor:check         # validate + round-trip against live registries
npm run runtime-descriptor:check:test    # contract test
```

## Round-trip invariants (enforced by the validator)

- `detection.primaryEnvMarkers` for an `env-marker` runtime must equal detect-runtime.js exactly.
- `signing.team` must be a value in `team-model-signatures.json#substrateTeamMap`.
- `hooks.configPath` must exist on disk.
- `deploy.artifactClasses` must be non-empty; cursor/antigravity waive `scripts` with a promotionPath to T2.3.

## What's next

- T2.1 (#3444) `harness:add-runtime` scaffold consumes these descriptors to emit per-runtime artifacts.
- T1.6 (#3443) encodes the `scripts` gate-corpus artifactClass so cursor/antigravity can receive it.
