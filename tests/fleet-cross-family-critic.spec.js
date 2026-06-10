// Refs #2797 — cross-family generator-critic with prove-it escalation (Epic #2791 P1-4). Pure decision-tree
// unit tests: every AC branch is exercised with injected dispatch/proveIt/escalate so no fleet call is made.
const { test, expect } = require('@playwright/test');
const {
  classifyFinding, criticStance, panelVerdict, decideMergeability, runCriticPanel,
} = require('../scripts/global/fleet-cross-family-critic.js');

const f = (raw) => ({ raw });

test('classifyFinding parses verdict + flaw + severity', () => {
  expect(classifyFinding(f('REJECT - SQLi injection in query builder'))).toMatchObject({ verdict: 'reject', flaw: true, highSeverity: true });
  expect(classifyFinding(f('PARTIAL: minor naming nit'))).toMatchObject({ verdict: 'partial', flaw: false });
  expect(classifyFinding(f('ACCEPT clean'))).toMatchObject({ verdict: 'accept', flaw: false, highSeverity: false });
});

test('F2 broadened detection catches a correctness flaw phrased without security keywords', () => {
  // "insecure object deserialization" / "off-by-one" — no classic security keyword, still flagged.
  expect(classifyFinding(f('REJECT off-by-one corrupts the boundary write')).flaw).toBe(true);
  expect(classifyFinding(f('REJECT insecure deserialization of untrusted input')).flaw).toBe(true);
  // injectable classifier overrides the heuristic entirely
  expect(classifyFinding(f('REJECT anything'), () => ({ flaw: false, highSeverity: false })).flaw).toBe(false);
});

test('criticStance takes the worst finding', () => {
  expect(criticStance([f('ACCEPT ok'), f('REJECT race condition')]).stance).toBe('reject');
  expect(criticStance([f('ACCEPT ok'), f('PARTIAL meh')]).stance).toBe('partial');
  expect(criticStance([f('ACCEPT a'), f('ACCEPT b')]).stance).toBe('accept');
});

test('AC4 panelVerdict: majority wins, exact tie escalates', () => {
  expect(panelVerdict(['accept', 'accept', 'reject']).verdict).toBe('accept');
  expect(panelVerdict(['reject', 'accept']).verdict).toBe('escalate'); // 1-1 tie
  expect(panelVerdict(['reject', 'accept']).tie).toBe(true);
});

test('gates fail → block (never silent-merge)', async () => {
  const out = await decideMergeability({ gatesPass: false, panel: { verdict: 'accept' }, critics: [] });
  expect(out.decision).toBe('block');
});

test('gates pass + panel accept → merge', async () => {
  const out = await decideMergeability({ gatesPass: true, panel: { verdict: 'accept' }, critics: [] });
  expect(out.decision).toBe('merge');
});

test('AC4 panel tie → escalate one tier', async () => {
  let escalated = null;
  const out = await decideMergeability({ gatesPass: true, panel: { verdict: 'escalate' }, critics: [],
    deps: { escalate: (reason) => { escalated = reason; return 'senior'; } } });
  expect(out.decision).toBe('escalate');
  expect(escalated).toBe('panel-tie');
});

test('AC2 critic reject + gates pass, unprovable non-severe → advisory (gates authoritative)', async () => {
  const critics = [criticStance([f('REJECT style nit, rename var')])];
  const out = await decideMergeability({ gatesPass: true, panel: { verdict: 'reject' }, critics });
  expect(out.decision).toBe('advisory'); // prove-it'd, can't reproduce, not high-sev → gates authoritative
});

test('AC2 a soft PARTIAL with no flaw wording is NOT routed to prove-it → panel decides', async () => {
  const critics = [criticStance([f('ACCEPT ok')]), criticStance([f('ACCEPT good')]),
    criticStance([f('PARTIAL mostly fine, consider a comment')])];
  const panel = panelVerdict(critics.map((critic) => critic.stance)); // accept majority (2-1)
  const out = await decideMergeability({ gatesPass: true, panel, critics });
  expect(out.decision).toBe('merge');
});

test('semantic-gap: a keyword-MISSED reject that REPRODUCES is still caught (keyword-independent)', async () => {
  // "inconsistent database state" — verdict REJECT carries the signal even if wording dodged the regex.
  const critics = [criticStance([f('REJECT the A→C transition is dropped, leaving the ledger unsettled')])];
  const out = await decideMergeability({ gatesPass: true, panel: { verdict: 'accept' }, critics,
    deps: { proveIt: () => ({ reproduced: true, test: 'tests/repro-ledger.spec.js' }) } });
  expect(out.decision).toBe('re-arm'); // reject → prove-it regardless of keywords → reproduced → caught
});

