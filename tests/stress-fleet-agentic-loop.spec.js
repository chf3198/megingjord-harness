// Stress tests for #2854 agentic MCP loop driver — MCP loop-lifecycle chaos (G6) + a p99 latency budget
// on the bounded loop (G7). Satisfies #2802 AC7 for the loop surface. Network/process-free (all injected).
const { test, expect } = require('@playwright/test');
const { runAgenticLoop } = require('../scripts/global/fleet-agentic-loop.js');

const okTool = () => ({ ok: true, result: {} });

test('#2854 CHAOS: an unbroken tool-denial stream always escalates, never completes', async () => {
  for (const limit of [1, 2, 3, 5, 8]) {
    const out = await runAgenticLoop({
      step: async () => ({ type: 'tool', tool: 'github_merge', args: {} }),
      invokeTool: () => ({ ok: false, reason: 'unknown tool' }),
      maxConsecutiveFailures: limit, maxIterations: 50,
    });
    expect(out.outcome).toBe('escalated');
    expect(out.reason).toBe('repeated-failure');
    expect(out.iterations).toBe(limit); // escalates exactly at the failure budget
  }
});

test('#2854 CHAOS: a never-trusted change stream escalates (no untrusted promotion)', async () => {
  const out = await runAgenticLoop({
    step: async () => ({ type: 'propose', changes: [{ path: 'a', content: 'x' }] }),
    validate: () => ({ trusted: false, reason: 'tests failed' }),
    maxConsecutiveFailures: 4, maxIterations: 50,
  });
  expect(out.outcome).toBe('escalated');
  expect(out.transcript.every((entry) => entry.trusted === false)).toBe(true); // nothing promoted
});

test('#2854 CHAOS: garbage/invalid actions are failures and never crash the loop', async () => {
  const garbage = [null, undefined, {}, { type: 'unknown' }, 42, 'tool', { type: 'tool' }];
  let index = 0;
  const out = await runAgenticLoop({
    step: async () => garbage[index++ % garbage.length],
    invokeTool: () => ({ ok: false, reason: 'no tool' }), maxConsecutiveFailures: 5, maxIterations: 30,
  });
  expect(out.outcome).toBe('escalated'); // bounded + fail-closed, no throw
});

test('#2854 CHAOS: a recovery (failure then success) resets the failure streak', async () => {
  // fail twice, succeed once (resets), then finish — must NOT escalate on repeated-failure(=3).
  const actions = [{ type: 'tool', tool: 'x' }, { type: 'tool', tool: 'x' },
    { type: 'tool', tool: 'wiki_search' }, { type: 'final', answer: 'ok' }];
  let oks = [false, false, true];
  let call = 0;
  const out = await runAgenticLoop({
    step: async () => actions.shift(),
    invokeTool: () => ({ ok: oks[call++] ?? true }),
    maxConsecutiveFailures: 3, maxIterations: 10,
  });
  expect(out.outcome).toBe('completed');
});

test('#2854 EDGE: a deliberate maxIterations:0 is respected (?? not ||), loop runs zero times', async () => {
  let stepCalls = 0;
  const out = await runAgenticLoop({ step: async () => { stepCalls += 1; return { type: 'final', answer: 'x' }; },
    maxIterations: 0 });
  expect(stepCalls).toBe(0);
  expect(out.outcome).toBe('escalated');
  expect(out.reason).toBe('max-iterations');
  expect(out.iterations).toBe(0);
});

test('#2854 EDGE: a successful action never trips the failure escalation (> 0 guard)', async () => {
  // maxConsecutiveFailures:0 must mean "escalate on first FAILURE", not on a success.
  const out = await runAgenticLoop({
    step: async (ctx) => (ctx.iteration < 2 ? { type: 'tool', tool: 'wiki_search' } : { type: 'final', answer: 'ok' }),
    invokeTool: () => ({ ok: true }), maxConsecutiveFailures: 0, maxIterations: 10,
  });
  expect(out.outcome).toBe('completed'); // successes alone never escalate
});

test('#2854 EDGE: maxConsecutiveFailures:0 escalates on the very first failure', async () => {
  const out = await runAgenticLoop({ step: async () => ({ type: 'tool', tool: 'github_merge' }),
    invokeTool: () => ({ ok: false, reason: 'no' }), maxConsecutiveFailures: 0, maxIterations: 10 });
  expect(out.outcome).toBe('escalated');
  expect(out.reason).toBe('repeated-failure');
  expect(out.iterations).toBe(1);
});

