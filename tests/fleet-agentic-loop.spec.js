// Refs #2854 P1-0 child of #2802 — agentic MCP loop driver. Network/process-free: step/invokeTool/
// validate are all injected. A `scriptedStep` replays a queue of fleet actions.
const { test, expect } = require('@playwright/test');
const { runAgenticLoop, applyAction } = require('../scripts/global/fleet-agentic-loop.js');

// Returns a step() that yields the queued actions in order (then a final once exhausted).
function scriptedStep(actions) {
  const queue = actions.slice();
  return async () => queue.shift() || { type: 'final', answer: 'done' };
}
const okTool = () => ({ ok: true, result: { x: 1 } });
const trusted = () => ({ trusted: true, reason: 'tests passed' });
const untrusted = () => ({ trusted: false, reason: 'tests failed (exit 1)' });

test('#2854 AC1 a tool call then a final answer completes the loop', async () => {
  const out = await runAgenticLoop({
    task: 't', step: scriptedStep([{ type: 'tool', tool: 'github_read', args: { kind: 'issue', number: 1 } },
      { type: 'final', answer: 'ok' }]), invokeTool: okTool, validate: trusted,
  });
  expect(out.outcome).toBe('completed');
  expect(out.reason).toBe('final');
  expect(out.result).toBe('ok');
  expect(out.iterations).toBe(2);
  expect(out.transcript.map((entry) => entry.kind)).toEqual(['tool', 'final']);
  // flat tool record: ok + payload directly at .result (no double-nesting), truncated flag present
  expect(out.transcript[0]).toMatchObject({ kind: 'tool', tool: 'github_read', ok: true, result: { x: 1 }, truncated: false });
});

test('#2854 AC2 a trusted proposed change is promoted; operator owns testCommand', async () => {
  let seenTestCommand = null;
  const out = await runAgenticLoop({
    step: scriptedStep([{ type: 'propose', changes: [{ path: 'a.js', content: 'x' }], testCommand: ['rm', '-rf'] }]),
    testCommand: ['node', '--test'],
    validate: (args) => { seenTestCommand = args.testCommand; return trusted(); },
  });
  expect(out.outcome).toBe('completed');
  expect(out.reason).toBe('change-trusted');
  expect(out.result).toEqual([{ path: 'a.js', content: 'x' }]);
  expect(seenTestCommand).toEqual(['node', '--test']); // opts.testCommand, NOT the fleet action's
});

test('#2854 AC2 an untrusted change does not complete — loop continues then finals', async () => {
  const out = await runAgenticLoop({
    step: scriptedStep([{ type: 'propose', changes: [], testCommand: ['x'] }, { type: 'final', answer: 'fixed' }]),
    validate: untrusted,
  });
  expect(out.outcome).toBe('completed');
  expect(out.result).toBe('fixed');
  expect(out.transcript[0]).toMatchObject({ kind: 'propose', trusted: false });
});

test('#2854 AC3 explicit fleet escalate hands back to the operator', async () => {
  const out = await runAgenticLoop({ step: scriptedStep([{ type: 'escalate', reason: 'low-confidence' }]) });
  expect(out.outcome).toBe('escalated');
  expect(out.reason).toBe('low-confidence');
  expect(out.iterations).toBe(1);
});

test('#2854 AC3 max-iterations escalates (bounded loop)', async () => {
  // step always returns a tool call that "succeeds" but never finishes → must hit the iteration bound.
  const out = await runAgenticLoop({
    step: async () => ({ type: 'tool', tool: 'wiki_search', args: { query: 'x' } }),
    invokeTool: okTool, maxIterations: 4,
  });
  expect(out.outcome).toBe('escalated');
  expect(out.reason).toBe('max-iterations');
  expect(out.iterations).toBe(4);
});

test('#2854 AC3 a consecutive-failure streak escalates', async () => {
  const out = await runAgenticLoop({
    step: async () => ({ type: 'tool', tool: 'github_merge', args: {} }),
    invokeTool: () => ({ ok: false, reason: 'unknown tool' }), maxConsecutiveFailures: 3, maxIterations: 20,
  });
  expect(out.outcome).toBe('escalated');
  expect(out.reason).toBe('repeated-failure');
  expect(out.iterations).toBe(3);
});

test('#2854 AC4 a missing step throws a clear error', async () => {
  await expect(runAgenticLoop({})).rejects.toThrow(/opts\.step.*required/);
});

test('#2854 applyAction classifies each action shape', () => {
  expect(applyAction({ type: 'final', answer: 'a' }, {}, ['x']).done.outcome).toBe('completed');
  expect(applyAction({ type: 'escalate' }, {}, ['x']).done).toMatchObject({ outcome: 'escalated', reason: 'fleet-escalate' });
  expect(applyAction({ type: 'bogus' }, {}, ['x']).failed).toBe(true);
  expect(applyAction({ type: 'tool', tool: 'wiki_search' }, { invokeTool: okTool }, ['x']).failed).toBe(false);
});
