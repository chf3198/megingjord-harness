## [Unreleased] — Phase 4 unblock for Epic #1716 (#1727 prerequisites)

### Added
- `cloudflare/hamr/routes/rotation-check.ts` — Worker-side rotation validator (TypeScript port of `scripts/global/hamr-rotation-check.js`). Implements all 3 rotation rules + 3 operator modes + dual waiver labels.
- 12 new ed25519 keypair entries in `inventory/team-model-signatures.json` `cryptoKeys` array, covering all 4 roles for `claude-code`, `codex`, `openclaw` teams. Private keys persist locally at `~/.megingjord/keys/` with mode 0600.
- `.github/workflows/rotation-advisory.yml` — Actions workflow running on pull_request events. SHA-pinned (`actions/checkout@34e114876b`, `actions/github-script@f28e40c7f3`). Least-privilege permissions. Calls `hamr-rotation-check.js` adapter; posts advisory comments via `<!-- rotation-advisory -->` marker.
- `tests/rotation-advisory-workflow.spec.js` — 11 unit tests covering workflow structure, TS-route exports, mcp-dispatch wiring, inventory key coverage, JS-adapter parity.

### Changed
- `cloudflare/hamr/routes/mcp-dispatch.ts` — adds `'rotation:check'` capability case to the dispatch switch; imports `rotationCheck` from the new route.
- `scripts/lint.js` — adds `team-model-signatures.json` to `IGNORE_FILES` (registry grows with teams × roles × rotations; not subject to 100-line code cap).

### Why
Closes the three operational prerequisites for #1727 14-day soak start:
1. ✅ Cloudflare worker route handler — TypeScript route + dispatch wiring shipped.
2. ✅ Ed25519 key bootstrap for non-Copilot teams — 12 keypairs registered.
3. ✅ Advisory workflow — `.github/workflows/rotation-advisory.yml` will run on PR-event after merge.

### Phase 4 soak day-0

With this PR merged + `wrangler deploy` operationally run, the 14-day soak window for #1727 starts.

### Verification
- 11/11 workflow tests pass.
- `npm run lint` clean; `npm run lint:md` clean.
- Cross-family Gemma3:1b review: deployment risk LOW (internal contradiction on security-risk verdict; treated as non-concern given checked logic).

### Out of scope
- `wrangler deploy` execution itself (operator with Cloudflare account access).
- Per-team operator opt-in (each operator declares `MEGINGJORD_MODEL_ROTATION_DISABLED=1` if not participating).
- Required-mode promotion — Phase 4 #1727 day-14 decision.
