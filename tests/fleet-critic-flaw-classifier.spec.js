// Refs #2888 — structured-tag flaw classifier for the cross-family critic (#2797 follow-on). Unit tests +
// a replay-eval proving a strictly lower false-NEGATIVE rate than the keyword baseline on a labelled corpus.
const { test, expect } = require('@playwright/test');
const { parseTags, classifyFlaw } = require('../scripts/global/fleet-critic-flaw-classifier.js');
const { defaultClassify } = require('../scripts/global/fleet-cross-family-critic.js');
const { runCriticPanel } = require('../scripts/global/fleet-cross-family-critic.js');

test('parseTags reads tags + severity, null when neither present', () => {
  expect(parseTags('REJECT x [tags: security, rce] [severity: high]')).toMatchObject({ severity: 'high' });
  expect([...parseTags('REJECT x [tags: security, correctness]').tags]).toEqual(['security', 'correctness']);
  expect(parseTags('REJECT a plain finding with no annotations')).toBeNull();
});

test('AC2 classifyFlaw: tags first, keyword fallback when untagged, source recorded', () => {
  expect(classifyFlaw('REJECT ledger left unsettled [tags: correctness] [severity: high]'))
    .toEqual({ flaw: true, highSeverity: true, source: 'tags' });
  expect(classifyFlaw('PARTIAL slow loop [tags: perf] [severity: low]'))
    .toMatchObject({ flaw: false, source: 'tags' }); // perf alone is advisory, not a merge-blocking flaw
  expect(classifyFlaw('REJECT off-by-one corrupts the buffer')) // no tags → keyword fallback catches it
    .toMatchObject({ flaw: true, source: 'keyword' });
});

test('a security tag with no explicit severity reads high-stakes; explicit low is respected', () => {
  expect(classifyFlaw('REJECT x [tags: security]')).toMatchObject({ flaw: true, highSeverity: true });
  expect(classifyFlaw('REJECT x [tags: security] [severity: low]')).toMatchObject({ flaw: true, highSeverity: false });
});

test('F2 parser merges tags from MULTIPLE [tags:] blocks (a later flaw tag is not missed)', () => {
  const out = classifyFlaw('REJECT slow loop [tags: perf] then it can expose records [tags: security] [severity: high]');
  expect(out).toMatchObject({ flaw: true, highSeverity: true, source: 'tags' });
});

test('F1 a long tag list is not truncated — a flaw tag at the end is still found', () => {
  const filler = Array.from({ length: 40 }, (unused, idx) => `t${idx}`).join(','); // ~150+ chars of junk tags
  expect(classifyFlaw(`REJECT odd behaviour [tags: ${filler},correctness]`)).toMatchObject({ flaw: true, source: 'tags' });
});

test('F4 fail-safe: severity:high flags a flaw even when the tag is misspelled/unknown', () => {
  expect(classifyFlaw('REJECT the panel renders twice on slow networks [tags: securty] [severity: high]'))
    .toMatchObject({ flaw: true, highSeverity: true }); // typo "securty" — high severity still wins
});

test('whitespace-noisy tags parse cleanly', () => {
  expect([...parseTags('REJECT x [tags:  correctness ,  security ]').tags].sort()).toEqual(['correctness', 'security']);
});

test('NF1 highest severity wins across multiple [severity:] blocks (a later low cannot downgrade high)', () => {
  expect(classifyFlaw('REJECT minor [severity: low] actually a major hole [tags: security] [severity: high]'))
    .toMatchObject({ flaw: true, highSeverity: true });
  expect(parseTags('x [severity: low] y [severity: high]').severity).toBe('high');
});

test('NF2 a tag with internal whitespace ("merge safety") matches the canonical merge-safety flaw tag', () => {
  expect(classifyFlaw('REJECT risky rebase [tags: merge safety] [severity: high]')).toMatchObject({ flaw: true });
  expect([...parseTags('x [tags: merge safety]').tags]).toEqual(['merge-safety']);
});

test('AC2 wires into the critic as deps.classifyFlaw — a tagged-but-keyword-missed reject is flagged', async () => {
  const dispatch = () => ({ findings: [{ raw: 'REJECT the A→C transition is dropped [tags: correctness] [severity: high]' }], modelUsed: 'g' });
  const out = await runCriticPanel({ content: 'd', gatesPass: true, generatorFamily: 'qwen',
    criticModels: [{ model: 'gemini', family: 'gemini' }],
    deps: { dispatch, classifyFlaw, proveIt: () => ({ reproduced: false }), escalate: () => 'human' } });
  expect(out.decision).toBe('escalate'); // tag-classified high-sev flaw → not silent-merged
});

// AC3 replay-eval: labelled corpus. `t`=truth flaw. Several rows are tagged-but-keyword-missed (structured
// wins); some are untagged-keyword-hit (fallback parity); one is untagged+unkeyworded (both miss — honest).
const CORPUS = [
  { raw: 'REJECT the ledger ends in an unsettled state [tags: correctness] [severity: high]', t: true },
  { raw: 'REJECT the A→C transition is silently dropped [tags: correctness] [severity: high]', t: true },
  { raw: 'REJECT request handler may double-ack under load [tags: concurrency] [severity: high]', t: true },
  { raw: 'REJECT SQL injection in the query builder [tags: security] [severity: high]', t: true },
  { raw: 'REJECT off-by-one corrupts the boundary write', t: true },
  { raw: 'REJECT possible auth bypass on the admin route', t: true },
  { raw: 'REJECT a subtle logic mistake here that nothing else describes', t: true },
  // adversarial rows (F3): keyword-missable text, but the critic tagged them — structured must catch.
  { raw: 'REJECT slow loop [tags: perf] then it can expose records [tags: security] [severity: high]', t: true }, // 2nd block
  { raw: 'REJECT the panel renders twice on slow networks [tags: securty] [severity: high]', t: true }, // typo + high-sev
  { raw: 'REJECT throughput dips on cold start [tags: concurrency]', t: true }, // concurrency tag, no keyword
  { raw: 'ACCEPT looks clean, no concerns', t: false },
  { raw: 'PARTIAL minor naming nit, consider a rename [tags: perf] [severity: low]', t: false },
  { raw: 'ACCEPT fine [tags: perf]', t: false },
];

const fnRate = (classify) => CORPUS.filter((row) => row.t && !classify(row.raw).flaw).length;
const fpRate = (classify) => CORPUS.filter((row) => !row.t && classify(row.raw).flaw).length;

test('AC3 replay-eval: structured FN-rate < keyword FN-rate, no FP regression', () => {
  const keywordFN = fnRate((raw) => defaultClassify(raw));
  const structuredFN = fnRate((raw) => classifyFlaw(raw));
  expect(structuredFN).toBeLessThan(keywordFN); // tagged-but-keyword-missed flaws are now caught
  expect(fpRate((raw) => classifyFlaw(raw))).toBeLessThanOrEqual(fpRate((raw) => defaultClassify(raw)));
});
