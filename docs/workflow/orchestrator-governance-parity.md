# Orchestrator Governance Parity

`scripts/global/orchestrator-governance-parity.js` compares the repo-owned
Claude Code, Copilot, and Codex governance adapters against
`inventory/orchestrator-governance-parity.json`.

Run the local checks before changing runtime adapters:

```bash
npm run governance:orchestrator-parity:test
node scripts/global/orchestrator-governance-parity.js --strict
```

The strict CI gate runs for changes to `.claude/`, `.codex/`, hooks, skills,
deploy/sync scripts, the parity manifest, and the parity test.

Waivers must be explicit. Add a manifest note that names the runtime, surface,
unsupported capability, evidence source, and owner. Do not remove a missing
adapter from the test surface just to make the audit pass.

Signed-by: Quill Harper
Team&Model: codex:gpt-5.4@openai
Role: collaborator
