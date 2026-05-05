// judge-quorum.spec.js — HAMR Wave 1 judge-quorum unit tests (#895)
// All tests use deterministic stubs — no live LLM calls, no API keys.
const { test, expect } = require('@playwright/test');
const path = require('path');

const MOD_PATH = path.join(__dirname, '..', 'scripts', 'global', 'judge-quorum.js');
const jq = require(MOD_PATH);
const PROMPT = 'Is this governance artifact correctly formatted?';

// Stub factory: returns dispatcher that yields score per model, defaulting to 0.8
const stubDispatch = (scoresByModel) => async (model) => ({ score: scoresByModel[model] ?? 0.8 });

// 1. judgeFamilies() returns 5 families
test('judgeFamilies returns all 5 expected families', () => {
  const families = jq.judgeFamilies();
  expect(Object.keys(families)).toHaveLength(5);
  for (const f of ['qwen', 'llama', 'claude', 'gemini', 'mistral']) {
    expect(families).toHaveProperty(f);
    expect(Array.isArray(families[f])).toBe(true);
  }
});

// 2. routine gate returns single judge result
test('judge routine gate returns single judge record', async () => {
  const dispatch = stubDispatch({ 'qwen-3-235b@cerebras': 0.9 });
  const result = await jq.judge(PROMPT, { gateType: 'routine', dispatcher: dispatch });
  expect(result.judges).toHaveLength(1);
  expect(result.score).toBe(0.9);
  expect(result.agreement).toBe(true);
  expect(result.judges[0].family).toBe('qwen');
});

// 3. stage2 gate selects 2 different families
test('judge stage2 selects 2 judges from different families', async () => {
  const dispatch = stubDispatch({});
  const result = await jq.judge(PROMPT, { gateType: 'stage2', dispatcher: dispatch });
  expect(result.judges).toHaveLength(2);
  const families = result.judges.map(j => j.family);
  expect(families[0]).not.toBe(families[1]);
});

// 4. closeout gate ensures at least one vendor-attested judge
test('judge closeout gate includes at least one vendor-attested judge', async () => {
  const dispatch = stubDispatch({});
  const result = await jq.judge(PROMPT, { gateType: 'closeout', dispatcher: dispatch });
  expect(result.judges).toHaveLength(2);
  const provenances = result.judges.map(j => j.provenance);
  const hasAttested = provenances.some(p =>
    ['vendor-attested', 'source-built', 'hardware-rooted'].includes(p));
  expect(hasAttested).toBe(true);
});

// 5. agreement: scores within 0.10 threshold
test('judge agreement true when score diff <= 0.10', async () => {
  const dispatch = stubDispatch({ 'qwen-3-235b@cerebras': 0.95, 'llama-3.3-70b-versatile@groq': 0.92 });
  const result = await jq.judge(PROMPT, { gateType: 'stage2', dispatcher: dispatch });
  expect(result.agreement).toBe(true);
  expect(result.score).toBeCloseTo(0.935, 5);
  expect(result.disagreement_reason).toBeUndefined();
});

// 6. disagreement: scores > 0.10 apart
test('judge disagreement flagged when score diff > 0.10', async () => {
  const dispatch = stubDispatch({ 'qwen-3-235b@cerebras': 0.95, 'llama-3.3-70b-versatile@groq': 0.50 });
  const result = await jq.judge(PROMPT, { gateType: 'stage2', dispatcher: dispatch });
  expect(result.agreement).toBe(false);
  expect(typeof result.disagreement_reason).toBe('string');
  expect(result.disagreement_reason).toMatch(/^score_diff_/);
});

// 7. escalate selects a 3rd judge from a different family
test('escalate selects 3rd judge from a family not in prevJudges', async () => {
  const prevJudges = [
    { family: 'qwen', model: 'qwen-3-235b@cerebras', score: 0.95, provenance: 'vendor-attested' },
    { family: 'llama', model: 'llama-3.3-70b-versatile@groq', score: 0.50, provenance: 'vendor-attested' },
  ];
  const dispatch = stubDispatch({});
  const result = await jq.escalate(PROMPT, prevJudges, dispatch);
  expect(result.score).not.toBeNull();
  expect(result.judge.family).not.toBe('qwen');
  expect(result.judge.family).not.toBe('llama');
});

// 8. missing dispatcher raises a clear error
test('missing dispatcher raises descriptive error', async () => {
  await expect(jq.judge(PROMPT, { gateType: 'routine' }))
    .rejects.toThrow('no dispatcher configured');
});
