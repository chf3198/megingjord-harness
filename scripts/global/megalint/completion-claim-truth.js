'use strict';
// completion-claim-truth — Tier-2 anneal validator (#1889, Epic #3398).
// Detects issue-comment COMPLETION CLAIMS whose cited artifacts are not
// actually on the default branch: cited file paths absent from origin/main
// HEAD, or a cited PR #N whose mergedAt is null. This is the ground-truth
// check that instruction-only governance ("verify the PR is merged") cannot
// enforce — less-capable models write completion prose confidently regardless
// of underlying merge state (seed incidents #1874, #1399; corpus #3319/#1271).
//
// ADVISORY / non-blocking with a #1612 advisory->required promotion path.
// Detection is side-effect-free and injectable (detect + classify are pure);
// run() supplies the GitHub REST resolvers and posts the advisory comment.

// Advisory marker — presence in a comment means WE authored it; skip to avoid
// an issue_comment feedback loop (our own comment re-triggering the workflow).
const ADVISORY_MARKER = '<!-- completion-claim-truth:advisory -->';

// AC1: claim language. Two shapes: (a) strong standalone completion verbs, and
// (b) mutation verbs (added/updated/created/...) that only assert truth when a
// concrete artifact is cited alongside them. Matched per-clause below.
const STRONG_CLAIM_RE = /\b(remediation actions taken|shipped|re-?landed|merged|completed|closed as (?:completed|done)|deliverable landed|now (?:live|on main|merged))\b/i;
const MUTATION_CLAIM_RE = /\b(added|updated|created|wrote|committed|pushed|landed|implemented|fixed)\b/i;

