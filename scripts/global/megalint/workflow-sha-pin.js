'use strict';
// workflow-sha-pin — Epic #1510 Phase-1b. Flags `actions/<name>@<tag>`
// references in workflow YAML; the harness's GitHub Actions security
// baseline (instructions/github-governance.instructions.md) requires
// third-party actions pinned to full commit SHA.
//
// Repo-owned reusable workflow refs (`./.github/workflows/foo.yml` or
// `<owner>/<repo>/.github/workflows/foo.yml@main`) are NOT third-party;
// allowlist treats them as OK by default.
//
// Pure-function caller supplies the workflow file content; the rule does
// not read the filesystem.

const USE_LINE_RE = /^\s*-?\s*uses?:\s*([^\s#]+)/gmi;
const SHA40_RE = /^[a-f0-9]{40}$/i;
const REPO_OWNED_RE = /^\.\/.github\/workflows\//;

function parseUseRef(ref) {
  // Allow ./local-workflow.yml form (repo-owned).
  if (REPO_OWNED_RE.test(ref)) return { ref, kind: 'repo-owned', ok: true };
  // Third-party form: org/repo@ref or org/repo/path@ref
  const match = ref.match(/^([^@\s]+)@([^\s]+)$/);
  if (!match) return { ref, kind: 'unparseable', ok: true };
  const [, name, version] = match;
  const isSha = SHA40_RE.test(version);
  return { ref, kind: 'third-party', name, version, isSha, ok: isSha };
}

function findUseRefs(yamlContent) {
  const out = [];
  for (const m of (yamlContent || '').matchAll(USE_LINE_RE)) out.push(m[1]);
  return out;
}

function validate(input) {
  const yaml = input.workflowContent || '';
  const refs = findUseRefs(yaml).map(parseUseRef);
  const violations = [];
  for (const parsed of refs) {
    if (parsed.kind !== 'third-party') continue;
    if (parsed.ok) continue;
    violations.push({
      rule: 'workflow-action-not-sha-pinned',
      detail: `Workflow uses '${parsed.ref}' (tag/version). Pin third-party actions to a full 40-char commit SHA per security baseline.`,
      action: parsed.name,
      version: parsed.version,
    });
  }
  return { ok: violations.length === 0, violations, scanned: refs.length };
}

module.exports = { validate, parseUseRef, findUseRefs, SHA40_RE, REPO_OWNED_RE };