test('AC3 security flaw reproduced → re-arm the verifier (block + repro)', async () => {
  const critics = [criticStance([f('REJECT auth bypass on the admin route')])];
  const out = await decideMergeability({ gatesPass: true, panel: { verdict: 'reject' }, critics,
    deps: { proveIt: () => ({ reproduced: true, test: 'tests/repro-authbypass.spec.js' }) } });
  expect(out.decision).toBe('re-arm');
  expect(out.repros[0]).toContain('repro'); // F6: all reproduced tests carried as an array
});

test('F4 a MINORITY critic flagging a flaw outranks a majority ACCEPT (no silent-merge)', async () => {
  // 2 critics ACCEPT, 1 flags an auth bypass → panel majority is "accept", but the flaw must win.
  const critics = [
    criticStance([f('ACCEPT looks fine')]),
    criticStance([f('ACCEPT clean')]),
    criticStance([f('PARTIAL potential auth bypass on the admin route')]),
  ];
  const panel = panelVerdict(critics.map((critic) => critic.stance)); // verdict: accept (2-1)
  expect(panel.verdict).toBe('accept');
  const out = await decideMergeability({ gatesPass: true, panel, critics,
    deps: { proveIt: () => ({ reproduced: false }), escalate: () => 'human' } });
  expect(out.decision).toBe('escalate'); // high-sev unprovable flaw → escalate, NOT merge
});

test('AC3 high-sev security NOT reproducible → escalate one tier, never silent-merge', async () => {
  const critics = [criticStance([f('REJECT possible RCE via eval of untrusted input')])];
  let reason = null;
  const out = await decideMergeability({ gatesPass: true, panel: { verdict: 'reject' }, critics,
    deps: { proveIt: () => ({ reproduced: false }), escalate: (why) => { reason = why; return 'human'; } } });
  expect(out.decision).toBe('escalate');
  expect(reason).toBe('high-sev-unreproduced-security');
});

test('F1 a low-sev REPRODUCIBLE finding never masks a high-sev UNPROVABLE one → escalate wins', async () => {
  const critics = [criticStance([f('REJECT off-by-one in loop bound'), f('REJECT possible RCE via eval of untrusted input')])];
  // proveIt reproduces the off-by-one but NOT the RCE; the RCE escalation must not be masked by the re-arm.
  const proveIt = (finding) => ({ reproduced: /off-by-one/i.test(finding.raw) });
  const out = await decideMergeability({ gatesPass: true, panel: { verdict: 'reject' }, critics,
    deps: { proveIt, escalate: () => 'human' } });
  expect(out.decision).toBe('escalate');
  expect(out.reason).toBe('high-sev-security-unprovable');
  expect(out.reproduced.length).toBe(1); // the proven low-sev one is carried, not lost
});

test('AC3 low-sev flaw, not reproducible → advisory (gates authoritative)', async () => {
  const critics = [criticStance([f('PARTIAL minor correctness edge near boundary')])];
  const out = await decideMergeability({ gatesPass: true, panel: { verdict: 'partial' }, critics,
    deps: { proveIt: () => ({ reproduced: false }) } });
  expect(out.decision).toBe('advisory');
  expect(out.reason).toBe('gates-authoritative-unproven-findings');
});

test('AC1 runCriticPanel skips same-family, dispatches cross-family only', async () => {
  const seen = [];
  const dispatch = ({ model }) => { seen.push(model); return { findings: [f('ACCEPT ok')], modelUsed: model }; };
  const out = await runCriticPanel({ content: 'diff', gatesPass: true, generatorFamily: 'qwen',
    criticModels: [{ model: 'qwen-32b', family: 'qwen' }, { model: 'gemini-pro', family: 'gemini' }],
    deps: { dispatch } });
  expect(seen).toEqual(['gemini-pro']); // same-family qwen skipped
  expect(out.decision).toBe('merge');
});

test('AC1 no cross-family critic available → escalate', async () => {
  const out = await runCriticPanel({ content: 'diff', gatesPass: true, generatorFamily: 'qwen',
    criticModels: [{ model: 'qwen-32b', family: 'qwen' }], deps: { dispatch: () => ({ findings: [] }) } });
  expect(out.decision).toBe('escalate');
  expect(out.reason).toBe('no-cross-family-critic-available');
});