// FP guard: future-tense / intent / hypothetical markers. A clause carrying any
// of these is a plan, not a claim — never a violation (constraint: don't
// false-positive on "we'll commit shortly" style progress reports).
const FUTURE_RE = /\b(will|we'?ll|going to|gonna|about to|shortly|next|soon|plan(?:ned|ning)?|intend|propose|recommend|should|would|could|todo|to-do|pending|once|after we|let'?s|i'?ll|then i|upcoming|draft|wip|work in progress)\b/i;

// A path-like token: has an interior slash and a file extension. Excludes URLs.
const PATH_RE = /(?<![\w/])((?:[\w.-]+\/)+[\w.-]+\.[A-Za-z0-9]{1,8})\b/g;
// A PR citation: explicitly labelled as a PR (avoids treating issue #N as a PR).
const PR_RE = /\b(?:PR|pull request|pull)\s*#?(\d+)\b|\/pull\/(\d+)\b/gi;

function stripUrls(s) {
  // Drop http(s) URLs so a path inside a link is not mined as a repo path.
  return String(s || '').replace(/https?:\/\/\S+/gi, ' ');
}

// Split into claim-bearing clauses. We only mine artifacts from clauses that
// carry claim language and are NOT future-tense — this is what keeps prose
// mentions ("see scripts/foo.js for context") from tripping the validator.
function claimClauses(text) {
  const clean = stripUrls(text);
  // Split on sentence boundaries, but a "." is only a delimiter when followed
  // by whitespace/EOL — otherwise "ghost.js" would be torn at its extension.
  const parts = clean.split(/\n+|[;!?]+|\.(?=\s|$)|,\s+and\b/i);
  const out = [];
  for (const raw of parts) {
    const clause = raw.trim();
    if (!clause) continue;
    if (FUTURE_RE.test(clause)) continue; // plan, not a claim
    const strong = STRONG_CLAIM_RE.test(clause);
    const mutation = MUTATION_CLAIM_RE.test(clause);
    if (strong || mutation) out.push({ clause, strong, mutation });
  }
  return out;
}

// AC1/AC2/AC3 detection — PURE and perf-critical (AC6 stress budget).
// Returns { hasClaim, paths:[...], prs:[...] } with de-duplicated citations.
function detect(text) {
  const clauses = claimClauses(text);
  const paths = new Set();
  const prs = new Set();
  let hasClaim = false;
  for (const { clause, strong, mutation } of clauses) {
    let m;
    PATH_RE.lastIndex = 0;
    const clausePaths = [];
    while ((m = PATH_RE.exec(clause)) !== null) clausePaths.push(m[1]);
    PR_RE.lastIndex = 0;
    const clausePrs = [];
    while ((m = PR_RE.exec(clause)) !== null) clausePrs.push(Number(m[1] || m[2]));
    // A bare mutation verb with no cited artifact is not a checkable claim
    // (e.g. "updated the wording"); only strong verbs claim on their own.
    if (strong) hasClaim = true;
    if (mutation && (clausePaths.length || clausePrs.length)) hasClaim = true;
    if (strong || clausePaths.length || clausePrs.length) {
      clausePaths.forEach((p) => paths.add(p));
      clausePrs.forEach((n) => prs.add(n));
    }
  }
  return { hasClaim, paths: [...paths], prs: [...prs] };
}

// AC2/AC3 classification — PURE. `resolved` carries already-fetched ground
// truth: pathPresence[path] === true|false, prMergedAt[n] === ISO|null|'not-a-pr'.
// A path/PR with no resolved entry is treated as UNKNOWN and skipped (fail-open;
// advisory mode never manufactures a violation from a fetch gap).
function classify(detection, resolved) {
  const violations = [];
  const pathPresence = (resolved && resolved.pathPresence) || {};
  const prMergedAt = (resolved && resolved.prMergedAt) || {};
  for (const p of detection.paths || []) {
    if (Object.prototype.hasOwnProperty.call(pathPresence, p) && pathPresence[p] === false) {
      violations.push({
        rule: 'dangling-path-claim',
        detail: `Comment claims artifact \`${p}\` but it is absent from the default branch HEAD. `
          + 'Push/merge the file or correct the claim.',
        path: p,
      });
    }
  }
  for (const n of detection.prs || []) {
    const v = prMergedAt[n];
    if (v === 'not-a-pr') continue; // #N was an issue, not a PR — out of scope
    if (Object.prototype.hasOwnProperty.call(prMergedAt, n) && (v === null || v === undefined)) {
      violations.push({
        rule: 'dangling-pr-claim',
        detail: `Comment cites PR #${n} as a merge vehicle but its mergedAt is null (not merged). `
          + 'Cite the PR that actually merged, or defer the claim.',
        pr: n,
      });
    }
  }
  return { ok: violations.length === 0, violations };
}

// Standard megalint interface: given { body } and pre-resolved ground truth,
// return { ok, violations }. Used by index.js dispatch + local preflight.
function validate(input) {
  const detection = detect((input && input.body) || '');
  if (!detection.hasClaim) return { ok: true, violations: [], skipped: 'no-claim-language' };
  return classify(detection, (input && input.resolved) || {});
}

function renderAdvisory(violations) {
  const lines = violations.map((v) => `- **${v.rule}**: ${v.detail}`);
  return `${ADVISORY_MARKER}\n⚠️ **completion-claim-truth (advisory)**\n\n`
    + 'A completion claim in this comment cites artifacts that are not on the default branch:\n\n'
    + `${lines.join('\n')}\n\n`
    + '_This is advisory (non-blocking) per the #1612 advisory→required promotion path. '
    + 'Validator: `scripts/global/megalint/completion-claim-truth.js` (#1889 / Epic #3398)._';
}

// AC4: workflow entry. Reads the triggering comment, resolves each cited path
// against the default branch HEAD (repos.getContent, ref=default) and each cited
// PR's merged_at (pulls.get), then posts ONE structured advisory comment if any
// claim is dangling. Never blocks. Idempotent-friendly: skips our own advisory
// comments to avoid an issue_comment feedback loop.
async function run({ github, context, core }) {
  if (!context || !context.payload || !context.payload.comment || !context.payload.issue) return;
  const body = context.payload.comment.body || '';
  if (body.includes(ADVISORY_MARKER)) return; // our own advisory — no loop
  const detection = detect(body);
  if (!detection.hasClaim) return;

  const owner = context.repo.owner;
  const repo = context.repo.repo;
  const ref = (context.payload.repository && context.payload.repository.default_branch) || 'main';

  const pathPresence = {};
  for (const p of detection.paths) {
    try {
      await github.rest.repos.getContent({ owner, repo, path: p, ref });
      pathPresence[p] = true;
    } catch (e) {
      pathPresence[p] = e && e.status === 404 ? false : 'unknown';
    }
  }
  const prMergedAt = {};
  for (const n of detection.prs) {
    try {
      const { data } = await github.rest.pulls.get({ owner, repo, pull_number: n });
      prMergedAt[n] = data.merged_at || null;
    } catch (e) {
      // 404 → #N is not a PR (likely an issue ref) → out of scope, not a violation.
      prMergedAt[n] = e && e.status === 404 ? 'not-a-pr' : 'unknown';
    }
  }
  // Normalize 'unknown' presence to absent-from-map so classify() skips it.
  const cleanPresence = {};
  for (const [k, v] of Object.entries(pathPresence)) if (v !== 'unknown') cleanPresence[k] = v;
  const cleanMerged = {};
  for (const [k, v] of Object.entries(prMergedAt)) if (v !== 'unknown') cleanMerged[k] = v;

  const result = classify(detection, { pathPresence: cleanPresence, prMergedAt: cleanMerged });
  if (result.ok) return;

  await github.rest.issues.createComment({
    owner,
    repo,
    issue_number: context.payload.issue.number,
    body: renderAdvisory(result.violations),
  });
  if (core && core.notice) {
    core.notice(`completion-claim-truth: ${result.violations.length} dangling claim(s) on #${context.payload.issue.number}`);
  }
}

module.exports = {
  detect,
  classify,
  validate,
  run,
  renderAdvisory,
  ADVISORY_MARKER,
  STRONG_CLAIM_RE,
  MUTATION_CLAIM_RE,
  FUTURE_RE,
};