test('#2854 CHAOS: untrusted model strings are capped in the transcript (anti-bloat)', async () => {
  const huge = 'A'.repeat(50000);
  const escalated = await runAgenticLoop({ step: async () => ({ type: 'escalate', reason: huge }) });
  expect(escalated.transcript[0].reason.length).toBeLessThan(300); // truncated, not 50k
  // an invalid action with a huge body records only its shape, not the body
  const invalid = await runAgenticLoop({ step: async () => ({ type: 'x', junk: huge }),
    maxConsecutiveFailures: 1 });
  expect(JSON.stringify(invalid.transcript)).not.toContain('AAAAA');
  // a tool returning a multi-megabyte payload is capped in the transcript (functional-DoS guard)
  const bigTool = await runAgenticLoop({
    step: async (ctx) => (ctx.iteration < 1 ? { type: 'tool', tool: 'github_read' } : { type: 'final', answer: 'x' }),
    invokeTool: () => ({ ok: true, result: { body: 'B'.repeat(2_000_000) } }),
  });
  const toolEntry = bigTool.transcript.find((entry) => entry.kind === 'tool');
  expect(toolEntry.truncated).toBe(true); // flat record: truncated flag at top level
  expect(toolEntry.ok).toBe(true);
  expect(JSON.stringify(toolEntry).length).toBeLessThan(8000); // bounded, not 2MB
});

test('#2854 CHAOS: untrusted tool name + final answer are capped (anti-bloat / DoS)', async () => {
  const huge = 'Z'.repeat(60000);
  const toolRun = await runAgenticLoop({
    step: async (ctx) => (ctx.iteration < 1 ? { type: 'tool', tool: huge } : { type: 'final', answer: 'x' }),
    invokeTool: () => ({ ok: true, result: {} }),
  });
  expect(toolRun.transcript[0].tool.length).toBeLessThan(300); // tool name bounded in the transcript
  const finalRun = await runAgenticLoop({ step: async () => ({ type: 'final', answer: huge }) });
  expect(String(finalRun.result).length).toBeLessThan(5000); // final answer bounded to the caller
});

test('#2854 CHAOS: a non-string tool name / escalate reason is coerced + bounded', async () => {
  const bigArray = new Array(50000).fill('q'); // non-string the model might smuggle in
  const toolRun = await runAgenticLoop({
    step: async (ctx) => (ctx.iteration < 1 ? { type: 'tool', tool: bigArray } : { type: 'final', answer: 'x' }),
    invokeTool: () => ({ ok: false, reason: 'no' }), maxIterations: 4,
  });
  expect(typeof toolRun.transcript[0].tool).toBe('string');
  expect(toolRun.transcript[0].tool.length).toBeLessThan(300);
  const escRun = await runAgenticLoop({ step: async () => ({ type: 'escalate', reason: { huge: bigArray } }) });
  expect(typeof escRun.reason).toBe('string');
  expect(escRun.reason.length).toBeLessThan(300);
  // a validate verdict with a huge reason is bounded in the transcript too
  const verdictRun = await runAgenticLoop({ step: async () => ({ type: 'propose', changes: [] }),
    validate: () => ({ trusted: false, reason: 'R'.repeat(40000) }), maxConsecutiveFailures: 1 });
  expect(verdictRun.transcript[0].reason.length).toBeLessThan(300);
});

test('#2854 a trusted propose returns the FULL change set (deliverable not truncated)', async () => {
  const changes = [{ path: 'a.js', content: 'X'.repeat(20000) }]; // bounded by #2844 (<=10MB), kept whole
  const out = await runAgenticLoop({
    step: async () => ({ type: 'propose', changes }), validate: () => ({ trusted: true }),
  });
  expect(out.result).toEqual(changes); // operator gets the exact validated changes to apply
});

test('#2854 CHAOS: a misbehaving dep returning nullish is a failure, not a crash', async () => {
  const nullTool = await runAgenticLoop({ step: async () => ({ type: 'tool', tool: 'x' }),
    invokeTool: () => null, maxConsecutiveFailures: 2, maxIterations: 10 });
  expect(nullTool.outcome).toBe('escalated'); // recorded as failure, no throw
  const nullValidate = await runAgenticLoop({ step: async () => ({ type: 'propose', changes: [] }),
    validate: () => undefined, maxConsecutiveFailures: 2, maxIterations: 10 });
  expect(nullValidate.outcome).toBe('escalated'); // untrusted by default, no throw, never promoted
});

test('#2854 CHAOS: a circular / non-serializable tool result never crashes the loop', async () => {
  const circular = {}; circular.self = circular; // JSON.stringify would throw
  const out = await runAgenticLoop({
    step: async (ctx) => (ctx.iteration < 1 ? { type: 'tool', tool: 'github_read' } : { type: 'final', answer: 'x' }),
    invokeTool: () => ({ ok: true, result: circular }),
  });
  expect(out.outcome).toBe('completed'); // no throw
  const toolEntry = out.transcript.find((entry) => entry.kind === 'tool');
  expect(toolEntry.truncated).toBe(true);
  expect(toolEntry.result).toBe('[unserializable tool result]');
});

test('#2854 PERF: a bounded loop p99 < 5ms (injected step)', async () => {
  const samples = [];
  for (let iter = 0; iter < 1000; iter += 1) {
    const start = process.hrtime.bigint();
    // eslint-disable-next-line no-await-in-loop
    await runAgenticLoop({
      step: async (ctx) => (ctx.iteration < 3 ? { type: 'tool', tool: 'wiki_search' } : { type: 'final', answer: 'x' }),
      invokeTool: okTool, maxIterations: 8,
    });
    samples.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  samples.sort((first, second) => first - second);
  expect(samples[Math.floor(samples.length * 0.99)]).toBeLessThan(5);
});
